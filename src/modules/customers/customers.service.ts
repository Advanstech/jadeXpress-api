import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, ilike, or, desc, sql, and, lte } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { customers, loyaltyTransactions, sales, saleItems } from '../../database/schema';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import type { CreateCustomerDto, UpdateCustomerDto } from './dto/customers.dto';

@Injectable()
export class CustomersService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async list(query: PaginationDto & { storeId?: string; segment?: string }) {
    const { page, limit, search } = query;
    const offset = (page - 1) * limit;

    const conditions: any[] = [eq(customers.isActive, true)];
    if (search) {
      conditions.push(
        or(
          ilike(customers.firstName, `%${search}%`),
          ilike(customers.lastName, `%${search}%`),
          ilike(customers.phone, `%${search}%`),
          ilike(customers.email, `%${search}%`),
        ),
      );
    }

    const where = and(...conditions);

    const [data, [{ count }]] = await Promise.all([
      this.db.select().from(customers).where(where)
        .orderBy(desc(customers.lastVisitAt)).limit(limit).offset(offset),
      this.db.select({ count: sql<number>`count(*)` }).from(customers).where(where),
    ]);

    return paginate(data, Number(count), page, limit);
  }

  async getById(id: string) {
    const [customer] = await this.db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1);
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async getByPhone(phone: string) {
    const [customer] = await this.db
      .select()
      .from(customers)
      .where(eq(customers.phone, phone))
      .limit(1);
    return customer ?? null;
  }

  async create(dto: CreateCustomerDto) {
    const [customer] = await this.db.insert(customers).values(dto).returning();
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto) {
    const [customer] = await this.db
      .update(customers)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async getPurchaseHistory(customerId: string, limit = 20) {
    return this.db
      .select()
      .from(sales)
      .where(and(eq(sales.customerId, customerId), eq(sales.status, 'completed')))
      .orderBy(desc(sales.completedAt))
      .limit(limit);
  }

  async getLoyaltyTransactions(customerId: string, limit = 30) {
    return this.db
      .select()
      .from(loyaltyTransactions)
      .where(eq(loyaltyTransactions.customerId, customerId))
      .orderBy(desc(loyaltyTransactions.createdAt))
      .limit(limit);
  }

  // NL search — structured filter translation (AI layer for full impl,
  // this method provides the direct-filter fallback + query contract)
  // MOCKED_PENDING_MODEL_INTEGRATION — full NL parsing is in ai/ module
  async nlSearch(query: string, storeId?: string) {
    // Parse simple patterns synchronously as fallback
    const conditions: any[] = [eq(customers.isActive, true)];

    // Pattern: "hasn't visited in X days"
    const lapsedMatch = query.match(/(\d+)\s*days?/i);
    if (lapsedMatch) {
      const days = parseInt(lapsedMatch[1]);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      conditions.push(lte(customers.lastVisitAt, cutoff));
    }

    // Pattern: gender
    if (/female/i.test(query)) conditions.push(eq(customers.gender, 'female'));
    if (/male/i.test(query)) conditions.push(eq(customers.gender, 'male'));

    // Pattern: product name mention → search health notes
    const productMatch = query.match(/(?:bought|buy|purchase[sd]?)\s+(.+?)(?:\s+and|\s*$)/i);
    if (productMatch) {
      conditions.push(ilike(customers.healthNotes, `%${productMatch[1]}%`));
    }

    const where = and(...conditions);
    const data = await this.db
      .select()
      .from(customers)
      .where(where)
      .orderBy(desc(customers.lastVisitAt))
      .limit(50);

    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      results: data,
      appliedFilters: conditions.length > 1 ? 'partial_parse' : 'none',
      note: 'Full NL parsing available via POST /ai/customer-search',
    };
  }

  // ── Lapsed customers (for push notification / promo targeting) ────────────
  async getLapsedCustomers(storeId: string, daysSinceLastVisit = 60) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysSinceLastVisit);

    return this.db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.isActive, true),
          lte(customers.lastVisitAt, cutoff),
        ),
      )
      .orderBy(desc(customers.totalSpendPesewas))
      .limit(100);
  }
}
