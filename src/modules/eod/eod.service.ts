import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { eodRecords, sales, refundRequests, expenses } from '../../database/schema';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import type { InitEodDto, CloseEodDto } from './dto/eod.dto';

@Injectable()
export class EodService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async initEod(dto: InitEodDto) {
    // Prevent duplicate init
    const [existing] = await this.db
      .select()
      .from(eodRecords)
      .where(and(eq(eodRecords.storeId, dto.storeId), eq(eodRecords.businessDate, dto.businessDate)))
      .limit(1);

    if (existing) {
      if (existing.status === 'completed') throw new ConflictException('EOD already closed for this date');
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

  async closeEod(dto: CloseEodDto, closedById: string) {
    const [eod] = await this.db
      .select()
      .from(eodRecords)
      .where(and(eq(eodRecords.storeId, dto.storeId), eq(eodRecords.businessDate, dto.businessDate)))
      .limit(1);

    if (!eod) throw new NotFoundException('EOD record not found — call /eod/init first');
    if (eod.status === 'completed') throw new ConflictException('EOD already completed');

    const cashVariance = dto.physicalCashCount - eod.systemCashTotal - eod.openingFloat;
    const momoVariance = dto.momoConfirmed - eod.systemMomoTotal;
    const hasDiscrepancy = cashVariance !== 0 || momoVariance !== 0;

    const [updated] = await this.db
      .update(eodRecords)
      .set({
        status: hasDiscrepancy ? 'discrepancy' : 'completed',
        physicalCashCount: dto.physicalCashCount,
        cashVariance,
        denominations: dto.denominations,
        momoConfirmed: dto.momoConfirmed,
        momoVariance,
        varianceNotes: dto.varianceNotes,
        closedById,
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(eodRecords.id, eod.id))
      .returning();

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
