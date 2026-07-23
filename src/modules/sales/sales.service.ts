import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, desc, sql, gte, lte, inArray } from 'drizzle-orm';
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
} from '../../database/schema';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import type { CreateSaleDto, HoldSaleDto, VoidSaleDto } from './dto/sales.dto';

@Injectable()
export class SalesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly realtime: RealtimeGateway,
  ) {}

  // ── Create Sale (the hot path — must be fast) ─────────────────────────────
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

    const taxableSubtotal = subtotal - dto.discountAmountPesewas;
    const vatAmount = Math.round(taxableSubtotal * vatRate);
    const nhilAmount = Math.round(taxableSubtotal * nhilRate);
    const getfundAmount = Math.round(taxableSubtotal * getfundRate);
    const total = taxableSubtotal + vatAmount + nhilAmount + getfundAmount;

    // Loyalty redemption value (100 points = GHS 1 = 100 pesewas)
    const loyaltyRedeemValue = dto.loyaltyPointsRedeemed;
    const finalTotal = Math.max(0, total - loyaltyRedeemValue);
    const change = Math.max(0, dto.tenderedPesewas - finalTotal);

    // Generate receipt number: JX-YYYYMMDD-XXXXX
    const receiptNumber = `JX-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    // Points earned (1 point per GHS 1 = 100 pesewas)
    const pointsEarned = dto.customerId
      ? Math.floor((finalTotal / 100) * loyaltyRate)
      : 0;

    // Insert sale
    const [sale] = await this.db.insert(sales).values({
      clientId: dto.clientId,
      receiptNumber,
      storeId: dto.storeId,
      cashierId,
      customerId: dto.customerId,
      shiftId: dto.shiftId,
      status: 'completed',
      paymentStatus: 'paid',
      subtotalPesewas: subtotal,
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

    // Insert sale items + deduct stock
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

    await this.db.insert(saleItems).values(itemInserts);

    // Insert payment record(s)
    if (dto.tenderType === 'split' && dto.tenderBreakdown.length > 0) {
      await this.db.insert(payments).values(
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
      await this.db.insert(payments).values({
        saleId: sale.id,
        storeId: dto.storeId,
        method: dto.tenderType as any,
        amountPesewas: finalTotal,
        reference: dto.momoReference ?? dto.cardReference,
        status: 'paid',
      });
    }

    // Deduct stock for each item
    for (const item of dto.items) {
      const [stockItem] = await this.db
        .select()
        .from(stockItems)
        .where(and(eq(stockItems.productId, item.productId), eq(stockItems.storeId, dto.storeId)))
        .limit(1);

      const qtyBefore = stockItem?.quantityOnHand ?? 0;
      const qtyAfter = Math.max(0, qtyBefore - item.quantity);

      await this.db
        .update(stockItems)
        .set({ quantityOnHand: qtyAfter, lastMovementAt: new Date(), updatedAt: new Date() })
        .where(and(eq(stockItems.productId, item.productId), eq(stockItems.storeId, dto.storeId)));

      await this.db.insert(stockMovements).values({
        productId: item.productId,
        storeId: dto.storeId,
        batchId: item.batchId,
        type: 'sale_out',
        quantityChange: -item.quantity,
        quantityBefore: qtyBefore,
        quantityAfter: qtyAfter,
        referenceType: 'sale',
        referenceId: sale.id,
        performedById: cashierId,
      });

      // Decrement batch quantity if batchId provided
      if (item.batchId) {
        await this.db
          .update(stockBatches)
          .set({ quantityRemaining: sql`${stockBatches.quantityRemaining} - ${item.quantity}` })
          .where(eq(stockBatches.id, item.batchId));
      }
    }

    // Ledger entry for revenue
    await this.db.insert(ledgerEntries).values({
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

    // Loyalty points
    if (dto.customerId && pointsEarned > 0) {
      const [customer] = await this.db
        .select({ loyaltyPoints: customers.loyaltyPoints })
        .from(customers)
        .where(eq(customers.id, dto.customerId))
        .limit(1);

      const newBalance = (customer?.loyaltyPoints ?? 0) + pointsEarned - dto.loyaltyPointsRedeemed;

      await this.db
        .update(customers)
        .set({
          loyaltyPoints: newBalance,
          totalSpendPesewas: sql`${customers.totalSpendPesewas} + ${finalTotal}`,
          visitCount: sql`${customers.visitCount} + 1`,
          lastVisitAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(customers.id, dto.customerId));

      await this.db.insert(loyaltyTransactions).values({
        customerId: dto.customerId,
        saleId: sale.id,
        pointsDelta: pointsEarned,
        balanceAfter: newBalance,
        reason: `Sale ${receiptNumber}`,
      });
    }

    // Broadcast realtime event
    this.realtime.broadcastToStore(dto.storeId, 'sale:completed', {
      saleId: sale.id,
      receiptNumber,
      totalPesewas: finalTotal,
      cashierId,
    });

    return { sale, alreadyExisted: false };
  }

  // ── Get Sale ──────────────────────────────────────────────────────────────
  async getSaleById(id: string) {
    const [sale] = await this.db
      .select()
      .from(sales)
      .where(eq(sales.id, id))
      .limit(1);
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
    query: PaginationDto & { from?: string; to?: string; cashierId?: string; status?: string },
  ) {
    const { page, limit, from, to, cashierId: cId, status } = query;
    const offset = (page - 1) * limit;

    const conditions = [eq(sales.storeId, storeId)];
    if (from) conditions.push(gte(sales.createdAt, new Date(from)));
    if (to) conditions.push(lte(sales.createdAt, new Date(to)));
    if (cId) conditions.push(eq(sales.cashierId, cId));
    if (status) conditions.push(eq(sales.status, status as any));

    const where = and(...conditions);

    const [data, [{ count }]] = await Promise.all([
      this.db.select().from(sales).where(where).orderBy(desc(sales.createdAt)).limit(limit).offset(offset),
      this.db.select({ count: sql<number>`count(*)` }).from(sales).where(where),
    ]);

    return paginate(data, Number(count), page, limit);
  }

  // ── Hold Sale ─────────────────────────────────────────────────────────────
  async holdSale(dto: HoldSaleDto) {
    const [sale] = await this.db
      .update(sales)
      .set({ status: 'held', heldAt: new Date(), heldNote: dto.heldNote, updatedAt: new Date() })
      .where(eq(sales.id, dto.saleId))
      .returning();
    return sale;
  }

  // ── Void Sale ─────────────────────────────────────────────────────────────
  async voidSale(dto: VoidSaleDto, staffId: string) {
    const [sale] = await this.db
      .select()
      .from(sales)
      .where(eq(sales.id, dto.saleId))
      .limit(1);

    if (!sale) throw new NotFoundException('Sale not found');
    if (sale.status === 'voided') throw new ConflictException('Sale already voided');

    // Restore stock for each item
    const items = await this.db
      .select()
      .from(saleItems)
      .where(eq(saleItems.saleId, dto.saleId));

    for (const item of items) {
      await this.db
        .update(stockItems)
        .set({
          quantityOnHand: sql`${stockItems.quantityOnHand} + ${item.quantity}`,
          updatedAt: new Date(),
        })
        .where(and(eq(stockItems.productId, item.productId), eq(stockItems.storeId, sale.storeId)));

      await this.db.insert(stockMovements).values({
        productId: item.productId,
        storeId: sale.storeId,
        type: 'return_in',
        quantityChange: item.quantity,
        quantityBefore: 0, // approximate
        quantityAfter: item.quantity,
        referenceType: 'void',
        referenceId: sale.id,
        performedById: staffId,
        notes: `Void: ${dto.reason}`,
      });
    }

    const [updated] = await this.db
      .update(sales)
      .set({ status: 'voided', updatedAt: new Date(), notes: dto.reason })
      .where(eq(sales.id, dto.saleId))
      .returning();

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
      .orderBy(desc(sales.heldAt));
  }
}
