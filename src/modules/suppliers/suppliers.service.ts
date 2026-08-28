import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, desc, sql, ilike, inArray, sum } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import {
  suppliers,
  purchaseOrders,
  purchaseItems,
  supplierInvoices,
  stockBatches,
  stockItems,
  stockMovements,
  categories,
  ledgerEntries,
} from '../../database/schema';
import { products } from '../../database/schema/inventory';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import type {
  CreateSupplierDto, UpdateSupplierDto,
  CreatePurchaseOrderDto, ReceiveGoodsDto,
  PayPurchaseOrderDto,
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

  async getSupplierProducts(supplierId: string, storeId?: string) {
    // Collect product IDs both from POs and from products where this supplier is primary
    const supplierPOs = await this.db
      .select({ id: purchaseOrders.id })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.supplierId, supplierId));

    const poIds = supplierPOs.map((po) => po.id);

    const [poProductRows, directProducts, batchProductRows] = await Promise.all([
      poIds.length > 0
        ? this.db
            .selectDistinct({ productId: purchaseItems.productId })
            .from(purchaseItems)
            .where(inArray(purchaseItems.purchaseOrderId, poIds))
        : [],
      this.db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.primarySupplierId, supplierId)),
      this.db
        .selectDistinct({ productId: stockBatches.productId })
        .from(stockBatches)
        .where(eq(stockBatches.supplierId, supplierId)),
    ]);

    const ids = new Set<string>();
    for (const row of poProductRows) {
      ids.add(row.productId);
    }
    for (const row of directProducts) {
      ids.add(row.id);
    }
    for (const row of batchProductRows) {
      ids.add(row.productId);
    }

    if (ids.size === 0) return { data: [], total: 0 };

    const productIds = Array.from(ids);

    const rows = await this.db
      .select({
        product: products,
        category: categories,
        stockItem: stockItems,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(
        stockItems,
        storeId
          ? and(eq(stockItems.productId, products.id), eq(stockItems.storeId, storeId))
          : eq(stockItems.productId, products.id),
      )
      .where(inArray(products.id, productIds));

    const mappedData = rows.map((row) => ({
      ...row.product,
      category: row.category?.name ?? null,
      quantity: row.stockItem?.quantityOnHand ?? 0,
      stockLevel: row.stockItem?.quantityOnHand ?? 0,
    }));

    const uniqueData = Array.from(new Map(mappedData.map((item) => [item.id, item])).values());

    return { data: uniqueData, total: uniqueData.length };
  }

  // ── Purchase Orders ────────────────────────────────────────────────────────
  async createPurchaseOrder(dto: CreatePurchaseOrderDto, raisedById: string) {
    const poNumber = `PO-${Date.now().toString(36).toUpperCase()}`;

    const subtotal = dto.items.reduce(
      (sum, i) => sum + i.unitCostPesewas * i.quantityOrdered, 0,
    );

    return this.db.transaction(async (tx) => {
      const [po] = await tx.insert(purchaseOrders).values({
        poNumber,
        storeId: dto.storeId,
        supplierId: dto.supplierId,
        raisedById,
        approvedById: dto.approvedById,
        subtotalPesewas: subtotal,
        totalPesewas: subtotal,
        paidAmountPesewas: 0,
        balancePesewas: subtotal,
        paymentStatus: 'pending',
        notes: dto.notes,
        expectedDeliveryDate: dto.expectedDeliveryDate,
      }).returning();

      const insertedItems = await tx.insert(purchaseItems).values(
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
      ).returning();

      return { ...po, items: insertedItems };
    });
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

    await this.db.transaction(async (tx) => {
      for (const received of dto.items) {
        const [poItem] = await tx
          .select()
          .from(purchaseItems)
          .where(eq(purchaseItems.id, received.purchaseItemId))
          .limit(1);

        if (!poItem) continue;

        await tx
          .update(purchaseItems)
          .set({ quantityReceived: sql`${purchaseItems.quantityReceived} + ${received.quantityReceived}` })
          .where(eq(purchaseItems.id, received.purchaseItemId));

        const [batch] = await tx.insert(stockBatches).values({
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

        const [existing] = await tx
          .select()
          .from(stockItems)
          .where(and(eq(stockItems.productId, poItem.productId), eq(stockItems.storeId, po.storeId)))
          .limit(1);

        const qtyBefore = existing?.quantityOnHand ?? 0;
        const qtyAfter = qtyBefore + received.quantityReceived;

        if (existing) {
          await tx
            .update(stockItems)
            .set({ quantityOnHand: qtyAfter, lastMovementAt: new Date(), updatedAt: new Date() })
            .where(and(eq(stockItems.productId, poItem.productId), eq(stockItems.storeId, po.storeId)));
        } else {
          await tx.insert(stockItems).values({
            productId: poItem.productId,
            storeId: po.storeId,
            quantityOnHand: qtyAfter,
            lastMovementAt: new Date(),
          });
        }

        await tx.insert(stockMovements).values({
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

      const allItems = await tx
        .select()
        .from(purchaseItems)
        .where(eq(purchaseItems.purchaseOrderId, po.id));

      const fullyReceived = allItems.every((i) => i.quantityReceived >= i.quantityOrdered);
      const anyReceived = allItems.some((i) => i.quantityReceived > 0);

      await tx
        .update(purchaseOrders)
        .set({
          status: fullyReceived ? 'received' : anyReceived ? 'partial' : 'acknowledged',
          deliveredAt: fullyReceived ? new Date() : undefined,
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, po.id));
    });

    return { success: true, purchaseOrderId: po.id };
  }

  async payPurchaseOrder(id: string, dto: PayPurchaseOrderDto, staffId: string) {
    const [po] = await this.db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, id))
      .limit(1);

    if (!po) throw new NotFoundException('Purchase order not found');
    if (dto.amountPesewas > po.balancePesewas && po.balancePesewas > 0) {
      throw new Error(`Payment amount cannot exceed balance of ${po.balancePesewas}`);
    }

    const newPaidAmount = po.paidAmountPesewas + dto.amountPesewas;
    const newBalance = Math.max(0, po.totalPesewas - newPaidAmount);
    const newStatus = newBalance === 0 ? 'paid' : 'partial';

    return await this.db.transaction(async (tx) => {
      // 1. Update PO balances
      await tx
        .update(purchaseOrders)
        .set({
          paidAmountPesewas: newPaidAmount,
          balancePesewas: newBalance,
          paymentStatus: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, id));

      // 2. Ledger Entry (Debit AP)
      await tx.insert(ledgerEntries).values({
        storeId: po.storeId,
        entryType: 'debit',
        category: 'expense',
        amountPesewas: dto.amountPesewas,
        referenceType: 'SUPPLIER_PAYMENT',
        referenceId: dto.reference || `PAY-${Date.now().toString().slice(-6)}`,
        description: `Supplier Payment (AP Reduction) for PO ${po.poNumber} via ${dto.paymentMethod.toUpperCase()}`,
        performedById: staffId,
      });

      // 3. Ledger Entry (Credit Cash/Bank)
      await tx.insert(ledgerEntries).values({
        storeId: po.storeId,
        entryType: 'credit',
        category: 'expense',
        amountPesewas: dto.amountPesewas,
        referenceType: 'SUPPLIER_PAYMENT',
        referenceId: dto.reference || `PAY-${Date.now().toString().slice(-6)}`,
        description: `Supplier Payment (Cash Outflow) for PO ${po.poNumber} via ${dto.paymentMethod.toUpperCase()}`,
        performedById: staffId,
      });

      return {
        success: true,
        purchaseOrderId: po.id,
        paidAmountPesewas: newPaidAmount,
        balancePesewas: newBalance,
        paymentStatus: newStatus,
      };
    });
  }

  async approvePurchaseOrder(id: string, staffId: string, notes?: string) {
    const [po] = await this.db
      .update(purchaseOrders)
      .set({
        approvedById: staffId,
        status: 'submitted', // Moving from draft to submitted
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, id))
      .returning();

    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  async rejectPurchaseOrder(id: string, staffId: string, notes?: string) {
    const [po] = await this.db
      .update(purchaseOrders)
      .set({
        approvedById: null,
        status: 'cancelled', // Reverting or cancelling
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, id))
      .returning();

    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }
}
