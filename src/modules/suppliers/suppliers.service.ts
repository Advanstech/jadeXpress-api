import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, desc, sql, ilike, inArray } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import {
  suppliers,
  purchaseOrders,
  purchaseItems,
  supplierInvoices,
  stockBatches,
  stockItems,
  stockMovements,
} from '../../database/schema';
import { products } from '../../database/schema/inventory';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import type {
  CreateSupplierDto, UpdateSupplierDto,
  CreatePurchaseOrderDto, ReceiveGoodsDto,
} from './dto/suppliers.dto';

@Injectable()
export class SuppliersService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async list(query: PaginationDto) {
    const { page, limit, search } = query;
    const offset = (page - 1) * limit;
    const where = search ? ilike(suppliers.name, `%${search}%`) : undefined;

    const [data, [{ count }]] = await Promise.all([
      this.db.select().from(suppliers).where(where).orderBy(suppliers.name).limit(limit).offset(offset),
      this.db.select({ count: sql<number>`count(*)` }).from(suppliers).where(where),
    ]);
    return paginate(data, Number(count), page, limit);
  }

  async getById(id: string) {
    const [supplier] = await this.db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async create(dto: CreateSupplierDto) {
    const [supplier] = await this.db.insert(suppliers).values(dto).returning();
    return supplier;
  }

  async update(id: string, dto: UpdateSupplierDto) {
    const [supplier] = await this.db
      .update(suppliers)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(suppliers.id, id))
      .returning();
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async getSupplierPOs(supplierId: string, query: PaginationDto) {
    const { page, limit } = query;
    const offset = (page - 1) * limit;
    const where = eq(purchaseOrders.supplierId, supplierId);

    const [data, [{ count }]] = await Promise.all([
      this.db.select().from(purchaseOrders).where(where)
        .orderBy(desc(purchaseOrders.orderDate)).limit(limit).offset(offset),
      this.db.select({ count: sql<number>`count(*)` }).from(purchaseOrders).where(where),
    ]);
    return paginate(data, Number(count), page, limit);
  }

  async getSupplierProducts(supplierId: string) {
    // Get distinct product IDs from purchase items linked to this supplier's POs
    const supplierPOs = await this.db
      .select({ id: purchaseOrders.id })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.supplierId, supplierId));

    if (supplierPOs.length === 0) return { data: [], total: 0 };

    const poIds = supplierPOs.map((po) => po.id);
    const itemRows = await this.db
      .selectDistinct({ productId: purchaseItems.productId })
      .from(purchaseItems)
      .where(inArray(purchaseItems.purchaseOrderId, poIds));

    if (itemRows.length === 0) return { data: [], total: 0 };

    const productIds = itemRows.map((r) => r.productId);
    const data = await this.db
      .select()
      .from(products)
      .where(inArray(products.id, productIds));

    return { data, total: data.length };
  }

  // ── Purchase Orders ────────────────────────────────────────────────────────
  async createPurchaseOrder(dto: CreatePurchaseOrderDto, raisedById: string) {
    const poNumber = `PO-${Date.now().toString(36).toUpperCase()}`;

    const subtotal = dto.items.reduce(
      (sum, i) => sum + i.unitCostPesewas * i.quantityOrdered, 0,
    );

    const [po] = await this.db.insert(purchaseOrders).values({
      poNumber,
      storeId: dto.storeId,
      supplierId: dto.supplierId,
      raisedById,
      subtotalPesewas: subtotal,
      totalPesewas: subtotal,
      notes: dto.notes,
      expectedDeliveryDate: dto.expectedDeliveryDate,
    }).returning();

    await this.db.insert(purchaseItems).values(
      dto.items.map((item) => ({
        purchaseOrderId: po.id,
        productId: item.productId,
        quantityOrdered: item.quantityOrdered,
        quantityReceived: 0,
        unitCostPesewas: item.unitCostPesewas,
        totalCostPesewas: item.unitCostPesewas * item.quantityOrdered,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
      })),
    );

    return po;
  }

  async listPurchaseOrders(storeId: string, query: PaginationDto) {
    const { page, limit } = query;
    const offset = (page - 1) * limit;
    const where = eq(purchaseOrders.storeId, storeId);

    const [data, [{ count }]] = await Promise.all([
      this.db.select().from(purchaseOrders).where(where)
        .orderBy(desc(purchaseOrders.orderDate)).limit(limit).offset(offset),
      this.db.select({ count: sql<number>`count(*)` }).from(purchaseOrders).where(where),
    ]);
    return paginate(data, Number(count), page, limit);
  }

  async getPurchaseOrder(id: string) {
    const [po] = await this.db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, id))
      .limit(1);
    if (!po) throw new NotFoundException('Purchase order not found');

    const items = await this.db
      .select()
      .from(purchaseItems)
      .where(eq(purchaseItems.purchaseOrderId, id));

    return { ...po, items };
  }

  // ── Receive Goods ─────────────────────────────────────────────────────────
  async receiveGoods(dto: ReceiveGoodsDto, receivedById: string) {
    const [po] = await this.db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, dto.purchaseOrderId))
      .limit(1);
    if (!po) throw new NotFoundException('Purchase order not found');

    for (const received of dto.items) {
      const [poItem] = await this.db
        .select()
        .from(purchaseItems)
        .where(eq(purchaseItems.id, received.purchaseItemId))
        .limit(1);

      if (!poItem) continue;

      // Update qty received on PO item
      await this.db
        .update(purchaseItems)
        .set({ quantityReceived: sql`${purchaseItems.quantityReceived} + ${received.quantityReceived}` })
        .where(eq(purchaseItems.id, received.purchaseItemId));

      // Create stock batch
      const [batch] = await this.db.insert(stockBatches).values({
        productId: poItem.productId,
        storeId: po.storeId,
        supplierId: po.supplierId,
        purchaseOrderId: po.id,
        batchNumber: received.batchNumber ?? poItem.batchNumber,
        quantityReceived: received.quantityReceived,
        quantityRemaining: received.quantityReceived,
        costPricePesewas: poItem.unitCostPesewas,
        expiryDate: received.expiryDate ?? poItem.expiryDate,
      }).returning();

      // Update stock item
      const [existing] = await this.db
        .select()
        .from(stockItems)
        .where(and(eq(stockItems.productId, poItem.productId), eq(stockItems.storeId, po.storeId)))
        .limit(1);

      const qtyBefore = existing?.quantityOnHand ?? 0;
      const qtyAfter = qtyBefore + received.quantityReceived;

      if (existing) {
        await this.db
          .update(stockItems)
          .set({ quantityOnHand: qtyAfter, lastMovementAt: new Date(), updatedAt: new Date() })
          .where(and(eq(stockItems.productId, poItem.productId), eq(stockItems.storeId, po.storeId)));
      } else {
        await this.db.insert(stockItems).values({
          productId: poItem.productId,
          storeId: po.storeId,
          quantityOnHand: qtyAfter,
          lastMovementAt: new Date(),
        });
      }

      // Stock movement
      await this.db.insert(stockMovements).values({
        productId: poItem.productId,
        storeId: po.storeId,
        batchId: batch.id,
        type: 'purchase_in',
        quantityChange: received.quantityReceived,
        quantityBefore: qtyBefore,
        quantityAfter: qtyAfter,
        costPricePesewas: poItem.unitCostPesewas,
        referenceType: 'purchase',
        referenceId: po.id,
        performedById: receivedById,
      });
    }

    // Update PO status
    const allItems = await this.db
      .select()
      .from(purchaseItems)
      .where(eq(purchaseItems.purchaseOrderId, po.id));

    const fullyReceived = allItems.every((i) => i.quantityReceived >= i.quantityOrdered);
    const anyReceived = allItems.some((i) => i.quantityReceived > 0);

    await this.db
      .update(purchaseOrders)
      .set({
        status: fullyReceived ? 'received' : anyReceived ? 'partial' : 'acknowledged',
        deliveredAt: fullyReceived ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, po.id));

    return { success: true, purchaseOrderId: po.id };
  }
}
