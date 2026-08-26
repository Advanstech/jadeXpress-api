import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import {
  storefrontOrders,
  storefrontOrderItems,
  products,
} from '../../database/schema';
import type { CreateOrderDto, UpdateOrderStatusDto } from './dto/order.dto';

@Injectable()
export class OrdersService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private generateOrderNumber() {
    const now = new Date();
    const stamp = now.toISOString().slice(2, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `JX-${stamp}-${rand}`;
  }

  async createOrder(customerId: string | null, dto: CreateOrderDto) {
    const subtotalPesewas = dto.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const totalPesewas = subtotalPesewas + dto.shippingFeePesewas;

    const orderNumber = this.generateOrderNumber();
    const now = new Date().toISOString();

    const [order] = await this.db
      .insert(storefrontOrders)
      .values({
        orderNumber,
        customerId: customerId ?? undefined,
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

    await this.db.insert(storefrontOrderItems).values(
      dto.items.map((item) => ({
        orderId: order.id,
        productId: item.productId,
        name: item.name,
        pricePesewas: item.price,
        quantity: item.quantity,
        image: item.image,
      })),
    );

    return this.getOrderById(order.id);
  }

  async markPaid(orderId: string, reference: string, gateway: string, method?: string) {
    const now = new Date().toISOString();
    const [order] = await this.db
      .select()
      .from(storefrontOrders)
      .where(eq(storefrontOrders.id, orderId))
      .limit(1);
    if (!order) throw new NotFoundException('Order not found');

    const timeline = [
      ...(order.timeline ?? []),
      { status: 'processing', note: 'Payment confirmed', createdAt: now },
    ];

    const [updated] = await this.db
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
      .where(eq(storefrontOrders.id, orderId))
      .returning();

    return updated;
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

    const timeline = [
      ...(order.timeline ?? []),
      { status: dto.status, note: dto.note ?? '', createdAt: new Date().toISOString() },
    ];

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

  /** Validates stock availability for cart items before checkout. */
  async validateStock(items: CreateOrderDto['items']) {
    for (const item of items) {
      if (!item.productId) continue;
      const [product] = await this.db
        .select({ id: products.id, name: products.name, status: products.status })
        .from(products)
        .where(eq(products.id, item.productId))
        .limit(1);
      if (!product || product.status !== 'active') {
        throw new BadRequestException(`${item.name} is no longer available`);
      }
    }
  }
}
