import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, sql, desc } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import {
  stores,
  stockItems,
  stockTransfers,
  stockTransferItems,
  stockMovements,
} from '../../database/schema';
import { CreateTransferDto, TransferApprovalDto } from './dto/transfer.dto';

@Injectable()
export class TransferService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async listTransfers() {
    // Basic listing with relations
    const transfers = await this.db.query.stockTransfers.findMany({
      with: {
        fromStore: { columns: { id: true, name: true, code: true } },
        toStore: { columns: { id: true, name: true, code: true } },
        items: {
          with: {
            product: { columns: { id: true, name: true, sku: true } },
          },
        },
      },
      orderBy: [desc(stockTransfers.createdAt)],
    });

    return transfers;
  }

  async getTransferById(id: string) {
    const transfer = await this.db.query.stockTransfers.findFirst({
      where: eq(stockTransfers.id, id),
      with: {
        fromStore: { columns: { id: true, name: true, code: true } },
        toStore: { columns: { id: true, name: true, code: true } },
        items: {
          with: {
            product: { columns: { id: true, name: true, sku: true } },
          },
        },
      },
    });

    if (!transfer) throw new NotFoundException('Transfer not found');
    return transfer;
  }

  async createTransfer(data: CreateTransferDto, userId?: string) {
    // Generate transfer number
    const trnNum = `TRN-${Date.now().toString().slice(-6)}`;

    // Ensure stores exist
    const [fromStore, toStore] = await Promise.all([
      this.db.query.stores.findFirst({ where: eq(stores.id, data.fromStoreId) }),
      this.db.query.stores.findFirst({ where: eq(stores.id, data.toStoreId) }),
    ]);

    if (!fromStore) throw new NotFoundException('Source store not found');
    if (!toStore) throw new NotFoundException('Destination store not found');

    if (data.fromStoreId === data.toStoreId) {
      throw new BadRequestException('Source and destination must be different');
    }

    return this.db.transaction(async (tx) => {
      // 1. Create transfer record
      const [transfer] = await tx
        .insert(stockTransfers)
        .values({
          transferNumber: trnNum,
          fromStoreId: data.fromStoreId,
          toStoreId: data.toStoreId,
          status: 'pending_approval',
          notes: data.notes,
          initiatedById: userId || null,
        })
        .returning();

      // 2. Create items
      const itemsToInsert = data.items.map((item) => ({
        transferId: transfer.id,
        productId: item.productId,
        quantityRequested: item.quantityRequested,
        unitCostPesewas: item.unitCostPesewas,
      }));

      await tx.insert(stockTransferItems).values(itemsToInsert);

      this.realtimeGateway.broadcastToStore(transfer.fromStoreId, 'inventory:update', {
        action: 'transfer_created',
        payload: { transferId: transfer.id },
      });
      this.realtimeGateway.broadcastToStore(transfer.toStoreId, 'inventory:update', {
        action: 'transfer_created',
        payload: { transferId: transfer.id },
      });

      return {
        message: 'Transfer request created successfully',
        transferId: transfer.id,
        transferNumber: trnNum,
      };
    });
  }

  async approveTransfer(id: string, data: TransferApprovalDto, userId?: string) {
    return this.db.transaction(async (tx) => {
      // Fetch transfer
      const transfer = await tx.query.stockTransfers.findFirst({
        where: eq(stockTransfers.id, id),
        with: { items: true },
      });

      if (!transfer) throw new NotFoundException('Transfer not found');
      if (transfer.status !== 'pending_approval') {
        throw new ConflictException(`Cannot approve transfer in status: ${transfer.status}`);
      }

      // Check stock availability in source store and move stock
      for (const item of transfer.items) {
        // Fetch source stock
        const sourceStock = await tx.query.stockItems.findFirst({
          where: and(
            eq(stockItems.storeId, transfer.fromStoreId),
            eq(stockItems.productId, item.productId),
          ),
        });

        const currentQty = sourceStock ? sourceStock.quantityOnHand : 0;
        if (currentQty < item.quantityRequested) {
          throw new ConflictException(
            `Insufficient stock for product ${item.productId} in source store. Available: ${currentQty}, Requested: ${item.quantityRequested}`,
          );
        }

        // Deduct from source store
        const [updatedSource] = await tx
          .update(stockItems)
          .set({
            quantityOnHand: sql`${stockItems.quantityOnHand} - ${item.quantityRequested}`,
            updatedAt: new Date(),
            lastMovementAt: new Date(),
          })
          .where(eq(stockItems.id, sourceStock!.id))
          .returning();

        // Record transfer_out movement
        await tx.insert(stockMovements).values({
          productId: item.productId,
          storeId: transfer.fromStoreId,
          type: 'transfer_out',
          quantityChange: -item.quantityRequested,
          quantityBefore: currentQty,
          quantityAfter: updatedSource.quantityOnHand,
          referenceType: 'transfer',
          referenceId: transfer.id,
          performedById: userId,
          notes: data.notes || `Transfer ${transfer.transferNumber} to store ${transfer.toStoreId}`,
        });

        // Add to destination store (create if not exists)
        const destStock = await tx.query.stockItems.findFirst({
          where: and(
            eq(stockItems.storeId, transfer.toStoreId),
            eq(stockItems.productId, item.productId),
          ),
        });

        let newDestQty = 0;
        if (destStock) {
          const [updatedDest] = await tx
            .update(stockItems)
            .set({
              quantityOnHand: sql`${stockItems.quantityOnHand} + ${item.quantityRequested}`,
              updatedAt: new Date(),
              lastMovementAt: new Date(),
            })
            .where(eq(stockItems.id, destStock.id))
            .returning();
          newDestQty = updatedDest.quantityOnHand;
        } else {
          const [insertedDest] = await tx
            .insert(stockItems)
            .values({
              storeId: transfer.toStoreId,
              productId: item.productId,
              quantityOnHand: item.quantityRequested,
              lastMovementAt: new Date(),
            })
            .returning();
          newDestQty = insertedDest.quantityOnHand;
        }

        // Record transfer_in movement
        await tx.insert(stockMovements).values({
          productId: item.productId,
          storeId: transfer.toStoreId,
          type: 'transfer_in',
          quantityChange: item.quantityRequested,
          quantityBefore: destStock ? destStock.quantityOnHand : 0,
          quantityAfter: newDestQty,
          referenceType: 'transfer',
          referenceId: transfer.id,
          performedById: userId,
          notes: data.notes || `Transfer ${transfer.transferNumber} from store ${transfer.fromStoreId}`,
        });
      }

      // Update transfer status
      await tx
        .update(stockTransfers)
        .set({
          status: 'approved',
          receivedById: userId || null,
          dispatchedAt: new Date(),
          receivedAt: new Date(),
          notes: data.notes ? sql`CONCAT(${stockTransfers.notes}, '\nApproval Note: ', ${data.notes})` : stockTransfers.notes,
          updatedAt: new Date(),
        })
        .where(eq(stockTransfers.id, transfer.id));

      this.realtimeGateway.broadcastToStore(transfer.fromStoreId, 'inventory:update', {
        action: 'transfer_approved',
        payload: { transferId: transfer.id },
      });
      this.realtimeGateway.broadcastToStore(transfer.toStoreId, 'inventory:update', {
        action: 'transfer_approved',
        payload: { transferId: transfer.id },
      });

      return { message: 'Transfer approved and stock moved successfully' };
    });
  }

  async rejectTransfer(id: string, data: TransferApprovalDto, userId?: string) {
    const [updated] = await this.db
      .update(stockTransfers)
      .set({
        status: 'rejected',
        notes: data.notes ? sql`CONCAT(${stockTransfers.notes}, '\nRejection Note: ', ${data.notes})` : stockTransfers.notes,
        updatedAt: new Date(),
      })
      .where(and(eq(stockTransfers.id, id), eq(stockTransfers.status, 'pending_approval')))
      .returning();

    if (!updated) {
      throw new ConflictException('Transfer not found or cannot be rejected in current status');
    }

    this.realtimeGateway.broadcastToStore(updated.fromStoreId, 'inventory:update', {
      action: 'transfer_rejected',
      payload: { transferId: id },
    });
    this.realtimeGateway.broadcastToStore(updated.toStoreId, 'inventory:update', {
      action: 'transfer_rejected',
      payload: { transferId: id },
    });

    return { message: 'Transfer rejected successfully' };
  }
}
