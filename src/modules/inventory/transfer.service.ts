import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, sql, desc, asc, or, ilike, gte, inArray } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import {
  stores,
  stockItems,
  stockBatches,
  products,
  stockTransfers,
  stockTransferItems,
  stockMovements,
  ledgerEntries,
} from '../../database/schema';
import { CreateTransferDto, TransferApprovalDto } from './dto/transfer.dto';

@Injectable()
export class TransferService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async listTransfers(query?: {
    storeId?: string;
    fromStoreId?: string;
    toStoreId?: string;
    status?: string;
    search?: string;
  }) {
    const whereConditions: any[] = [];

    if (query?.storeId && query.storeId !== 'all') {
      whereConditions.push(
        or(
          eq(stockTransfers.fromStoreId, query.storeId),
          eq(stockTransfers.toStoreId, query.storeId),
        ),
      );
    }

    if (query?.fromStoreId && query.fromStoreId !== 'all') {
      whereConditions.push(eq(stockTransfers.fromStoreId, query.fromStoreId));
    }

    if (query?.toStoreId && query.toStoreId !== 'all') {
      whereConditions.push(eq(stockTransfers.toStoreId, query.toStoreId));
    }

    if (query?.status && query.status !== 'all') {
      whereConditions.push(eq(stockTransfers.status, query.status as any));
    }

    if (query?.search) {
      whereConditions.push(
        or(
          ilike(stockTransfers.transferNumber, `%${query.search}%`),
          ilike(stockTransfers.notes, `%${query.search}%`),
        ),
      );
    }

    const where = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const transfers = await this.db.query.stockTransfers.findMany({
      where,
      with: {
        fromStore: { columns: { id: true, name: true, code: true, city: true } },
        toStore: { columns: { id: true, name: true, code: true, city: true } },
        initiatedBy: { columns: { id: true, firstName: true, lastName: true, role: true } },
        receivedBy: { columns: { id: true, firstName: true, lastName: true, role: true } },
        items: {
          with: {
            product: {
              columns: { id: true, name: true, sku: true, imageUrl: true, costPricePesewas: true },
            },
          },
        },
      },
      orderBy: [desc(stockTransfers.createdAt)],
    });

    return transfers.map((t) => {
      const totalUnits = t.items.reduce((acc, it) => acc + (it.quantityRequested || 0), 0);
      const totalCostPesewas = t.items.reduce(
        (acc, it) => acc + (it.quantityRequested || 0) * (it.unitCostPesewas || 0),
        0,
      );
      return {
        ...t,
        totalUnits,
        totalCostPesewas,
        itemCount: t.items.length,
      };
    });
  }

  async getTransferStats(storeId?: string) {
    const whereConditions: any[] = [];
    if (storeId && storeId !== 'all') {
      whereConditions.push(
        or(
          eq(stockTransfers.fromStoreId, storeId),
          eq(stockTransfers.toStoreId, storeId),
        ),
      );
    }
    const where = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const [stats] = await this.db
      .select({
        totalTransfers: sql<number>`count(*)::int`,
        pendingCount: sql<number>`count(case when ${stockTransfers.status} = 'pending_approval' then 1 end)::int`,
        inTransitCount: sql<number>`count(case when ${stockTransfers.status} = 'in_transit' then 1 end)::int`,
        approvedCount: sql<number>`count(case when ${stockTransfers.status} = 'approved' then 1 end)::int`,
        rejectedCount: sql<number>`count(case when ${stockTransfers.status} = 'rejected' then 1 end)::int`,
      })
      .from(stockTransfers)
      .where(where);

    return {
      totalTransfers: Number(stats?.totalTransfers ?? 0),
      pendingCount: Number(stats?.pendingCount ?? 0),
      inTransitCount: Number(stats?.inTransitCount ?? 0),
      approvedCount: Number(stats?.approvedCount ?? 0),
      rejectedCount: Number(stats?.rejectedCount ?? 0),
    };
  }

  async getTransferById(id: string, scopedStoreId?: string) {
    const transfer = await this.db.query.stockTransfers.findFirst({
      where: scopedStoreId
        ? and(eq(stockTransfers.id, id), or(eq(stockTransfers.fromStoreId, scopedStoreId), eq(stockTransfers.toStoreId, scopedStoreId)))
        : eq(stockTransfers.id, id),
      with: {
        fromStore: true,
        toStore: true,
        initiatedBy: { columns: { id: true, firstName: true, lastName: true, role: true } },
        receivedBy: { columns: { id: true, firstName: true, lastName: true, role: true } },
        items: {
          with: {
            product: true,
          },
        },
      },
    });

    if (!transfer) throw new NotFoundException('Transfer not found');

    const totalUnits = transfer.items.reduce((acc, it) => acc + (it.quantityRequested || 0), 0);
    const totalCostPesewas = transfer.items.reduce(
      (acc, it) => acc + (it.quantityRequested || 0) * (it.unitCostPesewas || 0),
      0,
    );

    return {
      ...transfer,
      totalUnits,
      totalCostPesewas,
    };
  }

  private async moveBatches(
    tx: any,
    productId: string,
    fromStoreId: string,
    toStoreId: string,
    quantity: number,
    fallbackCostPesewas: number,
    transferNumber: string,
  ) {
    const sourceBatches = await tx
      .select()
      .from(stockBatches)
      .where(and(
        eq(stockBatches.productId, productId),
        eq(stockBatches.storeId, fromStoreId),
        eq(stockBatches.isActive, true),
        gte(stockBatches.quantityRemaining, 1),
      ))
      .orderBy(asc(stockBatches.expiryDate), asc(stockBatches.receivedAt))
      .for('update');

    let remaining = quantity;
    for (const batch of sourceBatches) {
      if (remaining <= 0) break;
      const moved = Math.min(remaining, batch.quantityRemaining);
      await tx
        .update(stockBatches)
        .set({
          quantityRemaining: sql`${stockBatches.quantityRemaining} - ${moved}`,
          isActive: batch.quantityRemaining - moved > 0,
        })
        .where(and(eq(stockBatches.id, batch.id), gte(stockBatches.quantityRemaining, moved)));

      await tx.insert(stockBatches).values({
        productId,
        storeId: toStoreId,
        supplierId: batch.supplierId,
        purchaseOrderId: null,
        batchNumber: (batch.batchNumber ? `${batch.batchNumber}-${transferNumber}` : transferNumber).slice(0, 100),
        quantityReceived: moved,
        quantityRemaining: moved,
        costPricePesewas: batch.costPricePesewas,
        expiryDate: batch.expiryDate,
        manufacturedDate: batch.manufacturedDate,
        receivedAt: new Date(),
        isActive: true,
      });
      remaining -= moved;
    }

    if (remaining > 0) {
      await tx.insert(stockBatches).values({
        productId,
        storeId: toStoreId,
        batchNumber: transferNumber,
        quantityReceived: remaining,
        quantityRemaining: remaining,
        costPricePesewas: fallbackCostPesewas,
        receivedAt: new Date(),
        isActive: true,
      });
    }
  }

  async createTransfer(data: CreateTransferDto, userId: string, scopedStoreId: string, role: string) {
    const elevated = ['owner', 'root', 'super_admin'].includes((role || '').toLowerCase());
    if (!elevated && data.fromStoreId !== scopedStoreId) {
      throw new BadRequestException('Transfers can only be initiated from your assigned branch');
    }
    if (data.instantTransfer && !elevated) {
      throw new BadRequestException('Instant transfers require owner or root authorization');
    }

    const trnNum = `TRN-${Date.now().toString().slice(-6)}`;

    // Ensure stores exist
    const [fromStore, toStore] = await Promise.all([
      this.db.query.stores.findFirst({ where: eq(stores.id, data.fromStoreId) }),
      this.db.query.stores.findFirst({ where: eq(stores.id, data.toStoreId) }),
    ]);

    if (!fromStore) throw new NotFoundException('Source store not found');
    if (!toStore) throw new NotFoundException('Destination store not found');
    if (fromStore.status !== 'active') throw new BadRequestException('Source branch is not active');
    if (toStore.status !== 'active') throw new BadRequestException('Destination branch is not active');

    if (data.fromStoreId === data.toStoreId) {
      throw new BadRequestException('Source and destination branches must be different');
    }

    const productRows = await this.db
      .select({ id: products.id, costPricePesewas: products.costPricePesewas })
      .from(products)
      .where(inArray(products.id, data.items.map((item) => item.productId)));
    const costs = new Map(productRows.map((product) => [product.id, product.costPricePesewas]));
    if (costs.size !== new Set(data.items.map((item) => item.productId)).size) {
      throw new NotFoundException('One or more transfer products do not exist');
    }
    const resolvedItems = data.items.map((item) => ({
      ...item,
      unitCostPesewas: costs.get(item.productId) ?? 0,
    }));

    return this.db.transaction(async (tx) => {
      const isInstant = Boolean(data.instantTransfer);
      const initialStatus = isInstant ? 'approved' : 'pending_approval';

      // 1. Create transfer record
      const [transfer] = await tx
        .insert(stockTransfers)
        .values({
          transferNumber: trnNum,
          fromStoreId: data.fromStoreId,
          toStoreId: data.toStoreId,
          status: initialStatus,
          notes: data.notes,
          initiatedById: userId || null,
          receivedById: isInstant ? userId || null : null,
          dispatchedAt: isInstant ? new Date() : null,
          receivedAt: isInstant ? new Date() : null,
        })
        .returning();

      // 2. Create items
      const itemsToInsert = resolvedItems.map((item) => ({
        transferId: transfer.id,
        productId: item.productId,
        quantityRequested: item.quantityRequested,
        quantityDispatched: isInstant ? item.quantityRequested : 0,
        quantityReceived: isInstant ? item.quantityRequested : 0,
        unitCostPesewas: item.unitCostPesewas,
      }));

      await tx.insert(stockTransferItems).values(itemsToInsert);

      // 3. If instant transfer, move stock immediately & record ledger adjustments
      if (isInstant) {
        let totalCostValuePesewas = 0;

        for (const item of resolvedItems) {
          totalCostValuePesewas += (item.quantityRequested || 0) * (item.unitCostPesewas || 0);

          // Check source stock
          const sourceStock = await tx.query.stockItems.findFirst({
            where: and(
              eq(stockItems.storeId, transfer.fromStoreId),
              eq(stockItems.productId, item.productId),
            ),
          });

          const currentQty = sourceStock ? sourceStock.quantityOnHand : 0;
          if (currentQty < item.quantityRequested) {
            throw new ConflictException(
              `Insufficient stock for product in source branch. Available: ${currentQty}, Requested: ${item.quantityRequested}`,
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
            .where(and(eq(stockItems.id, sourceStock!.id), gte(stockItems.quantityOnHand, item.quantityRequested)))
            .returning();

          if (!updatedSource) {
            throw new ConflictException('Source stock changed during transfer. Refresh and try again.');
          }

          await this.moveBatches(
            tx,
            item.productId,
            transfer.fromStoreId,
            transfer.toStoreId,
            item.quantityRequested,
            item.unitCostPesewas,
            trnNum,
          );

          // Movement transfer_out
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
            notes: `Instant Transfer to ${toStore.name} (${trnNum})`,
          });

          // Add to destination store (upsert)
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

          // Movement transfer_in
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
            notes: `Instant Transfer from ${fromStore.name} (${trnNum})`,
          });
        }

        // Ledger entries for inter-branch inventory asset balance
        if (totalCostValuePesewas > 0) {
          await tx.insert(ledgerEntries).values({
            storeId: transfer.fromStoreId,
            entryType: 'credit',
            category: 'adjustment',
            amountPesewas: totalCostValuePesewas,
            description: `Inter-Branch Stock Transfer Out to ${toStore.name} (${trnNum})`,
            referenceType: 'transfer',
            referenceId: transfer.id,
            performedById: userId,
          });

          await tx.insert(ledgerEntries).values({
            storeId: transfer.toStoreId,
            entryType: 'debit',
            category: 'adjustment',
            amountPesewas: totalCostValuePesewas,
            description: `Inter-Branch Stock Transfer In from ${fromStore.name} (${trnNum})`,
            referenceType: 'transfer',
            referenceId: transfer.id,
            performedById: userId,
          });
        }
      }

      this.realtimeGateway.broadcastToStore(transfer.fromStoreId, 'inventory:update', {
        action: isInstant ? 'transfer_completed' : 'transfer_created',
        payload: { transferId: transfer.id },
      });
      this.realtimeGateway.broadcastToStore(transfer.toStoreId, 'inventory:update', {
        action: isInstant ? 'transfer_completed' : 'transfer_created',
        payload: { transferId: transfer.id },
      });

      return {
        message: isInstant
          ? 'Transfer executed and stock moved successfully'
          : 'Transfer request submitted for approval',
        transferId: transfer.id,
        transferNumber: trnNum,
        status: initialStatus,
      };
    });
  }

  async approveTransfer(id: string, data: TransferApprovalDto, userId: string, scopedStoreId: string, role: string) {
    return this.db.transaction(async (tx) => {
      const transfer = await tx.query.stockTransfers.findFirst({
        where: eq(stockTransfers.id, id),
        with: {
          items: true,
          fromStore: true,
          toStore: true,
        },
      });

      if (!transfer) throw new NotFoundException('Transfer not found');
      const elevated = ['owner', 'root', 'super_admin'].includes((role || '').toLowerCase());
      if (!elevated && transfer.fromStoreId !== scopedStoreId && transfer.toStoreId !== scopedStoreId) {
        throw new BadRequestException('You cannot approve a transfer outside your branch');
      }
      if (transfer.status !== 'pending_approval') {
        throw new ConflictException(`Cannot approve transfer in status: ${transfer.status}`);
      }

      let totalCostValuePesewas = 0;

      for (const item of transfer.items) {
        totalCostValuePesewas += (item.quantityRequested || 0) * (item.unitCostPesewas || 0);

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
            `Insufficient stock for product ${item.productId} in source branch. Available: ${currentQty}, Requested: ${item.quantityRequested}`,
          );
        }

        // Deduct from source branch
        const [updatedSource] = await tx
          .update(stockItems)
          .set({
            quantityOnHand: sql`${stockItems.quantityOnHand} - ${item.quantityRequested}`,
            updatedAt: new Date(),
            lastMovementAt: new Date(),
          })
          .where(and(eq(stockItems.id, sourceStock!.id), gte(stockItems.quantityOnHand, item.quantityRequested)))
          .returning();

        if (!updatedSource) {
          throw new ConflictException('Source stock changed during approval. Refresh and try again.');
        }

        await this.moveBatches(
          tx,
          item.productId,
          transfer.fromStoreId,
          transfer.toStoreId,
          item.quantityRequested,
          item.unitCostPesewas,
          transfer.transferNumber,
        );

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
          notes: data.notes || `Transfer ${transfer.transferNumber} to ${transfer.toStore.name}`,
        });

        // Add to destination branch
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
          notes: data.notes || `Transfer ${transfer.transferNumber} from ${transfer.fromStore.name}`,
        });

        // Update item quantity received
        await tx
          .update(stockTransferItems)
          .set({
            quantityDispatched: item.quantityRequested,
            quantityReceived: item.quantityRequested,
          })
          .where(eq(stockTransferItems.id, item.id));
      }

      // Record inter-branch accounting adjustment
      if (totalCostValuePesewas > 0) {
        await tx.insert(ledgerEntries).values({
          storeId: transfer.fromStoreId,
          entryType: 'credit',
          category: 'adjustment',
          amountPesewas: totalCostValuePesewas,
          description: `Inter-Branch Stock Transfer Out to ${transfer.toStore.name} (${transfer.transferNumber})`,
          referenceType: 'transfer',
          referenceId: transfer.id,
          performedById: userId,
        });

        await tx.insert(ledgerEntries).values({
          storeId: transfer.toStoreId,
          entryType: 'debit',
          category: 'adjustment',
          amountPesewas: totalCostValuePesewas,
          description: `Inter-Branch Stock Transfer In from ${transfer.fromStore.name} (${transfer.transferNumber})`,
          referenceType: 'transfer',
          referenceId: transfer.id,
          performedById: userId,
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
          notes: data.notes
            ? sql`CONCAT(${stockTransfers.notes}, '\nApproval Note: ', ${data.notes})`
            : stockTransfers.notes,
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

      return { message: 'Transfer approved, stock moved, and accounting ledger synced' };
    });
  }

  async rejectTransfer(id: string, data: TransferApprovalDto, userId: string, scopedStoreId: string, role: string) {
    const elevated = ['owner', 'root', 'super_admin'].includes((role || '').toLowerCase());
    const [updated] = await this.db
      .update(stockTransfers)
      .set({
        status: 'rejected',
        notes: data.notes
          ? sql`CONCAT(${stockTransfers.notes}, '\nRejection Note: ', ${data.notes})`
          : stockTransfers.notes,
        updatedAt: new Date(),
      })
      .where(and(
        eq(stockTransfers.id, id),
        eq(stockTransfers.status, 'pending_approval'),
        elevated ? sql`true` : or(eq(stockTransfers.fromStoreId, scopedStoreId), eq(stockTransfers.toStoreId, scopedStoreId)),
      ))
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
