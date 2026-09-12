import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, desc, sql, gte, lte, inArray, ne, ilike } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import {
  sales,
  saleItems,
  payments,
  products,
  stockItems,
  stockMovements,
  stockBatches,
  customers,
  loyaltyTransactions,
  ledgerEntries,
  organisation,
  auditLogs,
} from '../../database/schema';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import type { CreateSaleDto, HoldSaleDto, VoidSaleDto } from './dto/sales.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class SalesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly realtime: RealtimeGateway,
  ) {}

  // ── Create Sale (the hot path — must be fast & atomic) ─────────────────────
  async createSale(dto: CreateSaleDto, cashierId: string) {
    // Idempotency: reject duplicate clientId
    const [existing] = await this.db
      .select({ id: sales.id })
      .from(sales)
      .where(eq(sales.clientId, dto.clientId))
      .limit(1);

    if (existing) {
      // Return already-created sale (safe for offline re-sync)
      const [sale] = await this.db
        .select()
        .from(sales)
        .where(eq(sales.id, existing.id))
        .limit(1);
      return { sale, alreadyExisted: true };
    }

    // Load org config for tax rates
    const [org] = await this.db.select().from(organisation).limit(1);
    const vatRate = (org?.vatRateBps ?? 1500) / 10000;
    const nhilRate = (org?.nhilRateBps ?? 250) / 10000;
    const getfundRate = (org?.getfundRateBps ?? 250) / 10000;
    const loyaltyRate = org?.loyaltyPointsPerGhs ?? 1;

    // Compute line totals
    let subtotal = 0;
    for (const item of dto.items) {
      const lineTotal = item.unitPricePesewas * item.quantity - item.discountAmountPesewas;
      subtotal += lineTotal;
    }

    if (dto.discountAmountPesewas > subtotal) {
      throw new BadRequestException('Discount exceeds sale subtotal');
    }
    if (dto.loyaltyPointsRedeemed > 0 && !dto.customerId) {
      throw new BadRequestException('Loyalty points can only be redeemed against a customer');
    }

    // Prices are tax-inclusive (Ghana retail norm): the amount the cashier
    // collects already contains VAT + NHIL + GETFund. Extract the components
    // instead of adding them on top.
    // Ghana stacking: levies apply to the base, VAT applies to (base + levies):
    //   total = base × (1 + nhil + getfund) × (1 + vat)
    const taxableTotal = Math.max(0, subtotal - dto.discountAmountPesewas);
    const levyRate = nhilRate + getfundRate;
    const taxableBase = Math.round(taxableTotal / ((1 + levyRate) * (1 + vatRate)));
    const nhilAmount = Math.round(taxableBase * nhilRate);
    const getfundAmount = Math.round(taxableBase * getfundRate);
    // VAT absorbs any rounding remainder so the parts always sum to the total
    const vatAmount = Math.max(0, taxableTotal - taxableBase - nhilAmount - getfundAmount);
    const total = taxableTotal;

    // Loyalty redemption value (1 point = 1 pesewa — treated as a tender)
    const loyaltyRedeemValue = dto.loyaltyPointsRedeemed;
    const finalTotal = Math.max(0, total - loyaltyRedeemValue);

    // Cash and split tenders must physically cover the bill.
    // (MoMo/card reference tenders send tendered == total.)
    if (dto.tenderedPesewas < finalTotal) {
      throw new BadRequestException(
        `Insufficient tender: received ${dto.tenderedPesewas} pesewas, required ${finalTotal}`,
      );
    }
    if (dto.tenderType === 'split' && dto.tenderBreakdown.length > 0) {
      const breakdownSum = dto.tenderBreakdown.reduce((s, t) => s + t.amountPesewas, 0);
      if (breakdownSum < finalTotal) {
        throw new BadRequestException('Split tender breakdown does not cover the sale total');
      }
    }
    const change = Math.max(0, dto.tenderedPesewas - finalTotal);

    // Generate receipt number: JX-YYYYMMDD-XXXXXXXXXX
    // Uses crypto.randomBytes for collision-resistant uniqueness (10 hex chars = 40 bits)
    const receiptNumber = `JX-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(5).toString('hex').toUpperCase()}`;

    // Points earned (1 point per GHS 1 = 100 pesewas)
    const pointsEarned = dto.customerId
      ? Math.floor((finalTotal / 100) * loyaltyRate)
      : 0;

    const createdSale = await this.db.transaction(async (tx) => {
      const [sale] = await tx.insert(sales).values({
        clientId: dto.clientId,
        receiptNumber,
        storeId: dto.storeId,
        cashierId,
        customerId: dto.customerId,
        shiftId: dto.shiftId,
        status: 'completed',
        paymentStatus: 'paid',
        subtotalPesewas: taxableBase,
        discountAmountPesewas: dto.discountAmountPesewas,
        vatAmountPesewas: vatAmount,
        nhilAmountPesewas: nhilAmount,
        getfundAmountPesewas: getfundAmount,
        totalPesewas: finalTotal,
        tenderedPesewas: dto.tenderedPesewas,
        changePesewas: change,
        tenderType: dto.tenderType,
        tenderBreakdown: dto.tenderBreakdown,
        momoReference: dto.momoReference,
        cardReference: dto.cardReference,
        loyaltyPointsEarned: pointsEarned,
        loyaltyPointsRedeemed: dto.loyaltyPointsRedeemed,
        loyaltyRedeemValuePesewas: loyaltyRedeemValue,
        discountAuthorizedById: dto.discountAuthorizedById,
        createdOffline: dto.createdOffline,
        syncedAt: dto.createdOffline ? null : new Date(),
        notes: dto.notes,
        completedAt: new Date(),
      }).returning();

      await tx.insert(auditLogs).values({
        staffId: cashierId,
        storeId: dto.storeId,
        action: 'SALE_COMPLETED',
        entityType: 'sale',
        entityId: sale.id,
        newData: { totalPesewas: finalTotal, receiptNumber },
      });

      const itemInserts = dto.items.map((item) => ({
        saleId: sale.id,
        productId: item.productId,
        batchId: item.batchId,
        quantity: item.quantity,
        unitPricePesewas: item.unitPricePesewas,
        discountAmountPesewas: item.discountAmountPesewas,
        lineTotalPesewas: item.unitPricePesewas * item.quantity - item.discountAmountPesewas,
        productNameSnapshot: item.productNameSnapshot,
        productSkuSnapshot: item.productSkuSnapshot,
      }));

      await tx.insert(saleItems).values(itemInserts);

      if (dto.tenderType === 'split' && dto.tenderBreakdown.length > 0) {
        await tx.insert(payments).values(
          dto.tenderBreakdown.map((t) => ({
            saleId: sale.id,
            storeId: dto.storeId,
            method: t.type as any,
            amountPesewas: t.amountPesewas,
            reference: t.reference,
            status: 'paid' as const,
          })),
        );
      } else {
        await tx.insert(payments).values({
          saleId: sale.id,
          storeId: dto.storeId,
          method: dto.tenderType as any,
          amountPesewas: finalTotal,
          reference: dto.momoReference ?? dto.cardReference,
          status: 'paid',
        });
      }

      // ── Batch stock operations (eliminates N+1 inside transaction) ──────────
      // Aggregate quantities per product — duplicate lines must not each
      // validate/decrement against the same snapshot independently.
      const qtyByProduct = new Map<string, number>();
      const qtyByBatch = new Map<string, number>();
      for (const item of dto.items) {
        qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + item.quantity);
        if (item.batchId) qtyByBatch.set(item.batchId, (qtyByBatch.get(item.batchId) ?? 0) + item.quantity);
      }

      // 1. Lock all stock rows for all products in one query
      const productIds = [...qtyByProduct.keys()];
      const lockedStockRows = await tx
        .select()
        .from(stockItems)
        .where(and(inArray(stockItems.productId, productIds), eq(stockItems.storeId, dto.storeId)))
        .for('update');

      const stockMap = new Map(lockedStockRows.map((s) => [s.productId, s]));

      // 2. Validate all stock levels upfront (against aggregated demand)
      for (const [productId, totalQty] of qtyByProduct) {
        const stockItem = stockMap.get(productId);
        if (!stockItem) {
          throw new NotFoundException(`Stock record not found for product ${productId}`);
        }
        if (stockItem.quantityOnHand < totalQty) {
          throw new ConflictException(`Insufficient stock for product ${productId}`);
        }
      }

      // 3. Collect cost prices for all items (batch lookup for non-batch items)
      const costPriceMap = new Map<string, number | null>();
      const itemsWithoutBatch = dto.items.filter((i) => !i.batchId);
      if (itemsWithoutBatch.length > 0) {
        const noBatchProductIds = itemsWithoutBatch.map((i) => i.productId);
        const latestBatches = await tx
          .select({
            productId: stockBatches.productId,
            costPricePesewas: stockBatches.costPricePesewas,
          })
          .from(stockBatches)
          .where(and(
            inArray(stockBatches.productId, noBatchProductIds),
            eq(stockBatches.storeId, dto.storeId),
            eq(stockBatches.isActive, true),
          ))
          .orderBy(desc(stockBatches.receivedAt));

        for (const b of latestBatches) {
          if (!costPriceMap.has(b.productId)) costPriceMap.set(b.productId, b.costPricePesewas);
        }
      }

      // 4. Update batch quantities (aggregated per batch, scoped to store)
      const batchUpdates: Promise<any>[] = [];
      const batchCostPrices = new Map<string, number>();
      const batchIds = [...qtyByBatch.keys()];
      if (batchIds.length > 0) {
        // Scope to this store's batches — a batchId from another store/product
        // must not be decremented.
        const validBatches = await tx
          .select({ id: stockBatches.id, productId: stockBatches.productId })
          .from(stockBatches)
          .where(and(inArray(stockBatches.id, batchIds), eq(stockBatches.storeId, dto.storeId)));
        const validBatchIds = new Set(validBatches.map((b) => b.id));
        for (const batchId of batchIds) {
          if (!validBatchIds.has(batchId)) {
            throw new NotFoundException(`Batch ${batchId} not found in this store`);
          }
        }
        for (const [batchId, totalQty] of qtyByBatch) {
          batchUpdates.push(
            tx
              .update(stockBatches)
              .set({ quantityRemaining: sql`${stockBatches.quantityRemaining} - ${totalQty}` })
              .where(and(
                eq(stockBatches.id, batchId),
                eq(stockBatches.storeId, dto.storeId),
                gte(stockBatches.quantityRemaining, totalQty),
              ))
              .returning()
              .then(([updatedBatch]) => {
                if (!updatedBatch) throw new ConflictException(`Insufficient batch stock for ${batchId}`);
                batchCostPrices.set(updatedBatch.productId, updatedBatch.costPricePesewas);
              }),
          );
        }
      }
      await Promise.all(batchUpdates);

      // 5. Build all stock movements in memory, then insert in one query
      const movementInserts: any[] = [];
      const runningQty = new Map<string, number>();
      for (const item of dto.items) {
        const stockItem = stockMap.get(item.productId)!;
        // Track a running balance so duplicate lines get correct before/after
        const qtyBefore = runningQty.get(item.productId) ?? stockItem.quantityOnHand;
        const qtyAfter = qtyBefore - item.quantity;
        runningQty.set(item.productId, qtyAfter);
        const costPrice = item.batchId
          ? batchCostPrices.get(item.productId) ?? null
          : costPriceMap.get(item.productId) ?? null;

        movementInserts.push({
          productId: item.productId,
          storeId: dto.storeId,
          batchId: item.batchId,
          type: 'sale_out' as const,
          quantityChange: -item.quantity,
          quantityBefore: qtyBefore,
          quantityAfter: qtyAfter,
          referenceType: 'sale' as const,
          referenceId: sale.id,
          performedById: cashierId,
          costPricePesewas: costPrice,
        });
      }
      await tx.insert(stockMovements).values(movementInserts);

      // 6. Update all stock items — one atomic decrement per product (aggregated)
      const stockUpdatePromises = [...qtyByProduct.entries()].map(([productId, totalQty]) =>
        tx
          .update(stockItems)
          .set({
            quantityOnHand: sql`${stockItems.quantityOnHand} - ${totalQty}`,
            lastMovementAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(
            eq(stockItems.productId, productId),
            eq(stockItems.storeId, dto.storeId),
            gte(stockItems.quantityOnHand, totalQty),
          )),
      );
      await Promise.all(stockUpdatePromises);

      await tx.insert(ledgerEntries).values({
        storeId: dto.storeId,
        entryType: 'credit',
        category: 'revenue',
        amountPesewas: finalTotal,
        vatAmountPesewas: vatAmount,
        nhilAmountPesewas: nhilAmount,
        getfundAmountPesewas: getfundAmount,
        description: `Sale ${receiptNumber}`,
        referenceType: 'sale',
        referenceId: sale.id,
        performedById: cashierId,
      });

      if (dto.customerId && (pointsEarned > 0 || dto.loyaltyPointsRedeemed > 0)) {
        const [customer] = await tx
          .select({ loyaltyPoints: customers.loyaltyPoints })
          .from(customers)
          .where(eq(customers.id, dto.customerId))
          .for('update')
          .limit(1);

        if (!customer) throw new NotFoundException('Customer not found');
        if (dto.loyaltyPointsRedeemed > customer.loyaltyPoints) {
          throw new BadRequestException(
            `Insufficient loyalty points: customer has ${customer.loyaltyPoints}, tried to redeem ${dto.loyaltyPointsRedeemed}`,
          );
        }

        const newBalance = customer.loyaltyPoints + pointsEarned - dto.loyaltyPointsRedeemed;

        await tx
          .update(customers)
          .set({
            loyaltyPoints: newBalance,
            totalSpendPesewas: sql`${customers.totalSpendPesewas} + ${finalTotal}`,
            visitCount: sql`${customers.visitCount} + 1`,
            lastVisitAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(customers.id, dto.customerId));

        await tx.insert(loyaltyTransactions).values({
          customerId: dto.customerId,
          saleId: sale.id,
          pointsDelta: pointsEarned,
          balanceAfter: newBalance,
          reason: `Sale ${receiptNumber}`,
        });
      }

      return sale;
    });

    this.realtime.broadcastToStore(dto.storeId, 'sale:completed', {
      saleId: createdSale.id,
      receiptNumber,
      totalPesewas: finalTotal,
      cashierId,
    });

    return { sale: createdSale, alreadyExisted: false };
  }

  // ── Get Sale ──────────────────────────────────────────────────────────────
  async getSaleById(id: string, storeId?: string) {
    const sale = await this.db.query.sales.findFirst({
      where: storeId ? and(eq(sales.id, id), eq(sales.storeId, storeId)) : eq(sales.id, id),
      with: { cashier: true },
    });
    if (!sale) throw new NotFoundException('Sale not found');

    const items = await this.db
      .select()
      .from(saleItems)
      .where(eq(saleItems.saleId, id));

    return { ...sale, items };
  }

  // ── List Sales ────────────────────────────────────────────────────────────
  async listSales(
    storeId: string,
    query: PaginationDto & { from?: string; to?: string; cashierId?: string; status?: string; search?: string },
  ) {
    const { page, limit, from, to, cashierId: cId, status, search } = query;
    const offset = (page - 1) * limit;

    const conditions = [eq(sales.storeId, storeId)];
    if (from) conditions.push(gte(sales.createdAt, new Date(from)));
    if (to) conditions.push(lte(sales.createdAt, new Date(to)));
    if (cId) conditions.push(eq(sales.cashierId, cId));
    if (status) conditions.push(eq(sales.status, status as any));
    if (search) conditions.push(ilike(sales.receiptNumber, `%${search}%`));

    const where = and(...conditions);

    const [data, [{ count }]] = await Promise.all([
      this.db.query.sales.findMany({
        where,
        with: { cashier: true },
        orderBy: [desc(sales.createdAt)],
        limit,
        offset,
      }),
      this.db.select({ count: sql<number>`count(*)` }).from(sales).where(where),
    ]);

    return paginate(data, Number(count), page, limit);
  }

  // ── Hold Sale ─────────────────────────────────────────────────────────────
  async holdSale(dto: HoldSaleDto, staffId: string, storeId: string) {
    const [sale] = await this.db
      .update(sales)
      .set({ status: 'held', heldAt: new Date(), heldNote: dto.heldNote, updatedAt: new Date() })
      // Only in-progress sales can be held — holding a completed sale would
      // hide collected revenue from reports while stock stays decremented.
      .where(and(eq(sales.id, dto.saleId), eq(sales.storeId, storeId), eq(sales.status, 'in_progress')))
      .returning();

    if (!sale) throw new NotFoundException('In-progress sale not found in this store');

    await this.db.insert(auditLogs).values({
      staffId,
      storeId: sale.storeId,
      action: 'SALE_HELD',
      entityType: 'sale',
      entityId: sale.id,
      newData: { heldNote: dto.heldNote },
    });

    return sale;
  }

  // ── Void Sale ─────────────────────────────────────────────────────────────
  async voidSale(dto: VoidSaleDto, staffId: string, storeId: string) {
    const [sale] = await this.db
      .select()
      .from(sales)
      .where(and(eq(sales.id, dto.saleId), eq(sales.storeId, storeId)))
      .limit(1);

    if (!sale) throw new NotFoundException('Sale not found');
    // Refunded sales already restocked via refund flow — voiding them would
    // double-restore stock. Void only completed sales.
    if (sale.status === 'refunded' || sale.status === 'partially_refunded') {
      throw new ConflictException('Cannot void a refunded sale — stock was already restored via refund');
    }

    const updated = await this.db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(sales)
        .where(and(eq(sales.id, dto.saleId), ne(sales.status, 'voided')))
        .for('update')
        .limit(1);

      if (!locked) throw new ConflictException('Sale already voided');

      const items = await tx
        .select()
        .from(saleItems)
        .where(eq(saleItems.saleId, dto.saleId));

      // ── Batch stock operations (eliminates N+1 inside transaction) ──────────
      const qtyByProduct = new Map<string, number>();
      const qtyByBatch = new Map<string, number>();
      for (const item of items) {
        qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + item.quantity);
        if (item.batchId) qtyByBatch.set(item.batchId, (qtyByBatch.get(item.batchId) ?? 0) + item.quantity);
      }

      const productIds = [...qtyByProduct.keys()];
      const lockedStockRows = await tx
        .select()
        .from(stockItems)
        .where(and(inArray(stockItems.productId, productIds), eq(stockItems.storeId, sale.storeId)))
        .for('update');

      const stockMap = new Map(lockedStockRows.map((s) => [s.productId, s]));

      // Validate all stock records exist
      for (const productId of qtyByProduct.keys()) {
        if (!stockMap.has(productId)) {
          throw new NotFoundException(`Stock record not found for product ${productId}`);
        }
      }

      // Build all stock movements in memory, then insert in one query
      const movementInserts: any[] = [];
      const runningQty = new Map<string, number>();
      for (const item of items) {
        const stockItem = stockMap.get(item.productId)!;
        const qtyBefore = runningQty.get(item.productId) ?? stockItem.quantityOnHand;
        const qtyAfter = qtyBefore + item.quantity;
        runningQty.set(item.productId, qtyAfter);

        movementInserts.push({
          productId: item.productId,
          storeId: sale.storeId,
          batchId: item.batchId,
          type: 'return_in' as const,
          quantityChange: item.quantity,
          quantityBefore: qtyBefore,
          quantityAfter: qtyAfter,
          referenceType: 'void' as const,
          referenceId: sale.id,
          performedById: staffId,
          notes: `Void: ${dto.reason}`,
        });
      }
      await tx.insert(stockMovements).values(movementInserts);

      // Restore stock items (aggregated atomic increments)
      const stockUpdatePromises = [...qtyByProduct.entries()].map(([productId, totalQty]) =>
        tx
          .update(stockItems)
          .set({
            quantityOnHand: sql`${stockItems.quantityOnHand} + ${totalQty}`,
            lastMovementAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(eq(stockItems.productId, productId), eq(stockItems.storeId, sale.storeId))),
      );
      await Promise.all(stockUpdatePromises);

      // Restore batch quantities for items that had a batch
      const batchRestorePromises = [...qtyByBatch.entries()].map(([batchId, totalQty]) =>
        tx
          .update(stockBatches)
          .set({ quantityRemaining: sql`${stockBatches.quantityRemaining} + ${totalQty}` })
          .where(and(eq(stockBatches.id, batchId), eq(stockBatches.storeId, sale.storeId))),
      );
      await Promise.all(batchRestorePromises);

      // Reverse the revenue ledger entry — voided sales must not leave a
      // permanent credit in the books.
      await tx.insert(ledgerEntries).values({
        storeId: sale.storeId,
        entryType: 'debit',
        category: 'revenue',
        amountPesewas: sale.totalPesewas,
        vatAmountPesewas: sale.vatAmountPesewas,
        nhilAmountPesewas: sale.nhilAmountPesewas,
        getfundAmountPesewas: sale.getfundAmountPesewas,
        description: `VOID Sale ${sale.receiptNumber}: ${dto.reason}`,
        referenceType: 'void',
        referenceId: sale.id,
        performedById: staffId,
      });

      // Mark the sale's payments as refunded so payment reconciliations don't
      // count money that was handed back.
      await tx
        .update(payments)
        .set({ status: 'refunded' })
        .where(eq(payments.saleId, sale.id));

      // Reverse loyalty effects — remove earned points, return redeemed points
      if (sale.customerId && (sale.loyaltyPointsEarned > 0 || sale.loyaltyPointsRedeemed > 0)) {
        const [customer] = await tx
          .select({ loyaltyPoints: customers.loyaltyPoints })
          .from(customers)
          .where(eq(customers.id, sale.customerId))
          .for('update')
          .limit(1);

        if (customer) {
          const reversalBalance = customer.loyaltyPoints - sale.loyaltyPointsEarned + sale.loyaltyPointsRedeemed;
          await tx
            .update(customers)
            .set({
              loyaltyPoints: Math.max(0, reversalBalance),
              totalSpendPesewas: sql`GREATEST(0, ${customers.totalSpendPesewas} - ${sale.totalPesewas})`,
              visitCount: sql`GREATEST(0, ${customers.visitCount} - 1)`,
              updatedAt: new Date(),
            })
            .where(eq(customers.id, sale.customerId));

          await tx.insert(loyaltyTransactions).values({
            customerId: sale.customerId,
            saleId: sale.id,
            pointsDelta: sale.loyaltyPointsRedeemed - sale.loyaltyPointsEarned,
            balanceAfter: Math.max(0, reversalBalance),
            reason: `Void of sale ${sale.receiptNumber}`,
          });
        }
      }

      const [updatedSale] = await tx
        .update(sales)
        .set({ status: 'voided', paymentStatus: 'refunded', updatedAt: new Date(), notes: dto.reason })
        .where(eq(sales.id, dto.saleId))
        .returning();

      await tx.insert(auditLogs).values({
        staffId,
        storeId: sale.storeId,
        action: 'SALE_VOIDED',
        entityType: 'sale',
        entityId: sale.id,
        newData: { reason: dto.reason, authorizedById: dto.authorizedById },
      });

      return updatedSale;
    });

    this.realtime.broadcastToStore(sale.storeId, 'sale:voided', {
      saleId: sale.id,
      receiptNumber: sale.receiptNumber,
      voidedById: staffId,
    });

    return updated;
  }

  // ── Mark receipt printed ───────────────────────────────────────────────────
  async markReceiptPrinted(saleId: string) {
    const [sale] = await this.db
      .update(sales)
      .set({ receiptPrinted: true, receiptPrintedAt: new Date() })
      .where(eq(sales.id, saleId))
      .returning();
    return sale;
  }

  // ── Held sales list ────────────────────────────────────────────────────────
  async getHeldSales(storeId: string) {
    return this.db
      .select()
      .from(sales)
      .where(and(eq(sales.storeId, storeId), eq(sales.status, 'held')))
      .orderBy(desc(sales.heldAt))
      .limit(100);
  }
}
