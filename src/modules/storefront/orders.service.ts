import { Injectable, Inject, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and, desc, inArray, gte, ne, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import {
  storefrontOrders,
  storefrontOrderItems,
  products,
  stockItems,
  stockBatches,
  stockMovements,
  ledgerEntries,
  stores,
  organisation,
} from '../../database/schema';
import type { CreateOrderDto, UpdateOrderStatusDto } from './dto/order.dto';
import { EmailService } from '../email/email.service';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class OrdersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly email: EmailService,
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  private generateOrderNumber() {
    const now = new Date();
    const stamp = now.toISOString().slice(2, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `JX-${stamp}-${rand}`;
  }

  // The physical store that fulfils online orders and whose stock pool the
  // storefront sells from. Configurable via STOREFRONT_STORE_ID; falls back
  // to the first active store (single-branch default).
  private async resolveFulfilmentStoreId(): Promise<string> {
    const configured = this.config.get<string>('storefront.storeId');
    if (configured) return configured;
    const [store] = await this.db
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.status, 'active'))
      .limit(1);
    if (!store) {
      throw new BadRequestException('No active store configured to fulfil online orders');
    }
    return store.id;
  }

  async createOrder(customerId: string | null, dto: CreateOrderDto) {
    const storeId = await this.resolveFulfilmentStoreId();
    const orderNumber = this.generateOrderNumber();
    const now = new Date().toISOString();

    const order = await this.db.transaction(async (tx) => {
      // SECURITY: resolve prices & names server-side from the products table —
      // client-sent prices are never trusted (prevents price tampering at checkout).
      const productIds = dto.items.filter((i) => i.productId).map((i) => i.productId!);
      const rows = productIds.length
        ? await tx
            .select({
              id: products.id,
              name: products.name,
              sellingPricePesewas: products.sellingPricePesewas,
              status: products.status,
            })
            .from(products)
            .where(inArray(products.id, productIds))
        : [];
      const productMap = new Map(rows.map((r) => [r.id, r]));

      const resolvedItems = dto.items.map((item) => {
        if (!item.productId) return item; // custom line — keep client data
        const product = productMap.get(item.productId);
        if (!product || product.status !== 'active') {
          throw new BadRequestException(`${item.name} is no longer available`);
        }
        return { ...item, name: product.name, price: product.sellingPricePesewas };
      });

      // ── Stock reservation (same pattern as POS sales) ─────────────────
      // Aggregate per product so duplicate lines validate against combined
      // demand, then lock the stock rows before reading levels.
      const qtyByProduct = new Map<string, number>();
      for (const item of resolvedItems) {
        if (!item.productId) continue;
        qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + item.quantity);
      }

      const stockMap = new Map<string, typeof stockItems.$inferSelect>();
      if (qtyByProduct.size > 0) {
        const locked = await tx
          .select()
          .from(stockItems)
          .where(and(inArray(stockItems.productId, [...qtyByProduct.keys()]), eq(stockItems.storeId, storeId)))
          .for('update');
        for (const row of locked) stockMap.set(row.productId, row);

        for (const [productId, totalQty] of qtyByProduct) {
          const stockItem = stockMap.get(productId);
          const name = productMap.get(productId)?.name ?? 'An item';
          if (!stockItem || stockItem.quantityOnHand < totalQty) {
            const available = stockItem?.quantityOnHand ?? 0;
            throw new ConflictException(
              available <= 0
                ? `${name} is out of stock`
                : `Only ${available} left in stock for ${name}`,
            );
          }
        }
      }

      const subtotalPesewas = resolvedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const totalPesewas = subtotalPesewas + dto.shippingFeePesewas;

      const [order] = await tx
        .insert(storefrontOrders)
        .values({
          orderNumber,
          customerId: customerId ?? undefined,
          storeId,
          email: dto.email.toLowerCase(),
          subtotalPesewas,
          shippingFeePesewas: dto.shippingFeePesewas,
          totalPesewas,
          shippingAddress: dto.shippingAddress,
          paymentGateway: dto.paymentGateway,
          paymentReference: dto.paymentReference,
          notes: dto.notes,
          timeline: [{ status: 'pending', note: 'Order placed', createdAt: now }],
        })
        .returning();

      await tx.insert(storefrontOrderItems).values(
        resolvedItems.map((item) => ({
          orderId: order.id,
          productId: item.productId,
          name: item.name,
          pricePesewas: item.price,
          quantity: item.quantity,
          image: item.image,
        })),
      );

      // Cost price from latest active batch — mirrors POS movement audit data.
      const costPriceMap = new Map<string, number | null>();
      if (qtyByProduct.size > 0) {
        const latestBatches = await tx
          .select({ productId: stockBatches.productId, costPricePesewas: stockBatches.costPricePesewas })
          .from(stockBatches)
          .where(and(
            inArray(stockBatches.productId, [...qtyByProduct.keys()]),
            eq(stockBatches.storeId, storeId),
            eq(stockBatches.isActive, true),
          ))
          .orderBy(desc(stockBatches.receivedAt));
        for (const b of latestBatches) {
          if (!costPriceMap.has(b.productId)) costPriceMap.set(b.productId, b.costPricePesewas);
        }
      }

      // Stock movements — running balance so duplicate lines get correct
      // before/after quantities in the audit trail.
      const movementInserts: any[] = [];
      const runningQty = new Map<string, number>();
      for (const item of resolvedItems) {
        if (!item.productId) continue;
        const stockItem = stockMap.get(item.productId)!;
        const qtyBefore = runningQty.get(item.productId) ?? stockItem.quantityOnHand;
        const qtyAfter = qtyBefore - item.quantity;
        runningQty.set(item.productId, qtyAfter);
        movementInserts.push({
          productId: item.productId,
          storeId,
          type: 'sale_out' as const,
          quantityChange: -item.quantity,
          quantityBefore: qtyBefore,
          quantityAfter: qtyAfter,
          referenceType: 'storefront_order',
          referenceId: order.id,
          costPricePesewas: costPriceMap.get(item.productId) ?? null,
        });
      }
      if (movementInserts.length > 0) {
        await tx.insert(stockMovements).values(movementInserts);
      }

      // Atomic guarded decrements — the gte clause is the last line of defence
      // against oversell if a concurrent POS sale slips past validation.
      await Promise.all(
        [...qtyByProduct.entries()].map(([productId, totalQty]) =>
          tx
            .update(stockItems)
            .set({ quantityOnHand: sql`${stockItems.quantityOnHand} - ${totalQty}`, lastMovementAt: new Date(), updatedAt: new Date() })
            .where(and(
              eq(stockItems.productId, productId),
              eq(stockItems.storeId, storeId),
              gte(stockItems.quantityOnHand, totalQty),
            )),
        ),
      );

      return order;
    });

    const full = await this.getOrderById(order.id);

    this.email
      .sendOrderConfirmation({
        to: order.email,
        orderNumber: order.orderNumber,
        items: full.items.map((i) => ({ name: i.name, quantity: i.quantity, pricePesewas: i.pricePesewas })),
        subtotalPesewas: order.subtotalPesewas,
        shippingFeePesewas: order.shippingFeePesewas,
        totalPesewas: order.totalPesewas,
        shippingAddress: dto.shippingAddress as any,
      })
      .catch((err) => console.error('Failed to send order confirmation email', err));

    return full;
  }

  async markPaid(orderId: string, reference: string, gateway: string, method?: string) {
    const now = new Date().toISOString();
    const [order] = await this.db
      .select()
      .from(storefrontOrders)
      .where(eq(storefrontOrders.id, orderId))
      .limit(1);
    if (!order) throw new NotFoundException('Order not found');

    // Idempotent — replaying a successful webhook/callback is a no-op
    if (order.paymentStatus === 'paid') return order;

    // SECURITY: only Paystack payments can be auto-confirmed, and only after
    // the gateway itself verifies the reference. Anything else (e.g. MoMo)
    // requires staff confirmation — a client saying "paid" is never enough.
    if (gateway !== 'paystack' || !reference) {
      throw new BadRequestException(
        'This payment method requires manual confirmation by our team',
      );
    }

    const verification = await this.payments.verifyPaystack(reference);
    if (verification.status !== 'success') {
      throw new BadRequestException('Payment has not been completed');
    }
    if (verification.amount < order.totalPesewas) {
      throw new BadRequestException('Payment amount does not match the order total');
    }

    const timeline = [
      ...(order.timeline ?? []),
      { status: 'processing', note: 'Payment confirmed', createdAt: now },
    ];

    const updated = await this.db.transaction(async (tx) => {
      // Conditional update — a concurrent confirmation turns this into a
      // no-op instead of double-writing the ledger entry.
      const [row] = await tx
        .update(storefrontOrders)
        .set({
          paymentStatus: 'paid',
          paymentReference: reference,
          paymentGateway: gateway,
          paymentMethod: method,
          status: 'processing',
          timeline,
          updatedAt: new Date(),
        })
        .where(and(eq(storefrontOrders.id, orderId), ne(storefrontOrders.paymentStatus, 'paid')))
        .returning();
      if (!row) return null;

      // Revenue ledger — brings online sales into accounting/cash-flow.
      // Prices are tax-inclusive, same model as POS: extract VAT + levies
      // from the merchandise subtotal (shipping fee is not taxed here).
      const [org] = await tx.select().from(organisation).limit(1);
      const vatRate = (org?.vatRateBps ?? 1500) / 10000;
      const nhilRate = (org?.nhilRateBps ?? 250) / 10000;
      const getfundRate = (org?.getfundRateBps ?? 250) / 10000;
      const levyRate = nhilRate + getfundRate;
      const taxableBase = Math.round(order.subtotalPesewas / ((1 + levyRate) * (1 + vatRate)));
      const nhilAmount = Math.round(taxableBase * nhilRate);
      const getfundAmount = Math.round(taxableBase * getfundRate);
      const vatAmount = Math.max(0, order.subtotalPesewas - taxableBase - nhilAmount - getfundAmount);

      await tx.insert(ledgerEntries).values({
        storeId: order.storeId ?? (await this.resolveFulfilmentStoreId()),
        entryType: 'credit',
        category: 'revenue',
        amountPesewas: order.totalPesewas,
        vatAmountPesewas: vatAmount,
        nhilAmountPesewas: nhilAmount,
        getfundAmountPesewas: getfundAmount,
        description: `Online order ${order.orderNumber}`,
        referenceType: 'storefront_order',
        referenceId: order.id,
      });

      return row;
    });

    return updated ?? this.getOrderById(orderId);
  }

  async listByCustomer(customerId: string) {
    return this.db
      .select()
      .from(storefrontOrders)
      .where(eq(storefrontOrders.customerId, customerId))
      .orderBy(desc(storefrontOrders.createdAt));
  }

  async getOrderById(id: string) {
    const [order] = await this.db
      .select()
      .from(storefrontOrders)
      .where(eq(storefrontOrders.id, id))
      .limit(1);
    if (!order) throw new NotFoundException('Order not found');

    const items = await this.db
      .select()
      .from(storefrontOrderItems)
      .where(eq(storefrontOrderItems.orderId, id));

    return { ...order, items };
  }

  async getOrderForCustomer(id: string, customerId: string) {
    const order = await this.getOrderById(id);
    if (order.customerId !== customerId) throw new NotFoundException('Order not found');
    return order;
  }

  async trackOrder(orderNumber: string, email: string) {
    const [order] = await this.db
      .select()
      .from(storefrontOrders)
      .where(
        and(
          eq(storefrontOrders.orderNumber, orderNumber),
          eq(storefrontOrders.email, email.toLowerCase()),
        ),
      )
      .limit(1);
    if (!order) throw new NotFoundException('Order not found');

    const items = await this.db
      .select()
      .from(storefrontOrderItems)
      .where(eq(storefrontOrderItems.orderId, order.id));

    return { ...order, items };
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    const [order] = await this.db
      .select()
      .from(storefrontOrders)
      .where(eq(storefrontOrders.id, id))
      .limit(1);
    if (!order) throw new NotFoundException('Order not found');

    if (dto.status === 'cancelled' && order.status === 'delivered') {
      throw new BadRequestException(
        'Delivered orders cannot be cancelled — process a refund instead',
      );
    }

    const timeline = [
      ...(order.timeline ?? []),
      { status: dto.status, note: dto.note ?? '', createdAt: new Date().toISOString() },
    ];

    // Cancelling releases the reserved stock back to the fulfilment store.
    if (dto.status === 'cancelled' && order.status !== 'cancelled' && order.storeId) {
      const storeId = order.storeId;
      const updated = await this.db.transaction(async (tx) => {
        // Claim the transition first — a concurrent cancel sees no row and
        // skips restocking entirely (prevents double stock release).
        const [claimed] = await tx
          .update(storefrontOrders)
          .set({ status: dto.status, timeline, updatedAt: new Date() })
          .where(and(eq(storefrontOrders.id, id), ne(storefrontOrders.status, 'cancelled')))
          .returning();
        if (!claimed) return null;

        const items = await tx
          .select()
          .from(storefrontOrderItems)
          .where(eq(storefrontOrderItems.orderId, id));

        const qtyByProduct = new Map<string, number>();
        for (const item of items) {
          if (!item.productId) continue;
          qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + item.quantity);
        }

        if (qtyByProduct.size > 0) {
          const locked = await tx
            .select()
            .from(stockItems)
            .where(and(inArray(stockItems.productId, [...qtyByProduct.keys()]), eq(stockItems.storeId, storeId)))
            .for('update');
          const stockMap = new Map(locked.map((s) => [s.productId, s]));

          const movementInserts: any[] = [];
          const runningQty = new Map<string, number>();
          for (const item of items) {
            if (!item.productId) continue;
            const qtyBefore = runningQty.get(item.productId) ?? stockMap.get(item.productId)?.quantityOnHand ?? 0;
            const qtyAfter = qtyBefore + item.quantity;
            runningQty.set(item.productId, qtyAfter);
            movementInserts.push({
              productId: item.productId,
              storeId,
              type: 'return_in' as const,
              quantityChange: item.quantity,
              quantityBefore: qtyBefore,
              quantityAfter: qtyAfter,
              referenceType: 'storefront_order_cancel',
              referenceId: id,
            });
          }
          await tx.insert(stockMovements).values(movementInserts);

          for (const [productId, totalQty] of qtyByProduct) {
            const [row] = await tx
              .update(stockItems)
              .set({ quantityOnHand: sql`${stockItems.quantityOnHand} + ${totalQty}`, lastMovementAt: new Date(), updatedAt: new Date() })
              .where(and(eq(stockItems.productId, productId), eq(stockItems.storeId, storeId)))
              .returning({ id: stockItems.id });
            // The stock row should exist (it was decremented at order time),
            // but recreate it defensively if it was deleted since.
            if (!row) {
              await tx.insert(stockItems).values({ productId, storeId, quantityOnHand: totalQty });
            }
          }
        }

        return claimed;
      });
      return updated ?? this.getOrderById(id);
    }

    const [updated] = await this.db
      .update(storefrontOrders)
      .set({ status: dto.status, timeline, updatedAt: new Date() })
      .where(eq(storefrontOrders.id, id))
      .returning();

    return updated;
  }

  async listAll(status?: string) {
    if (status) {
      return this.db
        .select()
        .from(storefrontOrders)
        .where(eq(storefrontOrders.status, status as any))
        .orderBy(desc(storefrontOrders.createdAt));
    }
    return this.db.select().from(storefrontOrders).orderBy(desc(storefrontOrders.createdAt));
  }

  /** Early stock check before checkout — the authoritative check with row
   *  locks happens inside createOrder's transaction; this just gives the
   *  customer a fast, friendly error first. */
  async validateStock(items: CreateOrderDto['items']) {
    const storeId = await this.resolveFulfilmentStoreId();
    const productIds = items.filter((i) => i.productId).map((i) => i.productId!);
    if (productIds.length === 0) return;

    const rows = await this.db
      .select({ id: products.id, name: products.name, status: products.status })
      .from(products)
      .where(inArray(products.id, productIds));
    const productMap = new Map(rows.map((r) => [r.id, r]));

    const qtyByProduct = new Map<string, number>();
    for (const item of items) {
      if (!item.productId) continue;
      qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + item.quantity);
    }
    const stock = await this.db
      .select({ productId: stockItems.productId, quantityOnHand: stockItems.quantityOnHand })
      .from(stockItems)
      .where(and(inArray(stockItems.productId, [...qtyByProduct.keys()]), eq(stockItems.storeId, storeId)));
    const stockMap = new Map(stock.map((s) => [s.productId, s.quantityOnHand]));

    for (const [productId, totalQty] of qtyByProduct) {
      const product = productMap.get(productId);
      if (!product || product.status !== 'active') {
        throw new BadRequestException(`${product?.name ?? 'An item'} is no longer available`);
      }
      const available = stockMap.get(productId) ?? 0;
      if (available < totalQty) {
        throw new ConflictException(
          available <= 0
            ? `${product.name} is out of stock`
            : `Only ${available} left in stock for ${product.name}`,
        );
      }
    }
  }
}
