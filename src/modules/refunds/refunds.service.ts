import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import {
  refundRequests,
  refundItems,
  saleItems,
  sales,
  stockItems,
  stockMovements,
  ledgerEntries,
  auditLogs,
} from '../../database/schema';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import type { CreateRefundDto } from './dto/refunds.dto';
import { JwtPayload } from '../../common/decorators/current-user.decorator';

@Injectable()
export class RefundsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly realtime: RealtimeGateway,
  ) {}

  async list(storeId: string, query: PaginationDto) {
    const { page, limit } = query;
    const offset = (page - 1) * limit;
    const where = eq(refundRequests.storeId, storeId);

    const [data, [{ count }]] = await Promise.all([
      this.db.select().from(refundRequests).where(where)
        .orderBy(desc(refundRequests.createdAt)).limit(limit).offset(offset),
      this.db.select({ count: sql<number>`count(*)` }).from(refundRequests).where(where),
    ]);
    return paginate(data, Number(count), page, limit);
  }

  async getById(id: string, storeId?: string) {
    const conditions = [eq(refundRequests.id, id)];
    if (storeId) conditions.push(eq(refundRequests.storeId, storeId));
    const [refund] = await this.db
      .select()
      .from(refundRequests)
      .where(and(...conditions))
      .limit(1);
    if (!refund) throw new NotFoundException('Refund not found');

    const items = await this.db
      .select()
      .from(refundItems)
      .where(eq(refundItems.refundRequestId, id));

    return { ...refund, items };
  }

  async create(dto: CreateRefundDto, user: JwtPayload) {
    const initiatedById = user.sub;
    const isManager = ['manager', 'owner', 'supervisor', 'root'].includes(user.role);
    // Only manager-level users can authorize a refund on the spot.
    // Non-managers must submit for approval; a manager approves later.
    const canAutoApprove = isManager;
    const status = canAutoApprove ? 'approved' : 'pending_approval';
    const authorizedById = canAutoApprove ? (dto.authorizedById || initiatedById) : null;

    const createdRefund = await this.db.transaction(async (tx) => {
      // ── Validate the sale (server-side, never trust client payload) ────────
      const [sale] = await tx
        .select()
        .from(sales)
        .where(eq(sales.id, dto.saleId))
        .for('update')
        .limit(1);

      if (!sale || sale.storeId !== dto.storeId) {
        throw new NotFoundException('Sale not found');
      }
      if (!['completed', 'partially_refunded'].includes(sale.status)) {
        throw new BadRequestException(`Sale is not refundable (status: ${sale.status})`);
      }

      const saleItemRows = await tx
        .select()
        .from(saleItems)
        .where(eq(saleItems.saleId, sale.id));
      const saleItemMap = new Map(saleItemRows.map((si) => [si.id, si]));

      // Quantities already refunded (approved or pending) per sale item
      const priorRefunded = await tx
        .select({
          saleItemId: refundItems.saleItemId,
          qty: sql<number>`coalesce(sum(${refundItems.quantity}), 0)::int`,
        })
        .from(refundItems)
        .innerJoin(refundRequests, eq(refundItems.refundRequestId, refundRequests.id))
        .where(and(eq(refundRequests.saleId, sale.id), sql`${refundRequests.status}::text <> 'rejected'`))
        .groupBy(refundItems.saleItemId);
      const priorQtyMap = new Map(priorRefunded.map((r) => [r.saleItemId, Number(r.qty)]));

      // Validate every requested line against the actual sale items and use
      // the server-side price — client-supplied unitPricePesewas is ignored.
      const validatedItems = dto.items.map((i) => {
        const si = saleItemMap.get(i.saleItemId);
        if (!si || si.productId !== i.productId) {
          throw new BadRequestException('Refund item does not belong to this sale');
        }
        const remaining = si.quantity - (priorQtyMap.get(si.id) ?? 0);
        if (i.quantity <= 0 || i.quantity > remaining) {
          throw new BadRequestException(`Refund quantity for an item exceeds the refundable amount (${remaining} left)`);
        }
        const unitPricePesewas = Math.round(si.lineTotalPesewas / si.quantity);
        return { ...i, unitPricePesewas };
      });

      const totalAmountPesewas = validatedItems.reduce(
        (sum, i) => sum + i.unitPricePesewas * i.quantity,
        0,
      );

      const [refund] = await tx.insert(refundRequests).values({
        saleId: dto.saleId,
        storeId: dto.storeId,
        initiatedById,
        authorizedById,
        reason: dto.reason,
        method: dto.method,
        status: status,
        totalAmountPesewas,
        momoReference: dto.momoReference,
        notes: dto.notes,
        processedAt: status === 'approved' ? new Date() : null,
      }).returning();

      await tx.insert(refundItems).values(
        validatedItems.map((i) => ({
          refundRequestId: refund.id,
          saleItemId: i.saleItemId,
          productId: i.productId,
          quantity: i.quantity,
          unitPricePesewas: i.unitPricePesewas,
          lineTotalPesewas: i.unitPricePesewas * i.quantity,
          restockToInventory: i.restockToInventory,
        })),
      );

      if (status === 'approved') {
        await this.executeRefundEffects(tx, refund, validatedItems, dto.storeId, initiatedById);
      }

      await tx.insert(auditLogs).values({
        staffId: initiatedById,
        storeId: dto.storeId,
        action: 'REFUND_PROCESSED',
        entityType: 'refund',
        entityId: refund.id,
        newData: { totalAmountPesewas, status },
      });

      return refund;
    });

    const result = await this.getById(createdRefund.id);

    if (status === 'approved') {
      this.realtime.broadcastToStore(dto.storeId, 'refund:completed', {
        refundId: createdRefund.id,
        saleId: dto.saleId,
        totalAmountPesewas: createdRefund.totalAmountPesewas,
      });
    }

    return result;
  }

  async approve(id: string, approvedById: string, storeId?: string) {
    const refundData = await this.getById(id, storeId);
    if (refundData.status !== 'pending_approval') {
      throw new BadRequestException('Refund is not pending approval');
    }

    await this.db.transaction(async (tx) => {
      // Lock the refund row to prevent double-processing from concurrent approvals
      const conditions = [eq(refundRequests.id, id), eq(refundRequests.status, 'pending_approval')];
      if (storeId) conditions.push(eq(refundRequests.storeId, storeId));
      const [locked] = await tx
        .select()
        .from(refundRequests)
        .where(and(...conditions))
        .for('update')
        .limit(1);

      if (!locked) {
        throw new BadRequestException('Refund is not pending approval (already processed)');
      }

      await this.executeRefundEffects(tx, locked, refundData.items, refundData.storeId, approvedById);
      
      await tx.update(refundRequests)
        .set({ 
          status: 'approved', 
          authorizedById: approvedById,
          processedAt: new Date()
        })
        .where(eq(refundRequests.id, locked.id));
    });

    this.realtime.broadcastToStore(refundData.storeId, 'refund:completed', {
      refundId: id,
      saleId: refundData.saleId,
      totalAmountPesewas: refundData.totalAmountPesewas,
    });

    return this.getById(id);
  }

  async reject(id: string, rejectedById: string, storeId?: string) {
    const refundData = await this.getById(id, storeId);
    if (refundData.status !== 'pending_approval') {
      throw new BadRequestException('Refund is not pending approval');
    }

    await this.db.update(refundRequests)
      .set({ 
        status: 'rejected',
        authorizedById: rejectedById,
        processedAt: new Date()
      })
      .where(
        and(
          eq(refundRequests.id, id),
          eq(refundRequests.status, 'pending_approval'),
        ),
      );

    return this.getById(id, storeId);
  }

  private async executeRefundEffects(tx: any, refund: any, items: any[], storeId: string, performedById: string) {
    const restockItems = items.filter((i: any) => i.restockToInventory);

    if (restockItems.length > 0) {
      // ── Batch stock operations (eliminates N+1 inside transaction) ──────────
      const productIds = restockItems.map((i: any) => i.productId);

      // Lock all existing stock rows in one query
      const existingStockRows = await tx
        .select()
        .from(stockItems)
        .where(and(inArray(stockItems.productId, productIds), eq(stockItems.storeId, storeId)))
        .for('update');

      const stockMap = new Map(existingStockRows.map((s: any) => [s.productId, s]));

      // Build all stock movements in memory
      const movementInserts: any[] = [];
      const stockUpdates: Promise<any>[] = [];
      const stockInserts: any[] = [];

      for (const item of restockItems) {
        const existing: any = stockMap.get(item.productId);
        const qtyBefore = existing?.quantityOnHand ?? 0;
        const qtyAfter = qtyBefore + item.quantity;

        movementInserts.push({
          productId: item.productId,
          storeId,
          type: 'return_in' as const,
          quantityChange: item.quantity,
          quantityBefore: qtyBefore,
          quantityAfter: qtyAfter,
          referenceType: 'refund' as const,
          referenceId: refund.id,
          performedById,
        });

        if (existing) {
          stockUpdates.push(
            tx
              .update(stockItems)
              .set({ quantityOnHand: qtyAfter, lastMovementAt: new Date(), updatedAt: new Date() })
              .where(and(eq(stockItems.productId, item.productId), eq(stockItems.storeId, storeId))),
          );
        } else {
          stockInserts.push({
            productId: item.productId,
            storeId,
            quantityOnHand: qtyAfter,
            lastMovementAt: new Date(),
          });
        }
      }

      // Batch insert all stock movements in one query
      await tx.insert(stockMovements).values(movementInserts);

      // Batch insert new stock items
      if (stockInserts.length > 0) {
        await tx.insert(stockItems).values(stockInserts);
      }

      // Run all stock updates in parallel
      await Promise.all(stockUpdates);
    }

    await tx.insert(ledgerEntries).values({
      storeId: storeId,
      entryType: 'debit',
      category: 'refund',
      amountPesewas: refund.totalAmountPesewas,
      description: `Refund for sale ${refund.saleId}`,
      referenceType: 'refund',
      referenceId: refund.id,
      performedById: performedById,
    });

    const allSaleItems = await tx
      .select()
      .from(saleItems)
      .where(eq(saleItems.saleId, refund.saleId));

    // Cumulative refunded quantities across ALL non-rejected refunds for this
    // sale — a second partial refund must count toward full-refund status.
    const cumulative = await tx
      .select({
        saleItemId: refundItems.saleItemId,
        qty: sql<number>`coalesce(sum(${refundItems.quantity}), 0)::int`,
      })
      .from(refundItems)
      .innerJoin(refundRequests, eq(refundItems.refundRequestId, refundRequests.id))
      .where(and(eq(refundRequests.saleId, refund.saleId), sql`${refundRequests.status}::text <> 'rejected'`))
      .groupBy(refundItems.saleItemId);
    const cumulativeMap = new Map(cumulative.map((r: any) => [r.saleItemId, Number(r.qty)]));

    const fullyRefunded = allSaleItems.every((si: any) => (cumulativeMap.get(si.id) ?? 0) >= si.quantity);

    await tx
      .update(sales)
      .set({
        status: fullyRefunded ? 'refunded' : 'partially_refunded',
        updatedAt: new Date(),
      })
      .where(eq(sales.id, refund.saleId));

    await tx
      .update(refundRequests)
      .set({ inventoryRestocked: true, accountingAdjusted: true })
      .where(eq(refundRequests.id, refund.id));
  }
}
