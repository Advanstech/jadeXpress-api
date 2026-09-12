import { Injectable, Inject, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { eq, and, gte, lte, desc, sql, inArray } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { eodRecords, sales, refundRequests, expenses, auditLogs } from '../../database/schema';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import type { InitEodDto, CloseEodDto } from './dto/eod.dto';

function isManager(role?: string) {
  return ['manager', 'supervisor', 'owner', 'root', 'super_admin', 'head_pharmacist'].includes((role || '').toLowerCase());
}

@Injectable()
export class EodService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * Compute system totals for a business day. Called at BOTH init and close —
   * init gives staff a live baseline, close must recompute so sales made after
   * activation aren't reported as false variances.
   */
  private async computeSystemTotals(storeId: string, businessDate: string) {
    const dayStart = new Date(`${businessDate}T00:00:00.000Z`);
    const dayEnd = new Date(`${businessDate}T23:59:59.999Z`);

    // Revenue counts completed AND partially/fully refunded sales — refunds are
    // subtracted separately via refund totals so net figures stay correct.
    const [totals] = await this.db
      .select({
        systemTotal: sql<number>`coalesce(sum(${sales.totalPesewas}), 0)`,
        systemSaleCount: sql<number>`count(*)`,
        systemCashTotal: sql<number>`coalesce(sum(case when ${sales.tenderType} = 'cash' then ${sales.totalPesewas} else 0 end), 0)`,
        systemMomoTotal: sql<number>`coalesce(sum(case when ${sales.tenderType} = 'momo' then ${sales.totalPesewas} else 0 end), 0)`,
        systemCardTotal: sql<number>`coalesce(sum(case when ${sales.tenderType} = 'card' then ${sales.totalPesewas} else 0 end), 0)`,
        // Split tenders: cash portion lives in tenderBreakdown — approximate
        // with full total on cash for now (breakdown reconciliation is per-payment rows)
        systemSplitCash: sql<number>`coalesce(sum(case when ${sales.tenderType} = 'split' then coalesce((
          select sum((tb->>'amountPesewas')::int)
          from jsonb_array_elements(${sales.tenderBreakdown}) tb
          where tb->>'type' = 'cash'
        ), 0) else 0 end), 0)`,
        systemSplitMomo: sql<number>`coalesce(sum(case when ${sales.tenderType} = 'split' then coalesce((
          select sum((tb->>'amountPesewas')::int)
          from jsonb_array_elements(${sales.tenderBreakdown}) tb
          where tb->>'type' = 'momo'
        ), 0) else 0 end), 0)`,
      })
      .from(sales)
      .where(and(
        eq(sales.storeId, storeId),
        inArray(sales.status, ['completed', 'partially_refunded', 'refunded']),
        gte(sales.createdAt, dayStart),
        lte(sales.createdAt, dayEnd),
      ));

    const [refundTotals] = await this.db
      .select({
        total: sql<number>`coalesce(sum(${refundRequests.totalAmountPesewas}), 0)`,
        cashTotal: sql<number>`coalesce(sum(case when ${refundRequests.method} = 'cash' then ${refundRequests.totalAmountPesewas} else 0 end), 0)`,
        momoTotal: sql<number>`coalesce(sum(case when ${refundRequests.method} = 'momo' then ${refundRequests.totalAmountPesewas} else 0 end), 0)`,
      })
      .from(refundRequests)
      .where(and(
        eq(refundRequests.storeId, storeId),
        eq(refundRequests.status, 'approved'),
        gte(refundRequests.processedAt, dayStart),
        lte(refundRequests.processedAt, dayEnd),
      ));

    const [expenseTotals] = await this.db
      .select({ total: sql<number>`coalesce(sum(${expenses.amountPesewas}), 0)` })
      .from(expenses)
      .where(and(
        eq(expenses.storeId, storeId),
        gte(expenses.expenseDate, dayStart),
        lte(expenses.expenseDate, dayEnd),
      ));

    return {
      systemCashTotal: Number(totals.systemCashTotal) + Number(totals.systemSplitCash),
      systemMomoTotal: Number(totals.systemMomoTotal) + Number(totals.systemSplitMomo),
      systemCardTotal: Number(totals.systemCardTotal),
      systemTotal: Number(totals.systemTotal),
      systemSaleCount: Number(totals.systemSaleCount),
      systemRefundTotal: Number(refundTotals.total),
      systemCashRefundTotal: Number(refundTotals.cashTotal),
      systemMomoRefundTotal: Number(refundTotals.momoTotal),
      systemExpenseTotal: Number(expenseTotals.total),
    };
  }

  async initEod(dto: InitEodDto, initiatedById?: string) {
    const [existing] = await this.db
      .select()
      .from(eodRecords)
      .where(and(eq(eodRecords.storeId, dto.storeId), eq(eodRecords.businessDate, dto.businessDate)))
      .limit(1);

    if (existing) {
      if (existing.status === 'completed') {
        throw new ConflictException('EOD already closed for this date');
      }
      if (existing.status === 'rejected') {
        // Rejected EODs can be reopened — a rejection means the close needs
        // correction, not that the day is permanently locked.
        const [reopened] = await this.db
          .update(eodRecords)
          .set({
            status: 'in_progress',
            initiatedById,
            openingFloat: dto.openingFloat ?? existing.openingFloat,
            // Clear the rejected close so a fresh one can be submitted
            physicalCashCount: 0,
            denominations: [],
            momoConfirmed: 0,
            cashVariance: 0,
            momoVariance: 0,
            varianceNotes: null,
            closedById: null,
            closedAt: null,
            approvedById: null,
            approvedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(eodRecords.id, existing.id))
          .returning();
        return reopened;
      }
      // in_progress / pending_approval — refresh the opening float if provided
      if (dto.openingFloat != null && existing.status === 'in_progress') {
        const [updated] = await this.db
          .update(eodRecords)
          .set({ openingFloat: dto.openingFloat, updatedAt: new Date() })
          .where(eq(eodRecords.id, existing.id))
          .returning();
        return updated;
      }
      return existing;
    }

    const totals = await this.computeSystemTotals(dto.storeId, dto.businessDate);

    const [eod] = await this.db.insert(eodRecords).values({
      storeId: dto.storeId,
      businessDate: dto.businessDate,
      status: 'in_progress',
      initiatedById,
      openingFloat: dto.openingFloat ?? 0,
      systemCashTotal: totals.systemCashTotal,
      systemMomoTotal: totals.systemMomoTotal,
      systemCardTotal: totals.systemCardTotal,
      systemTotal: totals.systemTotal,
      systemSaleCount: totals.systemSaleCount,
      systemRefundTotal: totals.systemRefundTotal,
      systemExpenseTotal: totals.systemExpenseTotal,
    }).returning();

    return eod;
  }

  async closeEod(dto: CloseEodDto, closedById: string, role?: string) {
    const [eod] = await this.db
      .select()
      .from(eodRecords)
      .where(and(eq(eodRecords.storeId, dto.storeId), eq(eodRecords.businessDate, dto.businessDate)))
      .limit(1);

    if (!eod) throw new NotFoundException('EOD record not found — call /eod/init first');
    if (['completed', 'rejected'].includes(eod.status)) throw new ConflictException('EOD already finalized');

    // Recompute system totals NOW — the init-time snapshot is stale by the end
    // of the day. Expected drawer cash = cash sales + float − cash refunds −
    // cash expenses.
    const totals = await this.computeSystemTotals(dto.storeId, dto.businessDate);

    const expectedCash = totals.systemCashTotal + eod.openingFloat
      - totals.systemCashRefundTotal - totals.systemExpenseTotal;
    const expectedMomo = totals.systemMomoTotal - totals.systemMomoRefundTotal;

    const cashVariance = dto.physicalCashCount - expectedCash;
    const momoVariance = dto.momoConfirmed - expectedMomo;
    const hasDiscrepancy = cashVariance !== 0 || momoVariance !== 0;

    // Floor staff close → pending manager approval.
    // Managers can close and approve immediately, but discrepancies still flag for review.
    const manager = isManager(role);
    const nextStatus = manager && !hasDiscrepancy ? 'completed' : 'pending_approval';

    const [updated] = await this.db
      .update(eodRecords)
      .set({
        status: nextStatus,
        // Persist recomputed totals so the record reflects close-of-day truth
        systemCashTotal: totals.systemCashTotal,
        systemMomoTotal: totals.systemMomoTotal,
        systemCardTotal: totals.systemCardTotal,
        systemTotal: totals.systemTotal,
        systemSaleCount: totals.systemSaleCount,
        systemRefundTotal: totals.systemRefundTotal,
        systemExpenseTotal: totals.systemExpenseTotal,
        physicalCashCount: dto.physicalCashCount,
        cashVariance,
        denominations: dto.denominations,
        momoConfirmed: dto.momoConfirmed,
        momoVariance,
        varianceNotes: dto.varianceNotes,
        closedById,
        closedAt: new Date(),
        approvedById: manager && !hasDiscrepancy ? closedById : null,
        approvedAt: manager && !hasDiscrepancy ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(eodRecords.id, eod.id))
      .returning();

    this.realtime.broadcastToStore(dto.storeId, 'eod:closed', {
      eodId: updated.id,
      businessDate: dto.businessDate,
      status: updated.status,
      cashVariance,
      momoVariance,
    });

    return updated;
  }

  async approveEod(id: string, approvedById: string, storeId: string) {
    const [eod] = await this.db
      .select()
      .from(eodRecords)
      .where(and(eq(eodRecords.id, id), eq(eodRecords.storeId, storeId)))
      .limit(1);

    if (!eod) throw new NotFoundException('EOD record not found');
    if (!['pending_approval', 'discrepancy'].includes(eod.status)) {
      throw new BadRequestException('EOD is not awaiting approval');
    }

    const [updated] = await this.db
      .update(eodRecords)
      .set({
        status: 'completed',
        approvedById,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(eodRecords.id, id))
      .returning();

    this.realtime.broadcastToStore(eod.storeId, 'eod:approved', {
      eodId: updated.id,
      businessDate: eod.businessDate,
      status: updated.status,
    });

    return updated;
  }

  async rejectEod(id: string, rejectedById: string, storeId: string) {
    const [eod] = await this.db
      .select()
      .from(eodRecords)
      .where(and(eq(eodRecords.id, id), eq(eodRecords.storeId, storeId)))
      .limit(1);

    if (!eod) throw new NotFoundException('EOD record not found');
    if (!['pending_approval', 'discrepancy'].includes(eod.status)) {
      throw new BadRequestException('EOD is not awaiting approval');
    }

    const [updated] = await this.db
      .update(eodRecords)
      .set({
        status: 'rejected',
        // Do NOT write the rejecter into approvedById/approvedAt — the audit
        // log records who rejected it.
        updatedAt: new Date(),
      })
      .where(eq(eodRecords.id, id))
      .returning();

    await this.db.insert(auditLogs).values({
      staffId: rejectedById,
      storeId: eod.storeId,
      action: 'EOD_REJECTED',
      entityType: 'eod_record',
      entityId: eod.id,
      newData: { businessDate: eod.businessDate, cashVariance: eod.cashVariance, momoVariance: eod.momoVariance },
    });

    this.realtime.broadcastToStore(eod.storeId, 'eod:rejected', {
      eodId: updated.id,
      businessDate: eod.businessDate,
      status: updated.status,
    });

    return updated;
  }

  async getByDate(storeId: string, date: string) {
    const [eod] = await this.db
      .select()
      .from(eodRecords)
      .where(and(eq(eodRecords.storeId, storeId), eq(eodRecords.businessDate, date)))
      .limit(1);
    if (!eod) throw new NotFoundException('No EOD record for this date');
    return eod;
  }

  async list(storeId: string, query: PaginationDto) {
    const { page, limit } = query;
    const offset = (page - 1) * limit;
    const where = eq(eodRecords.storeId, storeId);

    const [data, [{ count }]] = await Promise.all([
      this.db.select().from(eodRecords).where(where)
        .orderBy(desc(eodRecords.businessDate)).limit(limit).offset(offset),
      this.db.select({ count: sql<number>`count(*)` }).from(eodRecords).where(where),
    ]);
    return paginate(data, Number(count), page, limit);
  }
}
