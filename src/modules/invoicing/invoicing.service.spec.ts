import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { InvoicingService } from './invoicing.service';

const ids = {
  store: '11111111-1111-4111-8111-111111111111',
  staff: '22222222-2222-4222-8222-222222222222',
  customer: '33333333-3333-4333-8333-333333333333',
  product: '44444444-4444-4444-8444-444444444444',
};
const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
const input = { storeId: ids.store, createdById: ids.staff, customerId: ids.customer, dueDate: future, items: [{ productId: ids.product, description: 'ignored', quantity: 2, unitPricePesewas: 1250 }] };

function createDb({ customer = { id: ids.customer }, products = [{ id: ids.product, name: 'Vitamin C' }], invoice = { id: 'invoice', storeId: ids.store, status: 'sent', totalPesewas: 10000, amountPaidPesewas: 2000 } as any, missing = false } = {}) {
  const found = missing ? undefined : invoice;
  const inserted: any[] = [];
  const updates: any[] = [];
  const tx = {
    insert: vi.fn(() => ({ values: vi.fn((values) => {
      inserted.push(values);
      return { returning: vi.fn(async () => Array.isArray(values) ? values.map((v, i) => ({ id: `item-${i}`, ...v })) : [{ id: 'invoice', ...values }]) };
    }) })),
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ for: vi.fn(async () => found ? [found] : []) })) })) })),
    update: vi.fn(() => ({ set: vi.fn((values) => { updates.push(values); return { where: vi.fn(() => ({ returning: vi.fn(async () => [{ ...found, ...values }]) })) }; }) })),
  };
  const db: any = {
    query: {
      customers: { findFirst: vi.fn(async () => customer) },
      invoices: { findFirst: vi.fn(async () => ({ id: 'invoice', storeId: ids.store, items: [], customer: {}, createdBy: {} })), findMany: vi.fn(async () => []) },
      auditLogs: { findMany: vi.fn(async () => []) },
    },
    select: vi.fn(() => ({ from: vi.fn(() => ({ innerJoin: vi.fn(() => ({ where: vi.fn(async () => products) })) })) })),
    transaction: vi.fn(async (callback) => callback(tx)),
  };
  return { db, inserted, updates };
}

describe('InvoicingService', () => {
  it('creates invoices with server totals, product snapshots, and creator history', async () => {
    const { db, inserted } = createDb();
    const result = await new InvoicingService(db).createInvoice({ ...input, subtotalPesewas: 1, totalPesewas: 1 });
    expect(result.id).toBe('invoice');
    expect(inserted[0]).toMatchObject({ storeId: ids.store, createdById: ids.staff, subtotalPesewas: 2500, totalPesewas: 2500 });
    expect(inserted[1][0]).toMatchObject({ description: 'Vitamin C', quantity: 2, unitPricePesewas: 1250, lineTotalPesewas: 2500 });
    expect(inserted[2]).toMatchObject({ action: 'INVOICE_CREATED', staffId: ids.staff, entityType: 'customer_invoice' });
  });

  it('rejects inaccessible customers and unavailable products', async () => {
    const service = new InvoicingService(createDb({ customer: null as any }).db);
    await expect(service.createInvoice(input)).rejects.toBeInstanceOf(BadRequestException);
    const unavailable = new InvoicingService(createDb({ products: [] }).db);
    await expect(unavailable.createInvoice(input)).rejects.toThrow('unavailable');
  });

  it('records bounded payments and audit history', async () => {
    const { db, inserted } = createDb();
    const result = await new InvoicingService(db).recordPayment('invoice', 8000, ids.store, ids.staff, 'momo', 'MM-1');
    expect(result).toMatchObject({ amountPaidPesewas: 10000, status: 'paid' });
    expect(inserted[0]).toMatchObject({ action: 'INVOICE_PAYMENT_RECORDED', staffId: ids.staff, newData: { method: 'momo', reference: 'MM-1' } });
    await expect(new InvoicingService(createDb().db).recordPayment('invoice', 8001, ids.store, ids.staff)).rejects.toThrow('exceeds');
  });

  it('keeps invoice reads and status changes inside the branch', async () => {
    await expect(new InvoicingService(createDb({ missing: true }).db).updateInvoiceStatus('invoice', 'sent', ids.store, ids.staff)).rejects.toBeInstanceOf(NotFoundException);
    await expect(new InvoicingService(createDb().db).updateInvoiceStatus('invoice', 'paid', ids.store, ids.staff)).rejects.toBeInstanceOf(BadRequestException);
  });
});
