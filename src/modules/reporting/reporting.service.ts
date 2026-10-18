import { Injectable, Inject } from '@nestjs/common';
import { eq, and, gte, lte, desc, sql, inArray } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { sales, saleItems, products, staffProfile, categories } from '../../database/schema';
import { normalizeDateRange } from '../../common/utils/date-range';

@Injectable()
export class ReportingService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getSalesSummary(storeId: string | null | undefined, from: string, to: string) {
    const { startDate, endDate } = normalizeDateRange(from, to);

    const conditions: any[] = [
      inArray(sales.status, ['completed', 'partially_refunded']),
      gte(sales.createdAt, startDate),
      lte(sales.createdAt, endDate),
    ];
    if (storeId && storeId !== 'all') {
      conditions.push(eq(sales.storeId, storeId));
    }

    const [summary] = await this.db
      .select({
        totalRevenuePesewas: sql<number>`coalesce(sum(${sales.totalPesewas}), 0)`,
        totalSales: sql<number>`count(*)`,
        avgOrderValuePesewas: sql<number>`coalesce(avg(${sales.totalPesewas}), 0)`,
        totalDiscountsPesewas: sql<number>`coalesce(sum(${sales.discountAmountPesewas}), 0)`,
      })
      .from(sales)
      .where(and(...conditions));

    return summary;
  }

  async getSalesByDay(storeId: string | null | undefined, from: string, to: string) {
    const { startDate, endDate } = normalizeDateRange(from, to);
    const conditions: any[] = [
      inArray(sales.status, ['completed', 'partially_refunded']),
      gte(sales.createdAt, startDate),
      lte(sales.createdAt, endDate),
    ];
    if (storeId && storeId !== 'all') {
      conditions.push(eq(sales.storeId, storeId));
    }

    return this.db
      .select({
        date: sql<string>`date(${sales.createdAt})`,
        revenue: sql<number>`coalesce(sum(${sales.totalPesewas}), 0)`,
        count: sql<number>`count(*)`,
        avgOrder: sql<number>`coalesce(avg(${sales.totalPesewas}), 0)`,
      })
      .from(sales)
      .where(and(...conditions))
      .groupBy(sql`date(${sales.createdAt})`)
      .orderBy(sql`date(${sales.createdAt})`);
  }

  async getTopProducts(storeId: string | null | undefined, from: string, to: string, limit = 10) {
    const { startDate, endDate } = normalizeDateRange(from, to);
    const conditions: any[] = [
      inArray(sales.status, ['completed', 'partially_refunded']),
      gte(sales.createdAt, startDate),
      lte(sales.createdAt, endDate),
    ];
    if (storeId && storeId !== 'all') {
      conditions.push(eq(sales.storeId, storeId));
    }

    return this.db
      .select({
        productId: saleItems.productId,
        productName: saleItems.productNameSnapshot,
        productSku: saleItems.productSkuSnapshot,
        totalQtySold: sql<number>`sum(${saleItems.quantity})`,
        totalRevenuePesewas: sql<number>`sum(${saleItems.lineTotalPesewas})`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .where(and(...conditions))
      .groupBy(saleItems.productId, saleItems.productNameSnapshot, saleItems.productSkuSnapshot)
      .orderBy(desc(sql`sum(${saleItems.lineTotalPesewas})`))
      .limit(limit);
  }

  async getPerCashierPerformance(storeId: string | null | undefined, from: string, to: string) {
    const { startDate, endDate } = normalizeDateRange(from, to);
    const conditions: any[] = [
      inArray(sales.status, ['completed', 'partially_refunded']),
      gte(sales.createdAt, startDate),
      lte(sales.createdAt, endDate),
    ];
    if (storeId && storeId !== 'all') {
      conditions.push(eq(sales.storeId, storeId));
    }

    return this.db
      .select({
        cashierId: sales.cashierId,
        firstName: staffProfile.firstName,
        lastName: staffProfile.lastName,
        totalRevenuePesewas: sql<number>`coalesce(sum(${sales.totalPesewas}), 0)`,
        saleCount: sql<number>`count(*)`,
        avgOrderValuePesewas: sql<number>`coalesce(avg(${sales.totalPesewas}), 0)`,
      })
      .from(sales)
      .innerJoin(staffProfile, eq(staffProfile.id, sales.cashierId))
      .where(and(...conditions))
      .groupBy(sales.cashierId, staffProfile.firstName, staffProfile.lastName)
      .orderBy(desc(sql`sum(${sales.totalPesewas})`));
  }

  async getPerCategoryPerformance(storeId: string | null | undefined, from: string, to: string) {
    const { startDate, endDate } = normalizeDateRange(from, to);
    const conditions: any[] = [
      inArray(sales.status, ['completed', 'partially_refunded']),
      gte(sales.createdAt, startDate),
      lte(sales.createdAt, endDate),
    ];
    if (storeId && storeId !== 'all') {
      conditions.push(eq(sales.storeId, storeId));
    }

    return this.db
      .select({
        categoryId: products.categoryId,
        categoryName: categories.name,
        totalRevenuePesewas: sql<number>`coalesce(sum(${saleItems.lineTotalPesewas}), 0)`,
        totalQtySold: sql<number>`sum(${saleItems.quantity})`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .innerJoin(products, eq(products.id, saleItems.productId))
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .where(and(...conditions))
      .groupBy(products.categoryId, categories.name)
      .orderBy(desc(sql`sum(${saleItems.lineTotalPesewas})`));
  }

  async getHourlyHeatmap(storeId: string | null | undefined, from: string, to: string) {
    const { startDate, endDate } = normalizeDateRange(from, to);
    const conditions: any[] = [
      inArray(sales.status, ['completed', 'partially_refunded']),
      gte(sales.createdAt, startDate),
      lte(sales.createdAt, endDate),
    ];
    if (storeId && storeId !== 'all') {
      conditions.push(eq(sales.storeId, storeId));
    }

    return this.db
      .select({
        hour: sql<number>`extract(hour from ${sales.createdAt})`,
        dayOfWeek: sql<number>`extract(dow from ${sales.createdAt})`,
        count: sql<number>`count(*)`,
        revenue: sql<number>`coalesce(sum(${sales.totalPesewas}), 0)`,
      })
      .from(sales)
      .where(and(...conditions))
      .groupBy(
        sql`extract(hour from ${sales.createdAt})`,
        sql`extract(dow from ${sales.createdAt})`,
      );
  }
}
