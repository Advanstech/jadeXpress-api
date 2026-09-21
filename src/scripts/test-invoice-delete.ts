// Functional test for supplier-invoice delete semantics.
//
//   pnpm build && node dist/scripts/test-invoice-delete.js
//
// Must run from compiled dist/ output — tsx/esbuild drops decorator
// metadata, which breaks Nest DI (ConfigService arrives undefined).
//
// Verifies the two business rules:
//   1. Deleting an invoice DECREASES stock for products that existed before it.
//   2. Products whose entire existence is the invoice are DELETED with it.
//
// Boots the real AppModule (no HTTP listener) against the configured DB,
// exercises the real services, and cleans up after itself.

import { NestFactory } from '@nestjs/core';
import { eq, sql } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { SuppliersService } from '../modules/suppliers/suppliers.service';
import { InventoryService } from '../modules/inventory/inventory.service';
import { DRIZZLE } from '../database/database.module';
import {
  products, stockItems, stockAlerts, suppliers, supplierInvoices,
  purchaseOrders, stores, staffProfile,
} from '../database/schema';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
    abortOnError: false,
  });
  const suppliersService = app.get(SuppliersService);
  const inventory = app.get(InventoryService);
  const db = app.get(DRIZZLE);

  const [store] = await db.select().from(stores).limit(1);
  const [staff] = await db.select().from(staffProfile).limit(1);
  if (!store || !staff) throw new Error('Need at least one store and one staff row');
  const storeId = store.id;
  const staffId = staff.id;
  const stamp = Date.now().toString(36);

  let supplierId: string | undefined;
  let existingProductId: string | undefined;

  try {
    // ── Setup: supplier + one pre-existing product + one "wizard-new" product ──
    const supplier = await suppliersService.create({
      name: `TEST DELETE FLOW ${stamp}`, code: `TSTDEL-${stamp}`,
    } as any);
    supplierId = (supplier as any).id;
    console.log(`✓ supplier created (${supplierId})`);

    const existing = await inventory.createProduct({
      sku: `TSTDEL-EXIST-${stamp}`, name: `Test Existing Product ${stamp}`,
      costPricePesewas: 100, sellingPricePesewas: 200,
    } as any, storeId);
    existingProductId = (existing as any).id;
    const existingPid = existingProductId as string;
    const newProduct = await inventory.createProduct({
      sku: `TSTDEL-NEW-${stamp}`, name: `Test Wizard-New Product ${stamp}`,
      costPricePesewas: 100, sellingPricePesewas: 250,
    } as any, storeId);
    const newProductId = (newProduct as any).id as string;
    console.log(`✓ products created: existing=${existingProductId} new=${newProductId}`);

    // ── Create invoice (PO) with both products, then auto-receive like the wizard ──
    const po = await suppliersService.createPurchaseOrder({
      supplierId, storeId,
      invoiceNumber: `TEST-DEL-${stamp}`,
      items: [
        { productId: existingPid, quantityOrdered: 5, unitCostPesewas: 100 },
        { productId: newProductId, quantityOrdered: 3, unitCostPesewas: 100, isNew: true },
      ],
    } as any, staffId);
    const poId = (po as any).id;
    console.log(`✓ PO created (${poId})`);

    await suppliersService.receiveGoods({
      purchaseOrderId: poId, storeId,
      items: (po as any).items.map((i: any) => ({
        purchaseItemId: i.id, quantityReceived: i.quantityOrdered,
      })),
    } as any, staffId, storeId);
    console.log('✓ goods received (wizard auto-receive simulation)');

    const stockAfterReceive = await db.select().from(stockItems)
      .where(eq(stockItems.storeId, storeId));
    const existingQty = stockAfterReceive.find((s: any) => s.productId === existingPid)?.quantityOnHand;
    const newQty = stockAfterReceive.find((s: any) => s.productId === newProductId)?.quantityOnHand;
    if (existingQty !== 5) throw new Error(`existing product stock should be 5, got ${existingQty}`);
    if (newQty !== 3) throw new Error(`new product stock should be 3, got ${newQty}`);
    console.log(`✓ stock landed: existing=${existingQty}, new=${newQty}`);

    // ── Delete the invoice ──
    const [invoice] = await db.select().from(supplierInvoices)
      .where(eq(supplierInvoices.purchaseOrderId, poId)).limit(1);
    if (!invoice) throw new Error('supplier invoice row not found for PO');

    const result: any = await suppliersService.deleteInvoice(invoice.id, storeId);
    console.log(`✓ deleteInvoice: ${result.message}`);

    // ── Assert rule 1: existing product kept, stock reversed to baseline ──
    const [existingAfter] = await db.select().from(products).where(eq(products.id, existingPid));
    if (!existingAfter) throw new Error('EXISTING product was deleted — should have been kept');
    const [existingStockAfter] = await db.select().from(stockItems)
      .where(eq(stockItems.productId, existingPid));
    if ((existingStockAfter?.quantityOnHand ?? 0) !== 0) {
      throw new Error(`existing product stock should be back to 0, got ${existingStockAfter?.quantityOnHand}`);
    }
    console.log('✓ rule 1: existing product kept, stock decreased back to baseline');

    // ── Assert rule 2: wizard-new product deleted entirely ──
    const [newAfter] = await db.select().from(products).where(eq(products.id, newProductId));
    if (newAfter) throw new Error('NEW product still exists — should have been deleted with the invoice');
    const [newStockAfter] = await db.select().from(stockItems)
      .where(eq(stockItems.productId, newProductId));
    if (newStockAfter) throw new Error('new product stock row still exists');
    console.log('✓ rule 2: product created by the invoice was removed');

    // ── Assert PO + invoice gone ──
    const [poAfter] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
    if (poAfter) throw new Error('PO still exists after delete');
    console.log('✓ PO and invoice removed');

    // ── Scenario B: deletion BLOCKED when received stock was consumed ──
    // Simulates a sale: decrement quantityRemaining on the batch. The delete
    // must throw AND roll back — invoice, PO, product, and stock all intact.
    const consumedProduct = await inventory.createProduct({
      sku: `TSTDEL-SOLD-${stamp}`, name: `Test Sold Product ${stamp}`,
      costPricePesewas: 100, sellingPricePesewas: 300,
    } as any, storeId);
    const consumedProductId = (consumedProduct as any).id as string;

    const po2 = await suppliersService.createPurchaseOrder({
      supplierId, storeId,
      invoiceNumber: `TEST-DEL2-${stamp}`,
      items: [
        { productId: consumedProductId, quantityOrdered: 4, unitCostPesewas: 100, isNew: true },
      ],
    } as any, staffId);
    const po2Id = (po2 as any).id as string;
    await suppliersService.receiveGoods({
      purchaseOrderId: po2Id, storeId,
      items: (po2 as any).items.map((i: any) => ({
        purchaseItemId: i.id, quantityReceived: i.quantityOrdered,
      })),
    } as any, staffId, storeId);

    // Consume 1 unit from the batch (as a sale would)
    await db.execute(sql`
      UPDATE stock_batch SET quantity_remaining = quantity_remaining - 1
      WHERE purchase_order_id = ${po2Id}
    `);
    // Stock on hand still shows 4 — the batch check is what must catch this
    await db.execute(sql`
      UPDATE stock_item SET quantity_on_hand = quantity_on_hand - 1
      WHERE product_id = ${consumedProductId} AND store_id = ${storeId}
    `);

    const [invoice2] = await db.select().from(supplierInvoices)
      .where(eq(supplierInvoices.purchaseOrderId, po2Id)).limit(1);

    let blocked = false;
    try {
      await suppliersService.deleteInvoice(invoice2.id, storeId);
    } catch (err: any) {
      blocked = true;
      console.log(`✓ consumed-stock delete blocked: ${err.message}`);
    }
    if (!blocked) throw new Error('deleteInvoice succeeded on consumed stock — should have thrown');

    // Rollback check: invoice, PO, product, and stock must all still exist
    const [inv2After] = await db.select().from(supplierInvoices).where(eq(supplierInvoices.id, invoice2.id));
    const [po2After] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, po2Id));
    const [prod2After] = await db.select().from(products).where(eq(products.id, consumedProductId));
    if (!inv2After || !po2After || !prod2After) {
      throw new Error('blocked delete was not atomic — rows are missing after rollback');
    }
    console.log('✓ rollback intact: invoice, PO, product survived the blocked delete');

    // Manual cleanup of scenario B
    await db.execute(sql`DELETE FROM stock_movement WHERE product_id = ${consumedProductId}`);
    await db.execute(sql`DELETE FROM stock_batch WHERE product_id = ${consumedProductId}`);
    await db.execute(sql`DELETE FROM invoice WHERE id = ${invoice2.id}`);
    await db.delete(stockItems).where(eq(stockItems.productId, consumedProductId));
    await db.delete(stockAlerts).where(eq(stockAlerts.productId, consumedProductId));
    await db.delete(products).where(eq(products.id, consumedProductId));
    await db.delete(purchaseOrders).where(eq(purchaseOrders.id, po2Id));

    console.log('\nALL ASSERTIONS PASSED');
  } finally {
    // ── Cleanup (best-effort) ──
    if (existingProductId) {
      await db.delete(stockAlerts).where(eq(stockAlerts.productId, existingProductId));
      await db.delete(stockItems).where(eq(stockItems.productId, existingProductId));
      await db.delete(products).where(eq(products.id, existingProductId));
    }
    if (supplierId) await db.delete(suppliers).where(eq(suppliers.id, supplierId));
    await app.close();
  }
}

main().then(
  () => { process.exitCode = 0; },
  (err) => { console.error('FAILED:', err?.message ?? err); process.exitCode = 1; },
);
