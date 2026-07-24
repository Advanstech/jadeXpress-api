import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { RealtimeGateway } from '../realtime/realtime.gateway';
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
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly realtime: RealtimeGateway,
  ) {}

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

    const createdRefund = await this.db.transaction(async (tx) => {
      const [refund] = await tx.insert(refundRequests).values({
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

      await tx.insert(refundItems).values(
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

      for (const item of dto.items.filter((i) => i.restockToInventory)) {
        const [existing] = await tx
          .select()
          .from(stockItems)
          .where(and(eq(stockItems.productId, item.productId), eq(stockItems.storeId, dto.storeId)))
          .limit(1);

        const qtyBefore = existing?.quantityOnHand ?? 0;
        const qtyAfter = qtyBefore + item.quantity;

        if (existing) {
          await tx
            .update(stockItems)
            .set({ quantityOnHand: qtyAfter, lastMovementAt: new Date(), updatedAt: new Date() })
            .where(and(eq(stockItems.productId, item.productId), eq(stockItems.storeId, dto.storeId)));
        } else {
          await tx.insert(stockItems).values({
            productId: item.productId,
            storeId: dto.storeId,
            quantityOnHand: qtyAfter,
            lastMovementAt: new Date(),
          });
        }

        await tx.insert(stockMovements).values({
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

      await tx.insert(ledgerEntries).values({
        storeId: dto.storeId,
        entryType: 'debit',
        category: 'refund',
        amountPesewas: totalAmountPesewas,
        description: `Refund for sale ${dto.saleId}`,
        referenceType: 'refund',
        referenceId: refund.id,
        performedById: initiatedById,
      });

      const allSaleItems = await tx
        .select()
        .from(saleItems)
        .where(eq(saleItems.saleId, dto.saleId));

      const refundedProductIds = new Set(dto.items.map((i) => i.saleItemId));
      const fullyRefunded = allSaleItems.every((si) => refundedProductIds.has(si.id));

      await tx
        .update(sales)
        .set({
          status: fullyRefunded ? 'refunded' : 'partially_refunded',
          updatedAt: new Date(),
        })
        .where(eq(sales.id, dto.saleId));

      await tx
        .update(refundRequests)
        .set({ inventoryRestocked: true, accountingAdjusted: true })
        .where(eq(refundRequests.id, refund.id));

      return refund;
    });

    const result = await this.getById(createdRefund.id);

    this.realtime.broadcastToStore(dto.storeId, 'refund:completed', {
      refundId: createdRefund.id,
      saleId: dto.saleId,
      totalAmountPesewas: createdRefund.totalAmountPesewas,
    });

    return result;
  }
}
