import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { eq, and, ilike, or, lte, gte, sql, desc, asc } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import {
  products,
  categories,
  stockItems,
  stockBatches,
  stockMovements,
  stockAlerts,
} from '../../database/schema';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import type {
  CreateProductDto,
  UpdateProductDto,
  StockAdjustmentDto,
  CreateBatchDto,
  CreateCategoryDto,
} from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly realtime: RealtimeGateway,
  ) {}

  // ── Categories ────────────────────────────────────────────────────────────
  async getCategories() {
    return this.db.select().from(categories).where(eq(categories.isActive, true));
  }

  async createCategory(dto: CreateCategoryDto) {
    const [cat] = await this.db.insert(categories).values(dto).returning();
    return cat;
  }

  // ── Products ──────────────────────────────────────────────────────────────
  async getProducts(storeId: string, query: PaginationDto & { type?: string; categoryId?: string; lowStock?: boolean }) {
    const { page, limit, search, sortBy, sortOrder, type, categoryId, lowStock } = query;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [];

    if (search) {
      conditions.push(
        or(
          ilike(products.name, `%${search}%`),
          ilike(products.sku, `%${search}%`),
          ilike(products.barcode, `%${search}%`),
        ) as ReturnType<typeof eq>,
      );
    }
    if (type) conditions.push(eq(products.type, type as any));
    if (categoryId) conditions.push(eq(products.categoryId, categoryId));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let query$ = this.db
      .select({
        product: products,
        category: categories,
        stockItem: stockItems,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(stockItems, and(
        eq(stockItems.productId, products.id),
        eq(stockItems.storeId, storeId),
      ));

    // Build complete where clause including lowStock filter
    const finalConditions: any[] = conditions;
    if (lowStock) {
      finalConditions.push(lte(stockItems.quantityOnHand, products.reorderPoint));
    }
    const finalWhereClause = finalConditions.length > 0 ? and(...finalConditions) : undefined;
    
    if (finalWhereClause) {
      query$ = query$.where(finalWhereClause) as any;
    }

    const [data, [{ count }]] = await Promise.all([
      query$.limit(limit).offset(offset),
      this.db.select({ count: sql<number>`count(*)` }).from(products).where(whereClause),
    ]);

    const mappedData = data.map(row => ({
      ...row.product,
      category: row.category?.name ?? null,
      quantity: row.stockItem?.quantityOnHand ?? 0,
      stockLevel: row.stockItem?.quantityOnHand ?? 0,
    }));

    const uniqueData = Array.from(new Map(mappedData.map(item => [item.id, item])).values());

    return paginate(uniqueData, Number(count), page, limit);
  }

  async getProductById(id: string) {
    const [product] = await this.db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async getProductByBarcode(barcode: string) {
    const [product] = await this.db
      .select()
      .from(products)
      .where(eq(products.barcode, barcode))
      .limit(1);
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async createProduct(dto: CreateProductDto, storeId?: string) {
    const existing = await this.db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.sku, dto.sku))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException(`SKU '${dto.sku}' already exists`);
    }

    const [product] = await this.db.insert(products).values(dto).returning();

    // Auto-create a stock item row so the product appears in inventory immediately
    if (storeId && product) {
      await this.db.insert(stockItems).values({
        productId: product.id,
        storeId,
        quantityOnHand: 0,
        quantityReserved: 0,
        quantityOnOrder: 0,
        reorderPointOverride: null,
        reorderQtyOverride: null,
        sellingPriceOverride: null,
      }).onConflictDoNothing();
    }

    return product;
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const [product] = await this.db
      .update(products)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();

    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  // ── Stock Items (per-store) ────────────────────────────────────────────────
  async getStockItem(productId: string, storeId: string) {
    const [item] = await this.db
      .select()
      .from(stockItems)
      .where(and(eq(stockItems.productId, productId), eq(stockItems.storeId, storeId)))
      .limit(1);
    return item ?? null;
  }

  async upsertStockItem(productId: string, storeId: string, quantityDelta: number) {
    const existing = await this.getStockItem(productId, storeId);

    if (existing) {
      const [updated] = await this.db
        .update(stockItems)
        .set({
          quantityOnHand: sql`${stockItems.quantityOnHand} + ${quantityDelta}`,
          lastMovementAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(stockItems.productId, productId), eq(stockItems.storeId, storeId)))
        .returning();
      return updated;
    }

    const [created] = await this.db
      .insert(stockItems)
      .values({
        productId,
        storeId,
        quantityOnHand: Math.max(0, quantityDelta),
        lastMovementAt: new Date(),
      })
      .returning();
    return created;
  }

  // ── Stock Batches ─────────────────────────────────────────────────────────
  async getBatches(productId: string, storeId: string) {
    return this.db
      .select()
      .from(stockBatches)
      .where(
        and(
          eq(stockBatches.productId, productId),
          eq(stockBatches.storeId, storeId),
          eq(stockBatches.isActive, true),
        ),
      )
      .orderBy(asc(stockBatches.expiryDate));
  }

  async getExpiringBatches(storeId: string, withinDays = 90) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + withinDays);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    return this.db
      .select({ batch: stockBatches, product: products })
      .from(stockBatches)
      .innerJoin(products, eq(products.id, stockBatches.productId))
      .where(
        and(
          eq(stockBatches.storeId, storeId),
          eq(stockBatches.isActive, true),
          lte(stockBatches.expiryDate, cutoffStr),
          gte(stockBatches.quantityRemaining, 1),
        ),
      )
      .orderBy(asc(stockBatches.expiryDate));
  }

  async createBatch(dto: CreateBatchDto, staffId: string) {
    const [batch] = await this.db.insert(stockBatches).values({
      ...dto,
      quantityRemaining: dto.quantityReceived,
    }).returning();

    // Record stock movement
    const before = await this.getStockItem(dto.productId, dto.storeId);
    const qtyBefore = before?.quantityOnHand ?? 0;

    await this.db.insert(stockMovements).values({
      productId: dto.productId,
      storeId: dto.storeId,
      batchId: batch.id,
      type: 'purchase_in',
      quantityChange: dto.quantityReceived,
      quantityBefore: qtyBefore,
      quantityAfter: qtyBefore + dto.quantityReceived,
      costPricePesewas: dto.costPricePesewas,
      referenceType: 'batch',
      referenceId: batch.id,
      performedById: staffId,
    });

    await this.upsertStockItem(dto.productId, dto.storeId, dto.quantityReceived);
    await this.checkAndCreateAlerts(dto.productId, dto.storeId, batch.id);

    return batch;
  }

  // ── Stock Adjustments ─────────────────────────────────────────────────────
  async adjust(dto: StockAdjustmentDto, staffId: string) {
    const isIn = dto.type === 'adjustment_in' || dto.type === 'opening_stock';
    const delta = isIn ? dto.quantity : -dto.quantity;

    const before = await this.getStockItem(dto.productId, dto.storeId);
    const qtyBefore = before?.quantityOnHand ?? 0;
    const qtyAfter = Math.max(0, qtyBefore + delta);

    await this.db.insert(stockMovements).values({
      productId: dto.productId,
      storeId: dto.storeId,
      batchId: dto.batchId,
      type: dto.type,
      quantityChange: delta,
      quantityBefore: qtyBefore,
      quantityAfter: qtyAfter,
      costPricePesewas: dto.costPricePesewas,
      referenceType: 'adjustment',
      performedById: staffId,
      notes: dto.notes,
    });

    const item = await this.upsertStockItem(dto.productId, dto.storeId, delta);
    await this.checkAndCreateAlerts(dto.productId, dto.storeId);

    return item;
  }

  // ── Stock Movements (audit trail) ─────────────────────────────────────────
  async getMovements(productId: string, storeId: string, limit = 50) {
    return this.db
      .select()
      .from(stockMovements)
      .where(and(eq(stockMovements.productId, productId), eq(stockMovements.storeId, storeId)))
      .orderBy(desc(stockMovements.createdAt))
      .limit(limit);
  }

  // ── Alerts ────────────────────────────────────────────────────────────────
  async getAlerts(storeId: string) {
    return this.db
      .select({ alert: stockAlerts, product: products })
      .from(stockAlerts)
      .innerJoin(products, eq(products.id, stockAlerts.productId))
      .where(and(eq(stockAlerts.storeId, storeId), eq(stockAlerts.isDismissed, false)))
      .orderBy(desc(stockAlerts.createdAt));
  }

  async dismissAlert(alertId: string, staffId: string) {
    const [alert] = await this.db
      .update(stockAlerts)
      .set({ isDismissed: true, dismissedById: staffId, dismissedAt: new Date() })
      .where(eq(stockAlerts.id, alertId))
      .returning();
    return alert;
  }

  // ── Internal: auto-generate stock alerts ─────────────────────────────────
  private async checkAndCreateAlerts(productId: string, storeId: string, batchId?: string) {
    const [product] = await this.db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    const stockItem = await this.getStockItem(productId, storeId);
    if (!stockItem || !product) return;

    const qty = stockItem.quantityOnHand;

    // Low / out-of-stock alert
    if (qty === 0) {
      const [alert] = await this.db.insert(stockAlerts).values({
        productId,
        storeId,
        type: 'out_of_stock',
        severity: 'critical',
        message: `${product.name} is out of stock`,
        quantityOnHand: 0,
      }).onConflictDoNothing().returning();

      if (alert) {
        this.realtime.broadcastStockAlert(storeId, {
          alertId: alert.id,
          productId,
          type: 'out_of_stock',
          severity: 'critical',
          message: `${product.name} is out of stock`,
        });
      }
    } else if (qty <= product.reorderPoint) {
      const [alert] = await this.db.insert(stockAlerts).values({
        productId,
        storeId,
        type: 'low_stock',
        severity: 'warning',
        message: `${product.name} is below reorder point (${qty} remaining)`,
        quantityOnHand: qty,
      }).onConflictDoNothing().returning();

      if (alert) {
        this.realtime.broadcastStockAlert(storeId, {
          alertId: alert.id,
          productId,
          type: 'low_stock',
          severity: 'warning',
          message: `${product.name} is below reorder point (${qty} remaining)`,
        });
      }
    }

    // Expiry alert for the batch
    if (batchId) {
      const [batch] = await this.db
        .select()
        .from(stockBatches)
        .where(eq(stockBatches.id, batchId))
        .limit(1);

      if (batch?.expiryDate) {
        const daysToExpiry = Math.ceil(
          (new Date(batch.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );

        if (daysToExpiry <= 90) {
          const [alert] = await this.db.insert(stockAlerts).values({
            productId,
            storeId,
            batchId,
            type: daysToExpiry <= 30 ? 'expiry_critical' : 'expiry_soon',
            severity: daysToExpiry <= 30 ? 'critical' : 'warning',
            message: `Batch ${batch.batchNumber ?? batchId} of ${product.name} expires in ${daysToExpiry} days`,
            quantityOnHand: batch.quantityRemaining,
            expiryDate: batch.expiryDate,
          }).onConflictDoNothing().returning();

          if (alert) {
            this.realtime.broadcastStockAlert(storeId, {
              alertId: alert.id,
              productId,
              type: alert.type,
              severity: alert.severity,
              message: `Batch ${batch.batchNumber ?? batchId} of ${product.name} expires in ${daysToExpiry} days`,
            });
          }
        }
      }
    }
  }
}
