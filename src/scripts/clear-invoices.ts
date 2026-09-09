import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../database/schema';
import { eq, inArray, and, sql } from 'drizzle-orm';

const INVOICE_NUMBERS = ['MKT0046/Aug26', 'MKT0046/Sep26'];

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl, max: 3 });
  const db = drizzle(pool, { schema }) as any;

  try {
    const invoices = await db
      .select({
        id: schema.supplierInvoices.id,
        purchaseOrderId: schema.supplierInvoices.purchaseOrderId,
        invoiceNumber: schema.supplierInvoices.invoiceNumber,
      })
      .from(schema.supplierInvoices)
      .where(inArray(schema.supplierInvoices.invoiceNumber, INVOICE_NUMBERS));

    console.log(`Found ${invoices.length} invoice(s) to clear.`);
    if (invoices.length === 0) {
      console.log('No matching invoices. Exiting.');
      await pool.end();
      return;
    }

    const invoiceIds = invoices.map((i: any) => i.id);
    const poIds = invoices.map((i: any) => i.purchaseOrderId).filter(Boolean);

    console.log('Invoice IDs:', invoiceIds);
    console.log('Related PO IDs:', poIds);

    if (poIds.length > 0) {
      // Identify affected stock batches before deleting them, so we can reconcile stock.
      const affectedBatches = await db
        .select({
          id: schema.stockBatches.id,
          productId: schema.stockBatches.productId,
          storeId: schema.stockBatches.storeId,
          quantityRemaining: schema.stockBatches.quantityRemaining,
        })
        .from(schema.stockBatches)
        .where(inArray(schema.stockBatches.purchaseOrderId, poIds));

      console.log(`Found ${affectedBatches.length} stock batch(es) to remove.`);

      // Remove stock movements tied to these POs (referenceType = 'purchase')
      const deletedMovements = await db
        .delete(schema.stockMovements)
        .where(
          and(
            eq(schema.stockMovements.referenceType, 'purchase'),
            inArray(schema.stockMovements.referenceId, poIds),
          ),
        )
        .returning({ id: schema.stockMovements.id });
      console.log(`Deleted ${deletedMovements.length} stock movement(s).`);

      // Remove stock batches
      const deletedBatches = await db
        .delete(schema.stockBatches)
        .where(inArray(schema.stockBatches.purchaseOrderId, poIds))
        .returning({ id: schema.stockBatches.id });
      console.log(`Deleted ${deletedBatches.length} stock batch(es).`);

      // Reconcile stock_item.quantityOnHand for affected product/store pairs
      const pairs = affectedBatches.reduce((acc: Map<string, { productId: string; storeId: string }>, batch: any) => {
        const key = `${batch.productId}:${batch.storeId}`;
        if (!acc.has(key)) {
          acc.set(key, { productId: batch.productId, storeId: batch.storeId });
        }
        return acc;
      }, new Map<string, { productId: string; storeId: string }>());

      for (const { productId, storeId } of pairs.values()) {
        const remaining = await db
          .select({ total: sql<number>`COALESCE(SUM(${schema.stockBatches.quantityRemaining}), 0)` })
          .from(schema.stockBatches)
          .where(
            and(
              eq(schema.stockBatches.productId, productId),
              eq(schema.stockBatches.storeId, storeId),
              eq(schema.stockBatches.isActive, true),
            ),
          );

        const newQty = Number(remaining[0]?.total) || 0;
        const updated = await db
          .update(schema.stockItems)
          .set({ quantityOnHand: newQty })
          .where(
            and(
              eq(schema.stockItems.productId, productId),
              eq(schema.stockItems.storeId, storeId),
            ),
          )
          .returning({ id: schema.stockItems.id, quantityOnHand: schema.stockItems.quantityOnHand });
        console.log(`Reconciled stock for product ${productId}, store ${storeId}: quantityOnHand = ${newQty} (updated ${updated.length} row(s)).`);
      }

      // Delete purchase items
      const deletedItems = await db
        .delete(schema.purchaseItems)
        .where(inArray(schema.purchaseItems.purchaseOrderId, poIds))
        .returning({ id: schema.purchaseItems.id });
      console.log(`Deleted ${deletedItems.length} purchase item(s).`);
    }

    // Delete invoices (cascades invoice_payments and removes FK blocking PO deletion)
    const deletedInvoices = await db
      .delete(schema.supplierInvoices)
      .where(inArray(schema.supplierInvoices.id, invoiceIds))
      .returning({ id: schema.supplierInvoices.id, invoiceNumber: schema.supplierInvoices.invoiceNumber });
    console.log(`Deleted ${deletedInvoices.length} invoice(s):`, deletedInvoices.map((i: any) => i.invoiceNumber));

    // Delete purchase orders now that invoices are gone
    if (poIds.length > 0) {
      const deletedPOs = await db
        .delete(schema.purchaseOrders)
        .where(inArray(schema.purchaseOrders.id, poIds))
        .returning({ id: schema.purchaseOrders.id });
      console.log(`Deleted ${deletedPOs.length} purchase order(s).`);
    }

    console.log('Done.');
  } catch (err: any) {
    console.error('Error clearing invoices:', err?.message || err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
