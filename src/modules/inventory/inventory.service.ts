import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { eq, and, ilike, or, lte, gte, sql, desc, asc, inArray } from 'drizzle-orm';
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

const CATEGORY_SLUG_ALIASES: Record<string, string[]> = {
  vitamins: ['vitamins-minerals', 'vitamins'],
  supplements: ['supplements-wellness', 'supplements'],
  cosmetics: ['beauty-skin', 'skincare-lotions', 'cosmetics'],
  beauty: ['beauty-skin'],
  skincare: ['skincare-lotions', 'beauty-skin'],
  'children-health': ['childrens-health'],
  omega: ['omega-fish-oils'],
  protein: ['protein-sports'],
  sports: ['protein-sports'],
  digestive: ['digestive-health'],
  immune: ['immune-support'],
};

@Injectable()
export class InventoryService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly realtime: RealtimeGateway,
  ) {}

  // ── Categories ────────────────────────────────────────────────────────────
  async getCategories() {
    return this.db.select().from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.name));
  }

  async getPublicCategories() {
    return this.db.select().from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.name));
  }

  async getPublicCategoryBySlug(slug: string) {
    const targetSlugs = CATEGORY_SLUG_ALIASES[slug.toLowerCase()] ?? [slug];
    const [cat] = await this.db
      .select()
      .from(categories)
      .where(and(inArray(categories.slug, targetSlugs), eq(categories.isActive, true)))
      .limit(1);
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
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

    let countQuery$ = this.db
      .select({ count: sql<number>`count(distinct ${products.id})` })
      .from(products);

    const finalConditions: any[] = [...conditions];
    if (lowStock) {
      finalConditions.push(lte(stockItems.quantityOnHand, products.reorderPoint));
      countQuery$ = countQuery$.leftJoin(stockItems, and(
        eq(stockItems.productId, products.id),
        eq(stockItems.storeId, storeId),
      )) as any;
    }
    const finalWhereClause = finalConditions.length > 0 ? and(...finalConditions) : undefined;
    
    if (finalWhereClause) {
      query$ = query$.where(finalWhereClause) as any;
      countQuery$ = countQuery$.where(finalWhereClause) as any;
    }

    const [data, countResult] = await Promise.all([
      query$.limit(limit).offset(offset),
      countQuery$,
    ]);

    const count = Number(countResult[0]?.count ?? 0);

    const mappedData = data.map(row => ({
      ...row.product,
      category: row.category?.name ?? null,
      categoryName: row.category?.name ?? null,
      categoryId: row.product.categoryId,
      categoryObj: row.category ?? null,
      quantity: row.stockItem?.quantityOnHand ?? 0,
      stockLevel: row.stockItem?.quantityOnHand ?? 0,
    }));

    const uniqueData = Array.from(new Map(mappedData.map(item => [item.id, item])).values());

    return paginate(uniqueData, count, page, limit);
  }

  async getPublicProducts(
    query: PaginationDto & {
      type?: string;
      categoryId?: string;
      categorySlug?: string;
      brand?: string;
      maxPrice?: number;
      featured?: boolean;
      bestseller?: boolean;
      sort?: 'featured' | 'price-asc' | 'price-desc' | 'rating' | 'newest';
    },
  ) {
    const {
      page = 1, limit = 20, search, type, categoryId, categorySlug,
      brand, maxPrice, featured, bestseller, sort,
    } = query;
    const offset = (page - 1) * limit;

    const conditions: any[] = [eq(products.status, 'active')];
    if (search) {
      conditions.push(
        or(
          ilike(products.name, `%${search}%`),
          ilike(products.brand ?? '', `%${search}%`),
          ilike(products.sku, `%${search}%`),
          ilike(products.genericName ?? '', `%${search}%`),
        ),
      );
    }
    if (type) conditions.push(eq(products.type, type as any));
    if (categoryId) conditions.push(eq(products.categoryId, categoryId));
    if (categorySlug) {
      const aliases = CATEGORY_SLUG_ALIASES[categorySlug.toLowerCase()] ?? [categorySlug];
      conditions.push(inArray(categories.slug, aliases));
    }
    if (brand) conditions.push(eq(products.brand, brand));
    if (typeof maxPrice === 'number') conditions.push(lte(products.sellingPricePesewas, maxPrice));
    if (featured) conditions.push(eq(products.isFeatured, true));
    if (bestseller) conditions.push(eq(products.isBestseller, true));

    const whereClause = and(...conditions);

    let query$ = this.db
      .select({
        product: products,
        category: categories,
        stockTotal: sql<number>`COALESCE(SUM(${stockItems.quantityOnHand}), 0)::int`,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(stockItems, eq(stockItems.productId, products.id))
      .where(whereClause)
      .groupBy(products.id, categories.id)
      .limit(limit)
      .offset(offset) as any;

    switch (sort) {
      case 'price-asc':
        query$ = query$.orderBy(asc(products.sellingPricePesewas));
        break;
      case 'price-desc':
        query$ = query$.orderBy(desc(products.sellingPricePesewas));
        break;
      case 'rating':
        query$ = query$.orderBy(desc(products.rating));
        break;
      case 'newest':
        query$ = query$.orderBy(desc(products.createdAt));
        break;
      default:
        query$ = query$.orderBy(desc(products.isFeatured), desc(products.createdAt));
    }

    const countQuery$ = this.db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(whereClause);

    const [data, countResult] = await Promise.all([query$, countQuery$]);

    const mappedData = data.map((row: any) => ({
      ...row.product,
      category: row.category?.name ?? null,
      categoryName: row.category?.name ?? null,
      categorySlug: row.category?.slug ?? null,
      categoryId: row.product.categoryId,
      categoryObj: row.category ?? null,
      quantity: Number(row.stockTotal ?? 0),
      stockLevel: Number(row.stockTotal ?? 0),
    }));

    return paginate(mappedData, Number(countResult[0]?.count ?? 0), page, limit);
  }

  async getBrands() {
    const rows = await this.db
      .selectDistinct({ brand: products.brand })
      .from(products)
      .where(and(eq(products.status, 'active')));
    return rows.map((r) => r.brand).filter((b): b is string => !!b).sort();
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

  async getPublicProductById(id: string) {
    return this.getProductById(id);
  }

  async getPublicProductBySlug(slug: string) {
    const [row] = await this.db
      .select({
        product: products,
        category: categories,
        stockTotal: sql<number>`COALESCE(SUM(${stockItems.quantityOnHand}), 0)::int`,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(stockItems, eq(stockItems.productId, products.id))
      .where(eq(products.slug, slug))
      .groupBy(products.id, categories.id)
      .limit(1);
    if (!row) throw new NotFoundException('Product not found');
    return {
      ...row.product,
      category: row.category?.name ?? null,
      categoryName: row.category?.name ?? null,
      categorySlug: row.category?.slug ?? null,
      quantity: Number(row.stockTotal ?? 0),
      stockLevel: Number(row.stockTotal ?? 0),
    };
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

  async deleteProduct(id: string) {
    const existing = await this.db.select({ id: products.id, name: products.name }).from(products).where(eq(products.id, id)).limit(1);
    if (!existing.length) {
      throw new NotFoundException('Product not found');
    }

    // Clean up dependent stock records first to satisfy foreign key constraints
    await this.db.delete(stockAlerts).where(eq(stockAlerts.productId, id));
    await this.db.delete(stockMovements).where(eq(stockMovements.productId, id));
    await this.db.delete(stockBatches).where(eq(stockBatches.productId, id));
    await this.db.delete(stockItems).where(eq(stockItems.productId, id));

    const [deleted] = await this.db.delete(products).where(eq(products.id, id)).returning();
    return { success: true, message: `Product '${deleted?.name ?? id}' deleted successfully` };
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
