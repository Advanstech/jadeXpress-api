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
  expenses,
  staffProfile,
  plSnapshots,
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

    const [todayRevenue, monthRevenue, stockAlertCount, newCustomers, lowStockCount] =
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
      },
    };
  }

  async getLiveFeed(storeId: string, limit = 10) {
    return this.db
      .select({
        id: sales.id,
        receiptNumber: sales.receiptNumber,
        totalPesewas: sales.totalPesewas,
        tenderType: sales.tenderType,
        cashierId: sales.cashierId,
        cashierFirst: staffProfile.firstName,
        cashierLast: staffProfile.lastName,
        createdAt: sales.createdAt,
      })
      .from(sales)
      .innerJoin(staffProfile, eq(staffProfile.id, sales.cashierId))
      .where(and(eq(sales.storeId, storeId), eq(sales.status, 'completed')))
      .orderBy(desc(sales.createdAt))
      .limit(limit);
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
