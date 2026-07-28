import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
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
import { JwtPayload } from '../../common/decorators/current-user.decorator';

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

  async create(dto: CreateRefundDto, user: JwtPayload) {
    const totalAmountPesewas = dto.items.reduce(
      (sum, i) => sum + i.unitPricePesewas * i.quantity,
      0,
    );
    
    const initiatedById = user.sub;
    const isManager = ['manager', 'owner', 'supervisor', 'root'].includes(user.role);
    const status = (isManager || dto.authorizedById) ? 'approved' : 'pending_approval';

    const createdRefund = await this.db.transaction(async (tx) => {
      const [refund] = await tx.insert(refundRequests).values({
        saleId: dto.saleId,
        storeId: dto.storeId,
        initiatedById,
        authorizedById: dto.authorizedById,
        reason: dto.reason,
        method: dto.method,
        status: status,
        totalAmountPesewas,
        momoReference: dto.momoReference,
        notes: dto.notes,
        processedAt: status === 'approved' ? new Date() : null,
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

      if (status === 'approved') {
        await this.executeRefundEffects(tx, refund, dto.items, dto.storeId, initiatedById);
      }

      return refund;
    });

    const result = await this.getById(createdRefund.id);

    if (status === 'approved') {
      this.realtime.broadcastToStore(dto.storeId, 'refund:completed', {
        refundId: createdRefund.id,
        saleId: dto.saleId,
        totalAmountPesewas: createdRefund.totalAmountPesewas,
      });
    }

    return result;
  }

  async approve(id: string, approvedById: string) {
    const refundData = await this.getById(id);
    if (refundData.status !== 'pending_approval') {
      throw new BadRequestException('Refund is not pending approval');
    }

    await this.db.transaction(async (tx) => {
      await this.executeRefundEffects(tx, refundData, refundData.items, refundData.storeId, approvedById);
      
      await tx.update(refundRequests)
        .set({ 
          status: 'approved', 
          authorizedById: approvedById,
          processedAt: new Date()
        })
        .where(eq(refundRequests.id, id));
    });

    this.realtime.broadcastToStore(refundData.storeId, 'refund:completed', {
      refundId: id,
      saleId: refundData.saleId,
      totalAmountPesewas: refundData.totalAmountPesewas,
    });

    return this.getById(id);
  }

  async reject(id: string, rejectedById: string) {
    const refundData = await this.getById(id);
    if (refundData.status !== 'pending_approval') {
      throw new BadRequestException('Refund is not pending approval');
    }

    await this.db.update(refundRequests)
      .set({ 
        status: 'rejected',
        authorizedById: rejectedById,
        processedAt: new Date()
      })
      .where(eq(refundRequests.id, id));

    return this.getById(id);
  }

  private async executeRefundEffects(tx: any, refund: any, items: any[], storeId: string, performedById: string) {
    for (const item of items.filter((i: any) => i.restockToInventory)) {
      const [existing] = await tx
        .select()
        .from(stockItems)
        .where(and(eq(stockItems.productId, item.productId), eq(stockItems.storeId, storeId)))
        .limit(1);

      const qtyBefore = existing?.quantityOnHand ?? 0;
      const qtyAfter = qtyBefore + item.quantity;

      if (existing) {
        await tx
          .update(stockItems)
          .set({ quantityOnHand: qtyAfter, lastMovementAt: new Date(), updatedAt: new Date() })
          .where(and(eq(stockItems.productId, item.productId), eq(stockItems.storeId, storeId)));
      } else {
        await tx.insert(stockItems).values({
          productId: item.productId,
          storeId: storeId,
          quantityOnHand: qtyAfter,
          lastMovementAt: new Date(),
        });
      }

      await tx.insert(stockMovements).values({
        productId: item.productId,
        storeId: storeId,
        type: 'return_in',
        quantityChange: item.quantity,
        quantityBefore: qtyBefore,
        quantityAfter: qtyAfter,
        referenceType: 'refund',
        referenceId: refund.id,
        performedById: performedById,
      });
    }

    await tx.insert(ledgerEntries).values({
      storeId: storeId,
      entryType: 'debit',
      category: 'refund',
      amountPesewas: refund.totalAmountPesewas,
      description: `Refund for sale ${refund.saleId}`,
      referenceType: 'refund',
      referenceId: refund.id,
      performedById: performedById,
    });

    const allSaleItems = await tx
      .select()
      .from(saleItems)
      .where(eq(saleItems.saleId, refund.saleId));

    const refundedProductIds = new Set(items.map((i: any) => i.saleItemId));
    const fullyRefunded = allSaleItems.every((si: any) => refundedProductIds.has(si.id));

    await tx
      .update(sales)
      .set({
        status: fullyRefunded ? 'refunded' : 'partially_refunded',
        updatedAt: new Date(),
      })
      .where(eq(sales.id, refund.saleId));

    await tx
      .update(refundRequests)
      .set({ inventoryRestocked: true, accountingAdjusted: true })
      .where(eq(refundRequests.id, refund.id));
  }
}
