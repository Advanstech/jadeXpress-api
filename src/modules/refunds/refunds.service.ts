import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import {
  refundRequests,
  refundItems,
  saleItems,
  sales,
  stockItems,
  stockMovements,
  ledgerEntries,
} from '../../database/schema';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import type { CreateRefundDto } from './dto/refunds.dto';

@Injectable()
export class RefundsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async list(storeId: string, query: PaginationDto) {
    const { page, limit } = query;
    const offset = (page - 1) * limit;
    const where = eq(refundRequests.storeId, storeId);

    const [data, [{ count }]] = await Promise.all([
      this.db.select().from(refundRequests).where(where)
        .orderBy(desc(refundRequests.createdAt)).limit(limit).offset(offset),
      this.db.select({ count: sql<number>`count(*)` }).from(refundRequests).where(where),
    ]);
    return paginate(data, Number(count), page, limit);
  }

  async getById(id: string) {
    const [refund] = await this.db
      .select()
      .from(refundRequests)
      .where(eq(refundRequests.id, id))
      .limit(1);
    if (!refund) throw new NotFoundException('Refund not found');

    const items = await this.db
      .select()
      .from(refundItems)
      .where(eq(refundItems.refundRequestId, id));

    return { ...refund, items };
  }

  async create(dto: CreateRefundDto, initiatedById: string) {
    const totalAmountPesewas = dto.items.reduce(
      (sum, i) => sum + i.unitPricePesewas * i.quantity,
      0,
    );

    // Insert refund request
    const [refund] = await this.db.insert(refundRequests).values({
      saleId: dto.saleId,
      storeId: dto.storeId,
      initiatedById,
      authorizedById: dto.authorizedById,
      reason: dto.reason,
      method: dto.method,
      status: 'approved',
      totalAmountPesewas,
      momoReference: dto.momoReference,
      notes: dto.notes,
      processedAt: new Date(),
    }).returning();

    // Insert refund items
    await this.db.insert(refundItems).values(
      dto.items.map((i) => ({
        refundRequestId: refund.id,
        saleItemId: i.saleItemId,
        productId: i.productId,
        quantity: i.quantity,
        unitPricePesewas: i.unitPricePesewas,
        lineTotalPesewas: i.unitPricePesewas * i.quantity,
        restockToInventory: i.restockToInventory,
      })),
    );

    // Restock inventory for items flagged for restocking
    for (const item of dto.items.filter((i) => i.restockToInventory)) {
      const [existing] = await this.db
        .select()
        .from(stockItems)
        .where(and(eq(stockItems.productId, item.productId), eq(stockItems.storeId, dto.storeId)))
        .limit(1);

      const qtyBefore = existing?.quantityOnHand ?? 0;
      const qtyAfter = qtyBefore + item.quantity;

      if (existing) {
        await this.db
          .update(stockItems)
          .set({ quantityOnHand: qtyAfter, lastMovementAt: new Date(), updatedAt: new Date() })
          .where(and(eq(stockItems.productId, item.productId), eq(stockItems.storeId, dto.storeId)));
      } else {
        await this.db.insert(stockItems).values({
          productId: item.productId,
          storeId: dto.storeId,
          quantityOnHand: qtyAfter,
          lastMovementAt: new Date(),
        });
      }

      await this.db.insert(stockMovements).values({
        productId: item.productId,
        storeId: dto.storeId,
        type: 'return_in',
        quantityChange: item.quantity,
        quantityBefore: qtyBefore,
        quantityAfter: qtyAfter,
        referenceType: 'refund',
        referenceId: refund.id,
        performedById: initiatedById,
      });
    }

    // Ledger entry — debit (money out for refund)
    await this.db.insert(ledgerEntries).values({
      storeId: dto.storeId,
      entryType: 'debit',
      category: 'refund',
      amountPesewas: totalAmountPesewas,
      description: `Refund for sale ${dto.saleId}`,
      referenceType: 'refund',
      referenceId: refund.id,
      performedById: initiatedById,
    });

    // Check if all sale items were refunded → update sale status
    const allSaleItems = await this.db
      .select()
      .from(saleItems)
      .where(eq(saleItems.saleId, dto.saleId));

    const refundedProductIds = new Set(dto.items.map((i) => i.saleItemId));
    const fullyRefunded = allSaleItems.every((si) => refundedProductIds.has(si.id));

    await this.db
      .update(sales)
      .set({
        status: fullyRefunded ? 'refunded' : 'partially_refunded',
        updatedAt: new Date(),
      })
      .where(eq(sales.id, dto.saleId));

    // Mark refund as inventoryRestocked + accountingAdjusted
    await this.db
      .update(refundRequests)
      .set({ inventoryRestocked: true, accountingAdjusted: true })
      .where(eq(refundRequests.id, refund.id));

    return this.getById(refund.id);
  }
}
