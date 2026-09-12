import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, gte, lte, desc, sql, or, isNull } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { expenses, expenseCategories, ledgerEntries, staffProfile } from '../../database/schema';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import type { CreateExpenseCategoryDto, CreateExpenseDto, UpdateExpenseDto } from './dto/expenses.dto';

@Injectable()
export class ExpensesService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async listCategories(storeId?: string) {
    const where = storeId
      ? or(eq(expenseCategories.storeId, storeId), isNull(expenseCategories.storeId))
      : isNull(expenseCategories.storeId);
    return this.db.select().from(expenseCategories).where(where).orderBy(expenseCategories.name);
  }

  async createCategory(dto: CreateExpenseCategoryDto) {
    const [cat] = await this.db.insert(expenseCategories).values(dto).returning();
    return cat;
  }

  async list(
    storeId: string,
    query: PaginationDto & { categoryId?: string; from?: string; to?: string },
  ) {
    const { page, limit, from, to, categoryId } = query;
    const offset = (page - 1) * limit;

    const conditions: any[] = [eq(expenses.storeId, storeId)];
    if (from) conditions.push(gte(expenses.expenseDate, new Date(from)));
    if (to) conditions.push(lte(expenses.expenseDate, new Date(to)));
    if (categoryId) conditions.push(eq(expenses.categoryId, categoryId));

    const where = and(...conditions);

    const [data, [{ count }]] = await Promise.all([
      this.db.query.expenses.findMany({
        where,
        with: {
          category: true,
          recordedBy: true,
        },
        orderBy: [desc(expenses.expenseDate)],
        limit,
        offset,
      }),
      this.db.select({ count: sql<number>`count(*)` }).from(expenses).where(where),
    ]);

    // Flatten relations for the frontend table — it expects `category.name`,
    // `loggedBy.name`, and a top-level `date` field.
    const flattened = data.map((e: any) => ({
      ...e,
      date: e.expenseDate,
      categoryName: e.category?.name,
      staffName: e.recordedBy ? `${e.recordedBy.firstName} ${e.recordedBy.lastName}`.trim() : undefined,
      loggedBy: e.recordedBy
        ? { id: e.recordedBy.id, name: `${e.recordedBy.firstName} ${e.recordedBy.lastName}`.trim() }
        : undefined,
      // Strip sensitive fields from embedded staff
      category: e.category ? { id: e.category.id, name: e.category.name } : undefined,
    }));

    return paginate(flattened, Number(count), page, limit);
  }

  async getById(id: string, storeId?: string) {
    const conditions = [eq(expenses.id, id)];
    if (storeId) conditions.push(eq(expenses.storeId, storeId));
    const [expense] = await this.db.query.expenses.findFirst({
      where: and(...conditions),
      with: {
        category: true,
        recordedBy: true,
      },
    }) as any;
    if (!expense) throw new NotFoundException('Expense not found');
    return {
      ...expense,
      date: expense.expenseDate,
      categoryName: expense.category?.name,
      staffName: expense.recordedBy ? `${expense.recordedBy.firstName} ${expense.recordedBy.lastName}`.trim() : undefined,
      loggedBy: expense.recordedBy
        ? { id: expense.recordedBy.id, name: `${expense.recordedBy.firstName} ${expense.recordedBy.lastName}`.trim() }
        : undefined,
      category: expense.category ? { id: expense.category.id, name: expense.category.name } : undefined,
    };
  }

  async create(dto: CreateExpenseDto, staffId: string) {
    const [expense] = await this.db
      .insert(expenses)
      .values({ ...dto, recordedById: staffId, expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : new Date() })
      .returning();

    // Ledger entry — debit (money out)
    await this.db.insert(ledgerEntries).values({
      storeId: dto.storeId,
      entryType: 'debit',
      category: 'expense',
      amountPesewas: dto.amountPesewas,
      description: dto.description,
      referenceType: 'expense',
      referenceId: expense.id,
      performedById: staffId,
    });

    return expense;
  }

  async update(id: string, dto: UpdateExpenseDto, storeId?: string) {
    const updatePayload: any = { ...dto, updatedAt: new Date() };
    if (dto.expenseDate) {
      updatePayload.expenseDate = new Date(dto.expenseDate);
    }
    const conditions = [eq(expenses.id, id)];
    if (storeId) conditions.push(eq(expenses.storeId, storeId));
    const [expense] = await this.db
      .update(expenses)
      .set(updatePayload)
      .where(and(...conditions))
      .returning();
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  async approve(id: string, staffId: string, storeId?: string) {
    const conditions = [eq(expenses.id, id)];
    if (storeId) conditions.push(eq(expenses.storeId, storeId));
    const [expense] = await this.db
      .update(expenses)
      .set({ approvedById: staffId, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  async getSummaryByCategory(storeId: string, from?: string, to?: string) {
    const conditions: any[] = [eq(expenses.storeId, storeId)];
    if (from) conditions.push(gte(expenses.expenseDate, new Date(from)));
    if (to) conditions.push(lte(expenses.expenseDate, new Date(to)));

    const byCategory = await this.db
      .select({
        categoryId: expenses.categoryId,
        categoryName: expenseCategories.name,
        total: sql<number>`sum(${expenses.amountPesewas})`,
        count: sql<number>`count(*)`,
      })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(and(...conditions))
      .groupBy(expenses.categoryId, expenseCategories.name);

    // Flat totals the frontend StatCards read
    const totalAmountPesewas = byCategory.reduce((sum, c) => sum + Number(c.total), 0);

    // This-month total
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [monthRow] = await this.db
      .select({ total: sql<number>`coalesce(sum(${expenses.amountPesewas}), 0)::int` })
      .from(expenses)
      .where(and(eq(expenses.storeId, storeId), gte(expenses.expenseDate, monthStart)));

    return {
      totalAmountPesewas,
      thisMonthPesewas: Number(monthRow?.total ?? 0),
      byCategory,
    };
  }
}
