import { Injectable, Inject, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { eodRecords, sales, refundRequests, expenses } from '../../database/schema';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import type { InitEodDto, CloseEodDto } from './dto/eod.dto';

function isManager(role?: string) {
  return ['manager', 'supervisor', 'owner', 'root'].includes((role || '').toLowerCase());
}

@Injectable()
export class EodService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly realtime: RealtimeGateway,
  ) {}

  async initEod(dto: InitEodDto, initiatedById?: string) {
    // Prevent duplicate init
    const [existing] = await this.db
      .select()
      .from(eodRecords)
      .where(and(eq(eodRecords.storeId, dto.storeId), eq(eodRecords.businessDate, dto.businessDate)))
      .limit(1);

    if (existing) {
      if (existing.status === 'completed' || existing.status === 'rejected') {
        throw new ConflictException('EOD already closed for this date');
      }
      return existing;
    }

    const dayStart = new Date(`${dto.businessDate}T00:00:00.000Z`);
    const dayEnd = new Date(`${dto.businessDate}T23:59:59.999Z`);

    // Compute system totals from sales
    const [totals] = await this.db
      .select({
        systemTotal: sql<number>`coalesce(sum(${sales.totalPesewas}), 0)`,
        systemSaleCount: sql<number>`count(*)`,
        systemCashTotal: sql<number>`coalesce(sum(case when ${sales.tenderType} = 'cash' then ${sales.totalPesewas} else 0 end), 0)`,
        systemMomoTotal: sql<number>`coalesce(sum(case when ${sales.tenderType} = 'momo' then ${sales.totalPesewas} else 0 end), 0)`,
        systemCardTotal: sql<number>`coalesce(sum(case when ${sales.tenderType} = 'card' then ${sales.totalPesewas} else 0 end), 0)`,
      })
      .from(sales)
      .where(and(
        eq(sales.storeId, dto.storeId),
        eq(sales.status, 'completed'),
        gte(sales.createdAt, dayStart),
        lte(sales.createdAt, dayEnd),
      ));

    const [refundTotals] = await this.db
      .select({ total: sql<number>`coalesce(sum(${refundRequests.totalAmountPesewas}), 0)` })
      .from(refundRequests)
      .where(and(
        eq(refundRequests.storeId, dto.storeId),
        gte(refundRequests.processedAt, dayStart),
        lte(refundRequests.processedAt, dayEnd),
      ));

    const [expenseTotals] = await this.db
      .select({ total: sql<number>`coalesce(sum(${expenses.amountPesewas}), 0)` })
      .from(expenses)
      .where(and(
        eq(expenses.storeId, dto.storeId),
        gte(expenses.expenseDate, dayStart),
        lte(expenses.expenseDate, dayEnd),
      ));

    const [eod] = await this.db.insert(eodRecords).values({
      storeId: dto.storeId,
      businessDate: dto.businessDate,
      status: 'in_progress',
      initiatedById,
      systemCashTotal: Number(totals.systemCashTotal),
      systemMomoTotal: Number(totals.systemMomoTotal),
      systemCardTotal: Number(totals.systemCardTotal),
      systemTotal: Number(totals.systemTotal),
      systemSaleCount: Number(totals.systemSaleCount),
      systemRefundTotal: Number(refundTotals.total),
      systemExpenseTotal: Number(expenseTotals.total),
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

    const cashVariance = dto.physicalCashCount - eod.systemCashTotal - eod.openingFloat;
    const momoVariance = dto.momoConfirmed - eod.systemMomoTotal;
    const hasDiscrepancy = cashVariance !== 0 || momoVariance !== 0;

    // Floor staff close → pending manager approval.
    // Managers can close and approve immediately, but discrepancies still flag for review.
    const manager = isManager(role);
    const nextStatus = manager && !hasDiscrepancy ? 'completed' : 'pending_approval';

    const [updated] = await this.db
      .update(eodRecords)
      .set({
        status: nextStatus,
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

  async approveEod(id: string, approvedById: string) {
    const [eod] = await this.db
      .select()
      .from(eodRecords)
      .where(eq(eodRecords.id, id))
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

  async rejectEod(id: string, rejectedById: string) {
    const [eod] = await this.db
      .select()
      .from(eodRecords)
      .where(eq(eodRecords.id, id))
      .limit(1);

    if (!eod) throw new NotFoundException('EOD record not found');
    if (!['pending_approval', 'discrepancy'].includes(eod.status)) {
      throw new BadRequestException('EOD is not awaiting approval');
    }

    const [updated] = await this.db
      .update(eodRecords)
      .set({
        status: 'rejected',
        approvedById: rejectedById,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(eodRecords.id, id))
      .returning();

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
