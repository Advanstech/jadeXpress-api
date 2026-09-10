import { Injectable, Inject } from '@nestjs/common';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { plSnapshots, ledgerEntries, sales, expenses, refundRequests, stockMovements } from '../../database/schema';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import { normalizeDateRange, parseStartOfDay, parseEndOfDay } from '../../common/utils/date-range';

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

  async getAggregatedPL(storeId: string, from: string, to: string) {
    const { startDate, endDate } = normalizeDateRange(from, to);

    // Live P&L aggregation from source tables so the page works even when no
    // pre-computed snapshots have been generated yet.
    const [rev] = await this.db
      .select({
        total: sql<number>`coalesce(sum(${sales.totalPesewas}), 0)`,
      })
      .from(sales)
      .where(
        and(
          eq(sales.storeId, storeId),
          eq(sales.status, 'completed'),
          gte(sales.createdAt, startDate),
          lte(sales.createdAt, endDate),
        ),
      );

    const [ref] = await this.db
      .select({
        total: sql<number>`coalesce(sum(${refundRequests.totalAmountPesewas}), 0)`,
      })
      .from(refundRequests)
      .where(
        and(
          eq(refundRequests.storeId, storeId),
          eq(refundRequests.status, 'approved'),
          gte(refundRequests.processedAt, startDate),
          lte(refundRequests.processedAt, endDate),
        ),
      );

    const [exp] = await this.db
      .select({
        total: sql<number>`coalesce(sum(${expenses.amountPesewas}), 0)`,
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.storeId, storeId),
          gte(expenses.expenseDate, startDate),
          lte(expenses.expenseDate, endDate),
        ),
      );

    const revenuePesewas = Number(rev.total);
    const refundsPesewas = Number(ref.total);
    const expensesPesewas = Number(exp.total);

    // COGS for the period — sum of cost × qty for all sale_out movements
    const [cogsAgg] = await this.db
      .select({
        cogs: sql<number>`coalesce(sum(${stockMovements.costPricePesewas} * abs(${stockMovements.quantityChange})), 0)`,
      })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.storeId, storeId),
          eq(stockMovements.type, 'sale_out'),
          eq(stockMovements.referenceType, 'sale'),
          gte(stockMovements.createdAt, startDate),
          lte(stockMovements.createdAt, endDate),
        ),
      );

    const cogsPesewas = Number(cogsAgg.cogs);
    const grossProfitPesewas = revenuePesewas - refundsPesewas - cogsPesewas;
    const netProfitPesewas = grossProfitPesewas - expensesPesewas;

    const revenueByDay = await this.db
      .select({
        date: sql<string>`date(${sales.createdAt})`,
        total: sql<number>`coalesce(sum(${sales.totalPesewas}), 0)`,
      })
      .from(sales)
      .where(
        and(
          eq(sales.storeId, storeId),
          eq(sales.status, 'completed'),
          gte(sales.createdAt, startDate),
          lte(sales.createdAt, endDate),
        ),
      )
      .groupBy(sql`date(${sales.createdAt})`);

    const refundsByDay = await this.db
      .select({
        date: sql<string>`date(${refundRequests.processedAt})`,
        total: sql<number>`coalesce(sum(${refundRequests.totalAmountPesewas}), 0)`,
      })
      .from(refundRequests)
      .where(
        and(
          eq(refundRequests.storeId, storeId),
          eq(refundRequests.status, 'approved'),
          gte(refundRequests.processedAt, startDate),
          lte(refundRequests.processedAt, endDate),
        ),
      )
      .groupBy(sql`date(${refundRequests.processedAt})`);

    const expensesByDay = await this.db
      .select({
        date: sql<string>`date(${expenses.expenseDate})`,
        total: sql<number>`coalesce(sum(${expenses.amountPesewas}), 0)`,
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.storeId, storeId),
          gte(expenses.expenseDate, startDate),
          lte(expenses.expenseDate, endDate),
        ),
      )
      .groupBy(sql`date(${expenses.expenseDate})`);

    const breakdown: Record<string, number> = {};
    for (const r of revenueByDay) breakdown[r.date] = (breakdown[r.date] ?? 0) + Number(r.total);
    for (const r of refundsByDay) breakdown[r.date] = (breakdown[r.date] ?? 0) - Number(r.total);
    for (const r of expensesByDay) breakdown[r.date] = (breakdown[r.date] ?? 0) - Number(r.total);

    return {
      revenuePesewas,
      cogsPesewas,
      grossProfitPesewas,
      expensesPesewas,
      netProfitPesewas,
      refundsPesewas,
      breakdown,
      period: { from, to },
    };
  }

  async getCashFlow(storeId: string, from: string, to: string) {
    const { startDate, endDate } = normalizeDateRange(from, to);
    // Cash flow counts only CASH movements. The 'cost_of_goods' category holds
    // non-cash Accounts Payable records (invoice approved / goods received) —
    // cash only moves when the supplier is actually paid (SUPPLIER_PAYMENT debit).
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
          sql`${ledgerEntries.category} <> 'cost_of_goods'`,
          gte(ledgerEntries.entryDate, startDate),
          lte(ledgerEntries.entryDate, endDate),
        ),
      )
      .groupBy(sql`date(${ledgerEntries.entryDate})`)
      .orderBy(sql`date(${ledgerEntries.entryDate})`);
  }

  async getTaxSummary(storeId: string, from: string, to: string) {
    const { startDate, endDate } = normalizeDateRange(from, to);

    const [totals] = await this.db
      .select({
        vatTotal: sql<number>`coalesce(sum(${sales.vatAmountPesewas}), 0)`,
        nhilTotal: sql<number>`coalesce(sum(${sales.nhilAmountPesewas}), 0)`,
        getfundTotal: sql<number>`coalesce(sum(${sales.getfundAmountPesewas}), 0)`,
      })
      .from(sales)
      .where(
        and(
          eq(sales.storeId, storeId),
          eq(sales.status, 'completed'),
          gte(sales.createdAt, startDate),
          lte(sales.createdAt, endDate),
        ),
      );

    const vat = Number(totals.vatTotal);
    const nhil = Number(totals.nhilTotal);
    const getfund = Number(totals.getfundTotal);

    return {
      vatTotalPesewas: vat,
      nhilTotalPesewas: nhil,
      getfundTotalPesewas: getfund,
      combinedTaxPesewas: vat + nhil + getfund,
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
    if (from) conditions.push(gte(ledgerEntries.entryDate, parseStartOfDay(from)));
    if (to) conditions.push(lte(ledgerEntries.entryDate, parseEndOfDay(to)));
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
      .where(and(eq(refundRequests.storeId, storeId), eq(refundRequests.status, 'approved'), gte(refundRequests.processedAt, dayStart), lte(refundRequests.processedAt, dayEnd)));

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

    // COGS: sum(cost_price × abs(quantity_change)) for all sale_out movements
    // on this day. Movements without a cost price contribute 0 COGS (e.g. older
    // sales recorded before cost tracking was added).
    const [cogsRow] = await this.db
      .select({
        cogs: sql<number>`coalesce(sum(${stockMovements.costPricePesewas} * abs(${stockMovements.quantityChange})), 0)`,
      })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.storeId, storeId),
          eq(stockMovements.type, 'sale_out'),
          eq(stockMovements.referenceType, 'sale'),
          gte(stockMovements.createdAt, dayStart),
          lte(stockMovements.createdAt, dayEnd),
        ),
      );

    const cogsPesewas = Number(cogsRow.cogs);
    const grossProfit = netRevenue - cogsPesewas;
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
      cogsPesewas,
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
      const headers = [
        'period_date',
        'gross_revenue_pesewas',
        'refunds_total_pesewas',
        'net_revenue_pesewas',
        'vat_collected_pesewas',
        'nhil_collected_pesewas',
        'getfund_collected_pesewas',
        'cogs_pesewas',
        'gross_profit_pesewas',
        'total_expenses_pesewas',
        'net_profit_pesewas',
        'sale_count',
      ];

      const escapeCsv = (val: unknown) => {
        const s = String(val ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };

      const rows = (Array.isArray(data) ? data : []).map((r: any) =>
        [
          r.periodDate,
          r.grossRevenuePesewas,
          r.refundsTotalPesewas,
          r.netRevenuePesewas,
          r.vatCollectedPesewas,
          r.nhilCollectedPesewas,
          r.getfundCollectedPesewas,
          r.cogsPesewas,
          r.grossProfitPesewas,
          r.totalExpensesPesewas,
          r.netProfitPesewas,
          r.saleCount,
        ].map(escapeCsv).join(','),
      );

      const csv = [headers.join(','), ...rows].join('\n');
      return { csv, format: 'csv', filename: `pl-${storeId}-${from}-to-${to}.csv` };
    }

    return { data, format: 'json' };
  }
}
