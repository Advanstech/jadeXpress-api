import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { invoices, invoiceItems, auditLogs, customers, products, stockItems } from '../../database/schema';
import { eq, desc, and, or, isNull, inArray } from 'drizzle-orm';
import { z } from 'zod';

const money = z.number().int().min(0).max(2_000_000_000);
const invoiceInput = z.object({
  storeId: z.string().uuid(),
  createdById: z.string().uuid(),
  customerId: z.string().uuid(),
  dueDate: z.string().date(),
  notes: z.string().trim().max(4000).optional(),
  terms: z.string().trim().max(4000).optional(),
  items: z.array(z.object({
    productId: z.string().uuid().optional(),
    description: z.string().trim().min(1).max(255),
    quantity: z.number().int().min(1).max(100000),
    unitPricePesewas: money,
  })).min(1).max(200),
});
const staffColumns = { id: true, firstName: true, lastName: true } as const;

@Injectable()
export class InvoicingService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getInvoices(storeId: string) {
    return this.db.query.invoices.findMany({
      where: eq(invoices.storeId, storeId),
      orderBy: [desc(invoices.createdAt)],
      limit: 500,
      with: { customer: true, createdBy: { columns: staffColumns } },
    });
  }

  async getInvoiceById(id: string, storeId?: string) {
    const invoice = await this.db.query.invoices.findFirst({
      where: storeId ? and(eq(invoices.id, id), eq(invoices.storeId, storeId)) : eq(invoices.id, id),
      with: { customer: true, createdBy: { columns: staffColumns }, items: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const history = await this.db.query.auditLogs.findMany({
      where: and(eq(auditLogs.entityType, 'customer_invoice'), eq(auditLogs.entityId, id), eq(auditLogs.storeId, invoice.storeId)),
      orderBy: [desc(auditLogs.createdAt)],
      with: { staff: { columns: staffColumns } },
    });
    return { ...invoice, history };
  }

  async createInvoice(input: unknown) {
    const parsed = invoiceInput.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues.map(i => i.message).join(', '));
    const data = parsed.data;
    const today = new Date().toISOString().slice(0, 10);
    if (data.dueDate < today) throw new BadRequestException('Due date cannot precede the issue date');
    const customer = await this.db.query.customers.findFirst({
      where: and(eq(customers.id, data.customerId), eq(customers.isActive, true), or(eq(customers.storeId, data.storeId), isNull(customers.storeId))),
    });
    if (!customer) throw new BadRequestException('Select an active customer in this branch');
    const productIds = [...new Set(data.items.flatMap(i => i.productId ? [i.productId] : []))];
    const available = productIds.length ? await this.db.select({ id: products.id, name: products.name })
      .from(products).innerJoin(stockItems, eq(stockItems.productId, products.id))
      .where(and(inArray(products.id, productIds), eq(products.status, 'active'), eq(stockItems.storeId, data.storeId))) : [];
    if (available.length !== productIds.length) throw new BadRequestException('One or more products are unavailable in this branch');
    const items = data.items.map(item => ({
      ...item,
      description: item.productId ? available.find(p => p.id === item.productId)!.name : item.description,
      lineTotalPesewas: item.quantity * item.unitPricePesewas,
    }));
    const subtotal = items.reduce((sum, item) => sum + item.lineTotalPesewas, 0);
    if (!Number.isSafeInteger(subtotal) || subtotal > 2_000_000_000 || subtotal <= 0) throw new BadRequestException('Invalid invoice total');
    // Generate invoice number e.g. INV-YYYYMMDD-XXXX
    const invoice = await this.db.transaction(async tx => {
      const [created] = await tx.insert(invoices).values({
        storeId: data.storeId, customerId: data.customerId, createdById: data.createdById,
        invoiceNumber: `INV-${today.replace(/-/g, '')}-${randomUUID().slice(0, 8).toUpperCase()}`,
        status: 'draft', issueDate: today, dueDate: data.dueDate,
        subtotalPesewas: subtotal, totalPesewas: subtotal, notes: data.notes, terms: data.terms,
      }).returning();
      const savedItems = await tx.insert(invoiceItems).values(items.map(({ productId, ...item }) => ({ ...item, invoiceId: created.id }))).returning();
      await tx.insert(auditLogs).values({
        staffId: data.createdById, storeId: data.storeId, action: 'INVOICE_CREATED',
        entityType: 'customer_invoice', entityId: created.id,
        newData: { totalPesewas: subtotal, items: savedItems.map((item, index) => ({ ...item, productId: items[index].productId ?? null })) },
      });
      return created;
    });
    return this.getInvoiceById(invoice.id, data.storeId);
  }

  async updateInvoiceStatus(id: string, status: string, storeId: string, staffId: string) {
    if (!['sent', 'cancelled'].includes(status)) throw new BadRequestException('Status must be sent or cancelled; paid status is set by payments');
    return this.db.transaction(async tx => {
      const [invoice] = await tx.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.storeId, storeId))).for('update');
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.status === status) return invoice;
      if (invoice.status === 'paid' || invoice.status === 'cancelled' || (status === 'cancelled' && invoice.amountPaidPesewas > 0)) throw new BadRequestException('This invoice cannot change to that status');
      const [updated] = await tx.update(invoices).set({ status, updatedAt: new Date() }).where(eq(invoices.id, id)).returning();
      await tx.insert(auditLogs).values({ staffId, storeId, action: 'INVOICE_STATUS_CHANGED', entityType: 'customer_invoice', entityId: id, oldData: { status: invoice.status }, newData: { status } });
      return updated;
    });
  }

  async recordPayment(id: string, amountPesewas: number, storeId: string, staffId: string, method = 'cash', reference = '') {
    if (!Number.isSafeInteger(amountPesewas) || amountPesewas <= 0) throw new BadRequestException('Payment must be a positive integer in pesewas');
    if (!['cash', 'momo', 'card', 'bank_transfer'].includes(method) || typeof reference !== 'string' || reference.length > 255) throw new BadRequestException('Invalid payment details');
    return this.db.transaction(async tx => {
      const [invoice] = await tx.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.storeId, storeId))).for('update');
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.status === 'cancelled' || invoice.status === 'paid') throw new BadRequestException('This invoice cannot receive payments');
      const newPaid = invoice.amountPaidPesewas + amountPesewas;
      if (newPaid > invoice.totalPesewas) throw new BadRequestException('Payment exceeds the balance due');
      const [updated] = await tx.update(invoices).set({ amountPaidPesewas: newPaid, status: newPaid === invoice.totalPesewas ? 'paid' : 'sent', updatedAt: new Date() }).where(eq(invoices.id, id)).returning();
      await tx.insert(auditLogs).values({ staffId, storeId, action: 'INVOICE_PAYMENT_RECORDED', entityType: 'customer_invoice', entityId: id, oldData: { amountPaidPesewas: invoice.amountPaidPesewas }, newData: { amountPesewas, amountPaidPesewas: newPaid, method, reference: reference.trim() } });
      return updated;
    });
  }
}
