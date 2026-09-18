import { Pool } from '@neondatabase/serverless';

async function main() {
  const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_KnSeukC09rLO@ep-wispy-sunset-avsjdgd4-pooler.c-11.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' });
  const client = await pool.connect();
  
  try {
    console.log("Starting truncation without a single giant transaction...");

    const tablesToTruncate = [
      'sale', 'sale_item', 'payment', 
      'refund_request', 'refund_item', 
      'expense', 
      'eod_record', 
      'ledger_entry', 'pl_snapshot', 
      'stock_movement', 'stock_transfer', 'stock_transfer_item',
      'invoice', 'customer_invoice_item', 'invoice_payment',
      'purchase', 'purchase_item',
      'budget', 'budget_actual',
      'audit_logs', 'notification_log', 'shift_reconciliation'
    ];
    
    for (const table of tablesToTruncate) {
        console.log(`Truncating ${table}...`);
        try {
            await client.query(`TRUNCATE TABLE ${table} CASCADE;`);
        } catch (e) {
            console.log(`Skipped truncating ${table}: ${e.message}`);
        }
    }

    // Get Jadexpress Dzorwulu ID
    const jdzRes = await client.query(`SELECT id FROM supplier WHERE name = 'Jadexpress Dzorwulu' LIMIT 1;`);
    const jdzId = jdzRes.rows[0]?.id;
    if (!jdzId) {
        throw new Error("Jadexpress Dzorwulu supplier not found");
    }
    console.log(`Jadexpress Dzorwulu ID: ${jdzId}`);

    console.log("Resetting stock and prices for non-Jadexpress products...");
    
    // Update product prices
    const productUpdate = await client.query(`
        UPDATE product 
        SET selling_price_pesewas = 0, cost_price_pesewas = 0 
        WHERE primary_supplier_id != $1 OR primary_supplier_id IS NULL;
    `, [jdzId]);
    console.log(`Updated ${productUpdate.rowCount} products to price 0`);

    // Update stock_items quantity
    const stockItemUpdate = await client.query(`
        UPDATE stock_item 
        SET quantity_on_hand = 0, quantity_reserved = 0, quantity_on_order = 0
        WHERE product_id IN (
            SELECT id FROM product WHERE primary_supplier_id != $1 OR primary_supplier_id IS NULL
        );
    `, [jdzId]);
    console.log(`Updated ${stockItemUpdate.rowCount} stock items to quantity 0`);

    // Update stock_batches
    const stockBatchUpdate = await client.query(`
        UPDATE stock_batch 
        SET quantity_remaining = 0 
        WHERE product_id IN (
            SELECT id FROM product WHERE primary_supplier_id != $1 OR primary_supplier_id IS NULL
        );
    `, [jdzId]);
    console.log(`Updated ${stockBatchUpdate.rowCount} stock batches to quantity 0`);

    // Remove all suppliers except Jadexpress Dzorwulu
    console.log("Nullifying supplier references...");
    await client.query(`UPDATE product SET primary_supplier_id = NULL WHERE primary_supplier_id != $1;`, [jdzId]);
    await client.query(`UPDATE stock_batch SET supplier_id = NULL WHERE supplier_id != $1 AND supplier_id IS NOT NULL;`, [jdzId]);
    
    console.log("Deleting other store-supplier links...");
    await client.query(`DELETE FROM _store_suppliers WHERE supplier_id != $1;`, [jdzId]);
    
    console.log("Deleting other suppliers...");
    const delSuppliers = await client.query(`DELETE FROM supplier WHERE id != $1;`, [jdzId]);
    console.log(`Deleted ${delSuppliers.rowCount} suppliers.`);

    console.log("All reset operations completed successfully!");

  } catch(e) {
    console.error("Execution failed:", e);
  } finally {
    client.release();
    pool.end();
  }
}

main();
