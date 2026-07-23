import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, gte, lte, desc, sql, or, isNull } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { expenses, expenseCategories, ledgerEntries } from '../../database/schema';
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
      this.db.select().from(expenses).where(where)
        .orderBy(desc(expenses.expenseDate)).limit(limit).offset(offset),
      this.db.select({ count: sql<number>`count(*)` }).from(expenses).where(where),
    ]);
    return paginate(data, Number(count), page, limit);
  }

  async getById(id: string) {
    const [expense] = await this.db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
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

  async update(id: string, dto: UpdateExpenseDto) {
    const updatePayload: any = { ...dto, updatedAt: new Date() };
    if (dto.expenseDate) {
      updatePayload.expenseDate = new Date(dto.expenseDate);
    }
    const [expense] = await this.db
      .update(expenses)
      .set(updatePayload)
      .where(eq(expenses.id, id))
      .returning();
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  async approve(id: string, staffId: string) {
    const [expense] = await this.db
      .update(expenses)
      .set({ approvedById: staffId, updatedAt: new Date() })
      .where(eq(expenses.id, id))
      .returning();
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  async getSummaryByCategory(storeId: string, from: string, to: string) {
    return this.db
      .select({
        categoryId: expenses.categoryId,
        total: sql<number>`sum(${expenses.amountPesewas})`,
        count: sql<number>`count(*)`,
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.storeId, storeId),
          gte(expenses.expenseDate, new Date(from)),
          lte(expenses.expenseDate, new Date(to)),
        ),
      )
      .groupBy(expenses.categoryId);
  }
}
