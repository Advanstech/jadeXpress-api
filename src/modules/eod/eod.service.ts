import { Injectable, Inject, NotFoundException, ConflictException, BadRequestException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { eq, and, gte, lte, lt, desc, sql, inArray } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { eodRecords, eodShifts, sales, refundRequests, expenses, auditLogs, staffProfile } from '../../database/schema';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import type { InitEodDto, CloseEodDto, CloseShiftDto, ListShiftsDto } from './dto/eod.dto';

function isManager(role?: string) {
  return ['manager', 'supervisor', 'owner', 'root', 'super_admin', 'head_pharmacist'].includes((role || '').toLowerCase());
}

const todayStr = () => new Date().toISOString().split('T')[0];

@Injectable()
export class EodService implements OnModuleInit, OnModuleDestroy {
  private sweepTimer?: NodeJS.Timeout;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly realtime: RealtimeGateway,
  ) {}

  // Auto-close sweep — runs every 5 min. Closes shifts left open from past
  // business dates, and today's shifts once it is 23:55 or later (≈11:59pm
  // cutoff the business asked for, with a small buffer so the interval can't
  // miss it). Forgotten shifts land in pending_approval for authorization.
  onModuleInit() {
    this.sweepTimer = setInterval(() => {
      this.autoCloseStaleShifts().catch((e) =>
        console.error('[EOD] auto-close sweep failed', e),
      );
    }, 5 * 60 * 1000);
    this.autoCloseStaleShifts().catch(() => {});
  }

  onModuleDestroy() {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

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

  async rejectEod(id: string, rejectedById: string, storeId: string, reason?: string) {
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
      newData: {
        businessDate: eod.businessDate,
        cashVariance: eod.cashVariance,
        momoVariance: eod.momoVariance,
        reason: reason ?? null,
      },
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

  // ── Per-staff shifts ────────────────────────────────────────────────────────

  /**
   * System totals for ONE staff member's day — same math as the store-level
   * computation, filtered to sales.cashierId / refunds initiatedById.
   */
  private async computeStaffTotals(storeId: string, businessDate: string, staffId: string) {
    const dayStart = new Date(`${businessDate}T00:00:00.000Z`);
    const dayEnd = new Date(`${businessDate}T23:59:59.999Z`);

    const [totals] = await this.db
      .select({
        systemTotal: sql<number>`coalesce(sum(${sales.totalPesewas}), 0)`,
        systemSaleCount: sql<number>`count(*)`,
        systemCashTotal: sql<number>`coalesce(sum(case when ${sales.tenderType} = 'cash' then ${sales.totalPesewas} else 0 end), 0)`,
        systemMomoTotal: sql<number>`coalesce(sum(case when ${sales.tenderType} = 'momo' then ${sales.totalPesewas} else 0 end), 0)`,
        systemCardTotal: sql<number>`coalesce(sum(case when ${sales.tenderType} = 'card' then ${sales.totalPesewas} else 0 end), 0)`,
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
        eq(sales.cashierId, staffId),
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
        eq(refundRequests.initiatedById, staffId),
        eq(refundRequests.status, 'approved'),
        gte(refundRequests.processedAt, dayStart),
        lte(refundRequests.processedAt, dayEnd),
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
    };
  }

  /**
   * Activate today's shift for a staff member — called on login. Idempotent:
   * in_progress/pending/completed records are returned untouched; rejected
   * shifts reopen so the cashier can work again.
   */
  async activateShift(storeId: string, staffId: string) {
    const businessDate = todayStr();
    const [existing] = await this.db
      .select()
      .from(eodShifts)
      .where(and(
        eq(eodShifts.storeId, storeId),
        eq(eodShifts.staffId, staffId),
        eq(eodShifts.businessDate, businessDate),
      ))
      .limit(1);

    if (existing) {
      if (existing.status === 'rejected') {
        const [reopened] = await this.db
          .update(eodShifts)
          .set({
            status: 'in_progress',
            physicalCashCount: 0,
            denominations: [],
            momoConfirmed: 0,
            cashVariance: 0,
            momoVariance: 0,
            varianceNotes: null,
            autoClosed: false,
            closedById: null,
            closedAt: null,
            approvedById: null,
            approvedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(eodShifts.id, existing.id))
          .returning();
        return reopened;
      }
      return existing;
    }

    const totals = await this.computeStaffTotals(storeId, businessDate, staffId);
    const [shift] = await this.db.insert(eodShifts).values({
      storeId,
      staffId,
      businessDate,
      status: 'in_progress',
      systemCashTotal: totals.systemCashTotal,
      systemMomoTotal: totals.systemMomoTotal,
      systemCardTotal: totals.systemCardTotal,
      systemTotal: totals.systemTotal,
      systemSaleCount: totals.systemSaleCount,
      systemRefundTotal: totals.systemRefundTotal,
    }).returning();
    return shift;
  }

  /** My shift for today with LIVE totals merged in (not the stale snapshot). */
  async getMyShift(storeId: string, staffId: string) {
    const businessDate = todayStr();
    const [shift] = await this.db
      .select()
      .from(eodShifts)
      .where(and(
        eq(eodShifts.storeId, storeId),
        eq(eodShifts.staffId, staffId),
        eq(eodShifts.businessDate, businessDate),
      ))
      .limit(1);

    const live = await this.computeStaffTotals(storeId, businessDate, staffId);
    if (!shift) {
      return { businessDate, status: 'none', ...live };
    }
    return { ...shift, ...live };
  }

  /**
   * Cashier closes their shift — recomputes totals so late sales aren't false
   * variances, then: manager + no discrepancy → completed immediately;
   * everyone else → pending_approval for the authorization queue.
   */
  async closeShift(storeId: string, staffId: string, dto: CloseShiftDto, role?: string) {
    const businessDate = dto.businessDate ?? todayStr();
    const [shift] = await this.db
      .select()
      .from(eodShifts)
      .where(and(
        eq(eodShifts.storeId, storeId),
        eq(eodShifts.staffId, staffId),
        eq(eodShifts.businessDate, businessDate),
      ))
      .limit(1);

    if (!shift) throw new NotFoundException('No active shift for this date — it activates on login');
    if (['completed', 'pending_approval'].includes(shift.status)) {
      throw new ConflictException(`Shift is already ${shift.status === 'completed' ? 'closed' : 'awaiting approval'}`);
    }

    const totals = await this.computeStaffTotals(storeId, businessDate, staffId);
    const expectedCash = totals.systemCashTotal - totals.systemCashRefundTotal;
    const expectedMomo = totals.systemMomoTotal - totals.systemMomoRefundTotal;
    const cashVariance = dto.physicalCashCount - expectedCash;
    const momoVariance = dto.momoConfirmed - expectedMomo;
    const hasDiscrepancy = cashVariance !== 0 || momoVariance !== 0;

    const manager = isManager(role);
    const nextStatus = manager && !hasDiscrepancy ? 'completed' : 'pending_approval';

    const [updated] = await this.db
      .update(eodShifts)
      .set({
        status: nextStatus,
        systemCashTotal: totals.systemCashTotal,
        systemMomoTotal: totals.systemMomoTotal,
        systemCardTotal: totals.systemCardTotal,
        systemTotal: totals.systemTotal,
        systemSaleCount: totals.systemSaleCount,
        systemRefundTotal: totals.systemRefundTotal,
        physicalCashCount: dto.physicalCashCount,
        denominations: dto.denominations,
        momoConfirmed: dto.momoConfirmed,
        cashVariance,
        momoVariance,
        varianceNotes: dto.varianceNotes,
        closedById: staffId,
        closedAt: new Date(),
        approvedById: nextStatus === 'completed' ? staffId : null,
        approvedAt: nextStatus === 'completed' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(eodShifts.id, shift.id))
      .returning();

    this.realtime.broadcastToStore(storeId, 'eod_shift:closed', {
      shiftId: updated.id,
      staffId,
      businessDate,
      status: updated.status,
      cashVariance,
      momoVariance,
    });

    return updated;
  }

  /**
   * Auto-close shifts that were never closed manually. Physical counts are
   * assumed to equal the system expectation (variance 0) — a manager still
   * approves or rejects from the authorization queue.
   */
  private async autoCloseShift(shift: typeof eodShifts.$inferSelect) {
    const totals = await this.computeStaffTotals(shift.storeId, shift.businessDate, shift.staffId);
    const expectedCash = totals.systemCashTotal - totals.systemCashRefundTotal;
    const expectedMomo = totals.systemMomoTotal - totals.systemMomoRefundTotal;

    await this.db
      .update(eodShifts)
      .set({
        status: 'pending_approval',
        systemCashTotal: totals.systemCashTotal,
        systemMomoTotal: totals.systemMomoTotal,
        systemCardTotal: totals.systemCardTotal,
        systemTotal: totals.systemTotal,
        systemSaleCount: totals.systemSaleCount,
        systemRefundTotal: totals.systemRefundTotal,
        physicalCashCount: expectedCash,
        momoConfirmed: expectedMomo,
        cashVariance: 0,
        momoVariance: 0,
        varianceNotes: 'Auto-closed at end of day — not closed manually',
        autoClosed: true,
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(eodShifts.id, shift.id));

    this.realtime.broadcastToStore(shift.storeId, 'eod_shift:auto_closed', {
      shiftId: shift.id,
      staffId: shift.staffId,
      businessDate: shift.businessDate,
    });
  }

  async autoCloseStaleShifts() {
    const today = todayStr();
    const now = new Date();
    const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const pastCutoff = minutes >= 23 * 60 + 55; // 23:55+ — covers the 11:59pm ask

    const conditions = [
      eq(eodShifts.status, 'in_progress'),
      pastCutoff ? lte(eodShifts.businessDate, today) : lt(eodShifts.businessDate, today),
    ];

    const stale = await this.db
      .select()
      .from(eodShifts)
      .where(and(...conditions))
      .limit(200);

    for (const shift of stale) {
      await this.autoCloseShift(shift);
    }
    return { autoClosed: stale.length };
  }

  /** Paginated shift list — managers see all staff, floor staff see only their own. */
  async listShifts(storeId: string, staffId: string, role: string | undefined, query: ListShiftsDto) {
    const { page, limit } = query;
    const offset = (page - 1) * limit;

    const conditions = [eq(eodShifts.storeId, storeId)];
    if (!isManager(role)) {
      conditions.push(eq(eodShifts.staffId, staffId));
    } else if (query.staffId) {
      conditions.push(eq(eodShifts.staffId, query.staffId));
    }
    if (query.status) conditions.push(eq(eodShifts.status, query.status));
    if (query.businessDate) conditions.push(eq(eodShifts.businessDate, query.businessDate));

    const where = and(...conditions);
    const [data, [{ count }]] = await Promise.all([
      this.db
        .select({
          shift: eodShifts,
          staffFirstName: staffProfile.firstName,
          staffLastName: staffProfile.lastName,
          staffRole: staffProfile.role,
        })
        .from(eodShifts)
        .leftJoin(staffProfile, eq(eodShifts.staffId, staffProfile.id))
        .where(where)
        .orderBy(desc(eodShifts.businessDate), desc(eodShifts.openedAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ count: sql<number>`count(*)` }).from(eodShifts).where(where),
    ]);

    const mapped = data.map((r) => ({
      ...r.shift,
      staff: r.staffFirstName
        ? { firstName: r.staffFirstName, lastName: r.staffLastName, role: r.staffRole }
        : null,
    }));
    return paginate(mapped, Number(count), page, limit);
  }

  async getShift(id: string, storeId: string) {
    const [row] = await this.db
      .select({
        shift: eodShifts,
        staffFirstName: staffProfile.firstName,
        staffLastName: staffProfile.lastName,
        staffRole: staffProfile.role,
      })
      .from(eodShifts)
      .leftJoin(staffProfile, eq(eodShifts.staffId, staffProfile.id))
      .where(and(eq(eodShifts.id, id), eq(eodShifts.storeId, storeId)))
      .limit(1);
    if (!row) throw new NotFoundException('Shift record not found');

    const names = async (id?: string | null) => {
      if (!id) return null;
      const [s] = await this.db
        .select({ firstName: staffProfile.firstName, lastName: staffProfile.lastName })
        .from(staffProfile).where(eq(staffProfile.id, id)).limit(1);
      return s ?? null;
    };

    const [closedBy, approvedBy] = await Promise.all([
      names(row.shift.closedById),
      names(row.shift.approvedById),
    ]);

    return {
      ...row.shift,
      staff: row.staffFirstName
        ? { firstName: row.staffFirstName, lastName: row.staffLastName, role: row.staffRole }
        : null,
      closedBy,
      approvedBy,
    };
  }

  async approveShift(id: string, approvedById: string, storeId: string) {
    const [shift] = await this.db
      .select()
      .from(eodShifts)
      .where(and(eq(eodShifts.id, id), eq(eodShifts.storeId, storeId)))
      .limit(1);
    if (!shift) throw new NotFoundException('Shift record not found');
    if (!['pending_approval', 'discrepancy'].includes(shift.status)) {
      throw new BadRequestException('Shift is not awaiting approval');
    }

    const [updated] = await this.db
      .update(eodShifts)
      .set({ status: 'completed', approvedById, approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(eodShifts.id, id))
      .returning();

    this.realtime.broadcastToStore(storeId, 'eod_shift:approved', {
      shiftId: id,
      staffId: shift.staffId,
      businessDate: shift.businessDate,
    });
    return updated;
  }

  async rejectShift(id: string, rejectedById: string, storeId: string, reason?: string) {
    const [shift] = await this.db
      .select()
      .from(eodShifts)
      .where(and(eq(eodShifts.id, id), eq(eodShifts.storeId, storeId)))
      .limit(1);
    if (!shift) throw new NotFoundException('Shift record not found');
    if (!['pending_approval', 'discrepancy'].includes(shift.status)) {
      throw new BadRequestException('Shift is not awaiting approval');
    }

    const [updated] = await this.db
      .update(eodShifts)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(eq(eodShifts.id, id))
      .returning();

    await this.db.insert(auditLogs).values({
      staffId: rejectedById,
      storeId,
      action: 'EOD_SHIFT_REJECTED',
      entityType: 'eod_shift',
      entityId: id,
      newData: {
        staffId: shift.staffId,
        businessDate: shift.businessDate,
        cashVariance: shift.cashVariance,
        momoVariance: shift.momoVariance,
        reason: reason ?? null,
      },
    });

    this.realtime.broadcastToStore(storeId, 'eod_shift:rejected', {
      shiftId: id,
      staffId: shift.staffId,
      businessDate: shift.businessDate,
    });
    return updated;
  }
}
