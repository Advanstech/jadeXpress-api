import { Injectable, Inject } from '@nestjs/common';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { plSnapshots, ledgerEntries, sales, expenses, refundRequests } from '../../database/schema';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class AccountingService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getPLSnapshots(storeId: string, periodType: string, from: string, to: string) {
    return this.db
      .select()
      .from(plSnapshots)
      .where(
        and(
          eq(plSnapshots.storeId, storeId),
          eq(plSnapshots.periodType, periodType),
          gte(plSnapshots.periodDate, from),
          lte(plSnapshots.periodDate, to),
        ),
      )
      .orderBy(plSnapshots.periodDate);
  }

  async getCashFlow(storeId: string, from: string, to: string) {
    return this.db
      .select({
        date: sql<string>`date(${ledgerEntries.entryDate})`,
        inflow: sql<number>`coalesce(sum(case when ${ledgerEntries.entryType} = 'credit' then ${ledgerEntries.amountPesewas} else 0 end), 0)`,
        outflow: sql<number>`coalesce(sum(case when ${ledgerEntries.entryType} = 'debit' then ${ledgerEntries.amountPesewas} else 0 end), 0)`,
        net: sql<number>`coalesce(sum(case when ${ledgerEntries.entryType} = 'credit' then ${ledgerEntries.amountPesewas} else -${ledgerEntries.amountPesewas} end), 0)`,
      })
      .from(ledgerEntries)
      .where(
        and(
          eq(ledgerEntries.storeId, storeId),
          gte(ledgerEntries.entryDate, new Date(from)),
          lte(ledgerEntries.entryDate, new Date(to)),
        ),
      )
      .groupBy(sql`date(${ledgerEntries.entryDate})`)
      .orderBy(sql`date(${ledgerEntries.entryDate})`);
  }

  async getTaxSummary(storeId: string, from: string, to: string) {
    const [totals] = await this.db
      .select({
        vatTotal: sql<number>`coalesce(sum(${plSnapshots.vatCollectedPesewas}), 0)`,
        nhilTotal: sql<number>`coalesce(sum(${plSnapshots.nhilCollectedPesewas}), 0)`,
        getfundTotal: sql<number>`coalesce(sum(${plSnapshots.getfundCollectedPesewas}), 0)`,
      })
      .from(plSnapshots)
      .where(
        and(
          eq(plSnapshots.storeId, storeId),
          gte(plSnapshots.periodDate, from),
          lte(plSnapshots.periodDate, to),
        ),
      );

    return {
      vatTotalPesewas: Number(totals.vatTotal),
      nhilTotalPesewas: Number(totals.nhilTotal),
      getfundTotalPesewas: Number(totals.getfundTotal),
      combinedTaxPesewas:
        Number(totals.vatTotal) + Number(totals.nhilTotal) + Number(totals.getfundTotal),
      period: { from, to },
      note: 'Ghana VAT 15% + NHIL 2.5% + GETFund 2.5%',
    };
  }

  async getLedger(
    storeId: string,
    query: PaginationDto & { from?: string; to?: string; category?: string },
  ) {
    const { page, limit, from, to, category } = query;
    const offset = (page - 1) * limit;

    const conditions: any[] = [eq(ledgerEntries.storeId, storeId)];
    if (from) conditions.push(gte(ledgerEntries.entryDate, new Date(from)));
    if (to) conditions.push(lte(ledgerEntries.entryDate, new Date(to)));
    if (category) conditions.push(eq(ledgerEntries.category, category as any));

    const where = and(...conditions);
    const [data, [{ count }]] = await Promise.all([
      this.db.select().from(ledgerEntries).where(where)
        .orderBy(desc(ledgerEntries.entryDate)).limit(limit).offset(offset),
      this.db.select({ count: sql<number>`count(*)` }).from(ledgerEntries).where(where),
    ]);
    return paginate(data, Number(count), page, limit);
  }

  async computeDailySnapshot(storeId: string, date: string) {
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    const [rev] = await this.db
      .select({
        gross: sql<number>`coalesce(sum(${sales.totalPesewas}), 0)`,
        vat: sql<number>`coalesce(sum(${sales.vatAmountPesewas}), 0)`,
        nhil: sql<number>`coalesce(sum(${sales.nhilAmountPesewas}), 0)`,
        getfund: sql<number>`coalesce(sum(${sales.getfundAmountPesewas}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(sales)
      .where(and(eq(sales.storeId, storeId), eq(sales.status, 'completed'), gte(sales.createdAt, dayStart), lte(sales.createdAt, dayEnd)));

    const [ref] = await this.db
      .select({ total: sql<number>`coalesce(sum(${refundRequests.totalAmountPesewas}), 0)` })
      .from(refundRequests)
      .where(and(eq(refundRequests.storeId, storeId), gte(refundRequests.processedAt, dayStart), lte(refundRequests.processedAt, dayEnd)));

    const [exp] = await this.db
      .select({ total: sql<number>`coalesce(sum(${expenses.amountPesewas}), 0)` })
      .from(expenses)
      .where(and(eq(expenses.storeId, storeId), gte(expenses.expenseDate, dayStart), lte(expenses.expenseDate, dayEnd)));

    const grossRevenue = Number(rev.gross);
    const refundsTotal = Number(ref.total);
    const netRevenue = grossRevenue - refundsTotal;
    const vatCollected = Number(rev.vat);
    const nhilCollected = Number(rev.nhil);
    const getfundCollected = Number(rev.getfund);
    const totalExpenses = Number(exp.total);
    const grossProfit = netRevenue; // COGS calc would require unit cost × qty — simplified here
    const netProfit = grossProfit - totalExpenses;

    // Upsert snapshot
    const existing = await this.db
      .select({ id: plSnapshots.id })
      .from(plSnapshots)
      .where(and(eq(plSnapshots.storeId, storeId), eq(plSnapshots.periodType, 'daily'), eq(plSnapshots.periodDate, date)))
      .limit(1);

    const values = {
      storeId,
      periodType: 'daily',
      periodDate: date,
      grossRevenuePesewas: grossRevenue,
      refundsTotalPesewas: refundsTotal,
      netRevenuePesewas: netRevenue,
      vatCollectedPesewas: vatCollected,
      nhilCollectedPesewas: nhilCollected,
      getfundCollectedPesewas: getfundCollected,
      cogsPesewas: 0, // TODO: compute from stock movements cost data
      grossProfitPesewas: grossProfit,
      totalExpensesPesewas: totalExpenses,
      netProfitPesewas: netProfit,
      saleCount: Number(rev.count),
      computedAt: new Date(),
    };

    if (existing.length > 0) {
      const [snap] = await this.db
        .update(plSnapshots)
        .set(values)
        .where(eq(plSnapshots.id, existing[0].id))
        .returning();
      return snap;
    }

    const [snap] = await this.db.insert(plSnapshots).values(values).returning();
    return snap;
  }

  async exportPL(storeId: string, from: string, to: string, format: 'json' | 'csv') {
    const data = await this.getPLSnapshots(storeId, 'daily', from, to);
    if (format === 'csv') {
      // TODO: proper CSV serialization — returning JSON with note for now
      return { data, format: 'csv', note: 'CSV serialization pending — consume data array' };
    }
    return { data, format: 'json' };
  }
}
