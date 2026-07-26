import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { invoices, invoiceItems } from '../../database/schema';
import { eq, desc } from 'drizzle-orm';

@Injectable()
export class InvoicingService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getInvoices(storeId: string) {
    return await this.db.query.invoices.findMany({
      where: eq(invoices.storeId, storeId),
      orderBy: [desc(invoices.createdAt)],
      with: {
        customer: true,
      },
    });
  }

  async getInvoiceById(id: string) {
    const invoice = await this.db.query.invoices.findFirst({
      where: eq(invoices.id, id),
      with: {
        customer: true,
        createdBy: true,
        items: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async createInvoice(data: any) {
    // Generate invoice number e.g. INV-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, '');
    const randomHex = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0').toUpperCase();
    const invoiceNumber = `INV-${dateStr}-${randomHex}`;

    const [invoice] = await this.db.insert(invoices).values({
      storeId: data.storeId,
      customerId: data.customerId,
      createdById: data.createdById,
      invoiceNumber,
      status: 'draft',
      issueDate: data.issueDate || new Date().toISOString().slice(0, 10),
      dueDate: data.dueDate,
      subtotalPesewas: data.subtotalPesewas,
      vatAmountPesewas: data.vatAmountPesewas || 0,
      nhilAmountPesewas: data.nhilAmountPesewas || 0,
      getfundAmountPesewas: data.getfundAmountPesewas || 0,
      discountAmountPesewas: data.discountAmountPesewas || 0,
      totalPesewas: data.totalPesewas,
      notes: data.notes,
      terms: data.terms,
    }).returning();

    if (data.items && data.items.length > 0) {
      const itemsToInsert = data.items.map((item: any) => ({
        invoiceId: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unitPricePesewas: item.unitPricePesewas,
        discountAmountPesewas: item.discountAmountPesewas || 0,
        lineTotalPesewas: item.lineTotalPesewas,
      }));
      await this.db.insert(invoiceItems).values(itemsToInsert);
    }

    return await this.getInvoiceById(invoice.id);
  }

  async updateInvoiceStatus(id: string, status: string) {
    const [updated] = await this.db.update(invoices).set({ status }).where(eq(invoices.id, id)).returning();
    return updated;
  }

  async recordPayment(id: string, amountPesewas: number) {
    const invoice = await this.getInvoiceById(id);
    const newPaid = invoice.amountPaidPesewas + amountPesewas;
    const newStatus = newPaid >= invoice.totalPesewas ? 'paid' : 'sent';
    
    const [updated] = await this.db.update(invoices).set({ 
      amountPaidPesewas: newPaid,
      status: newStatus 
    }).where(eq(invoices.id, id)).returning();
    
    return updated;
  }
}
