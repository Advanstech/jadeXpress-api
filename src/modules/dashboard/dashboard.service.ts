import { Injectable, Inject } from '@nestjs/common';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import {
  sales,
  customers,
  products,
  stockItems,
  stockAlerts,
  refundRequests,
  stockMovements,
  expenses,
  staffProfile,
  plSnapshots,
  purchaseOrders,
} from '../../database/schema';

@Injectable()
export class DashboardService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getKpis(storeId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [todayRevenue, monthRevenue, stockAlertCount, newCustomers, lowStockCount, totalStockCount, accountsPayable] =
      await Promise.all([
        // Today's revenue
        this.db
          .select({
            total: sql<number>`coalesce(sum(${sales.totalPesewas}), 0)`,
            count: sql<number>`count(*)`,
          })
          .from(sales)
          .where(
            and(eq(sales.storeId, storeId), eq(sales.status, 'completed'),
              gte(sales.createdAt, todayStart), lte(sales.createdAt, todayEnd)),
          )
          .then((r) => r[0]),

        // Month revenue
        this.db
          .select({ total: sql<number>`coalesce(sum(${sales.totalPesewas}), 0)` })
          .from(sales)
          .where(
            and(eq(sales.storeId, storeId), eq(sales.status, 'completed'),
              gte(sales.createdAt, monthStart)),
          )
          .then((r) => r[0]),

        // Active stock alerts
        this.db
          .select({ count: sql<number>`count(*)` })
          .from(stockAlerts)
          .where(and(eq(stockAlerts.storeId, storeId), eq(stockAlerts.isDismissed, false)))
          .then((r) => Number(r[0].count)),

        // New customers this month
        this.db
          .select({ count: sql<number>`count(*)` })
          .from(customers)
          .where(gte(customers.createdAt, monthStart))
          .then((r) => Number(r[0].count)),

        // Low stock products
        this.db
          .select({ count: sql<number>`count(*)` })
          .from(stockItems)
          .innerJoin(products, eq(products.id, stockItems.productId))
          .where(
            and(
              eq(stockItems.storeId, storeId),
              sql`${stockItems.quantityOnHand} <= ${products.reorderPoint}`,
            ),
          )
          .then((r) => Number(r[0].count)),

        // Total tracked stock items for this store
        this.db
          .select({ count: sql<number>`count(*)` })
          .from(stockItems)
          .where(eq(stockItems.storeId, storeId))
          .then((r) => Number(r[0].count)),

        // Accounts Payable (Total Outstanding Balance to Suppliers)
        this.db
          .select({
            totalBalance: sql<number>`coalesce(sum(${purchaseOrders.balancePesewas}), 0)`,
            overdueCount: sql<number>`count(case when ${purchaseOrders.expectedDeliveryDate} < CURRENT_DATE then 1 end)`,
          })
          .from(purchaseOrders)
          .where(
            and(
              eq(purchaseOrders.storeId, storeId),
              sql`${purchaseOrders.balancePesewas} > 0`
            )
          )
          .then((r) => ({
            totalBalance: Number(r[0].totalBalance),
            overdueCount: Number(r[0].overdueCount)
          })),
      ]);

    // Revenue trend: today vs same day last week
    const lastWeek = new Date(todayStart);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastWeekEnd = new Date(todayEnd);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);

    const [lastWeekRevenue] = await this.db
      .select({ total: sql<number>`coalesce(sum(${sales.totalPesewas}), 0)` })
      .from(sales)
      .where(
        and(eq(sales.storeId, storeId), eq(sales.status, 'completed'),
          gte(sales.createdAt, lastWeek), lte(sales.createdAt, lastWeekEnd)),
      );

    const todayTotal = Number(todayRevenue.total);
    const lastWeekTotal = Number(lastWeekRevenue.total);
    const revenueTrend = lastWeekTotal > 0
      ? Math.round(((todayTotal - lastWeekTotal) / lastWeekTotal) * 100)
      : 0;

    const stockHealthIndex = totalStockCount > 0
      ? Math.round(((totalStockCount - lowStockCount) / totalStockCount) * 100)
      : 100;

    return {
      today: {
        revenuePesewas: todayTotal,
        saleCount: Number(todayRevenue.count),
        revenueTrendPct: revenueTrend,
      },
      month: {
        revenuePesewas: Number(monthRevenue.total),
        newCustomers,
      },
      inventory: {
        stockAlerts: stockAlertCount,
        lowStockProducts: lowStockCount,
        totalProducts: totalStockCount,
        stockHealthIndex,
      },
      finance: {
        accountsPayablePesewas: accountsPayable.totalBalance,
        overduePayablesCount: accountsPayable.overdueCount,
      }
    };
  }

  async getLiveFeed(storeId: string, limit = 50) {
    const feedLimit = Math.min(Math.max(limit, 1), 100);

    const recentSales = await this.db
      .select({
        id: sales.id,
        receiptNumber: sales.receiptNumber,
        totalPesewas: sales.totalPesewas,
        createdAt: sales.createdAt,
        cashierFirst: staffProfile.firstName,
        cashierLast: staffProfile.lastName,
      })
      .from(sales)
      .innerJoin(staffProfile, eq(staffProfile.id, sales.cashierId))
      .where(and(eq(sales.storeId, storeId), eq(sales.status, 'completed')))
      .orderBy(desc(sales.createdAt))
      .limit(feedLimit);

    const recentRefunds = await this.db
      .select({
        id: refundRequests.id,
        saleId: refundRequests.saleId,
        receiptNumber: sales.receiptNumber,
        totalAmountPesewas: refundRequests.totalAmountPesewas,
        status: refundRequests.status,
        createdAt: refundRequests.createdAt,
        staffFirst: staffProfile.firstName,
        staffLast: staffProfile.lastName,
      })
      .from(refundRequests)
      .innerJoin(sales, eq(sales.id, refundRequests.saleId))
      .leftJoin(staffProfile, eq(staffProfile.id, refundRequests.initiatedById))
      .where(eq(refundRequests.storeId, storeId))
      .orderBy(desc(refundRequests.createdAt))
      .limit(feedLimit);

    const recentStockAlerts = await this.db
      .select({
        id: stockAlerts.id,
        type: stockAlerts.type,
        severity: stockAlerts.severity,
        message: stockAlerts.message,
        productName: products.name,
        createdAt: stockAlerts.createdAt,
      })
      .from(stockAlerts)
      .innerJoin(products, eq(products.id, stockAlerts.productId))
      .where(and(eq(stockAlerts.storeId, storeId), eq(stockAlerts.isDismissed, false)))
      .orderBy(desc(stockAlerts.createdAt))
      .limit(feedLimit);

    const stockInTypes = ['purchase_in', 'return_in', 'transfer_in', 'adjustment_in', 'opening_stock'] as const;
    const recentStockIns = await this.db
      .select({
        id: stockMovements.id,
        type: stockMovements.type,
        quantityChange: stockMovements.quantityChange,
        productName: products.name,
        createdAt: stockMovements.createdAt,
        staffFirst: staffProfile.firstName,
        staffLast: staffProfile.lastName,
      })
      .from(stockMovements)
      .innerJoin(products, eq(products.id, stockMovements.productId))
      .leftJoin(staffProfile, eq(staffProfile.id, stockMovements.performedById))
      .where(
        and(
          eq(stockMovements.storeId, storeId),
          ...stockInTypes.map((t) => eq(stockMovements.type, t as any)),
        ),
      )
      .orderBy(desc(stockMovements.createdAt))
      .limit(feedLimit);

    const formatName = (first?: string | null, last?: string | null) =>
      [first, last].filter(Boolean).join(' ');

    const allItems = [
      ...recentSales.map((s) => ({
        id: s.id,
        type: 'sale' as const,
        createdAt: s.createdAt,
        referenceId: s.id,
        text: `Sale completed: ${s.receiptNumber ?? 'Sale'}${formatName(s.cashierFirst, s.cashierLast) ? ` by ${formatName(s.cashierFirst, s.cashierLast)}` : ''}`,
        amountPesewas: Number(s.totalPesewas ?? 0),
        severity: 'info' as const,
      })),
      ...recentRefunds.map((r) => ({
        id: r.id,
        type: 'refund' as const,
        createdAt: r.createdAt,
        referenceId: r.saleId,
        text: `Refund ${r.status === 'processed' ? 'processed' : 'requested'}${formatName(r.staffFirst, r.staffLast) ? ` by ${formatName(r.staffFirst, r.staffLast)}` : ''} for ${r.receiptNumber ?? 'sale'}`,
        amountPesewas: Number(r.totalAmountPesewas ?? 0),
        severity: 'warning' as const,
      })),
      ...recentStockAlerts.map((a) => ({
        id: a.id,
        type: 'stock_alert' as const,
        createdAt: a.createdAt,
        referenceId: a.id,
        text: `${a.message ?? 'Stock alert'}${a.productName ? ` — ${a.productName}` : ''}`,
        amountPesewas: null as number | null,
        severity:
          a.severity === 'critical'
            ? ('critical' as const)
            : a.severity === 'warning'
              ? ('warning' as const)
              : ('info' as const),
      })),
      ...recentStockIns.map((m) => ({
        id: m.id,
        type: 'stock_in' as const,
        createdAt: m.createdAt,
        referenceId: m.id,
        text: `Stock ${(m.type as string).replace('_in', '')}: +${m.quantityChange} ${m.productName}${formatName(m.staffFirst, m.staffLast) ? ` by ${formatName(m.staffFirst, m.staffLast)}` : ''}`,
        amountPesewas: null as number | null,
        severity: 'info' as const,
      })),
    ];

    return allItems
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, feedLimit);
  }

  async getRevenueSparkline(storeId: string, days = 14) {
    const from = new Date();
    from.setDate(from.getDate() - days);

    return this.db
      .select({
        date: sql<string>`date(${sales.createdAt})`,
        revenue: sql<number>`coalesce(sum(${sales.totalPesewas}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(sales)
      .where(
        and(
          eq(sales.storeId, storeId),
          eq(sales.status, 'completed'),
          gte(sales.createdAt, from),
        ),
      )
      .groupBy(sql`date(${sales.createdAt})`)
      .orderBy(sql`date(${sales.createdAt})`);
  }
}
