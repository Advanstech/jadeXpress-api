/**
 * Cross-module sync audit: checks supplier invoices / POs / inventory / stock / accounting
 * for data gaps and inconsistencies. Read-only — safe to run anytime.
 *
 * Usage: npx tsx src/scripts/audit-sync.ts
 */
import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../database/schema';
import { sql } from 'drizzle-orm';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) { console.error('DATABASE_URL is not set'); process.exit(1); }

  const pool = new Pool({ connectionString: dbUrl, max: 3 });
  const db = drizzle(pool, { schema }) as any;
  const q = async (label: string, text: string) => {
    const res = await pool.query(text);
    console.log(`\n== ${label} ==`);
    if (res.rows.length === 0) { console.log('  (no rows)'); return res.rows; }
    console.table(res.rows);
    return res.rows;
  };

  // 1. POs by status
  await q('Purchase Orders by status', `
    SELECT status, count(*) AS pos, sum(total_pesewas) AS total_pesewas
    FROM purchase GROUP BY status ORDER BY pos DESC`);

  // 2. Sync gap: approved/invoiced/received POs with NO stock batches (stock never received)
  await q('GAP: POs invoiced/received/paid but missing stock batches', `
    SELECT po.id, po.po_number, po.status, po.total_pesewas
    FROM purchase po
    WHERE po.status IN ('invoiced','received','paid','partial')
      AND NOT EXISTS (SELECT 1 FROM stock_batch sb WHERE sb.purchase_order_id = po.id)
    ORDER BY po.order_date DESC LIMIT 20`);

  // 3. Sync gap: POs with batches but NO stock movements (batch created but movement ledger missing)
  await q('GAP: Batches without stock movements', `
    SELECT count(*) AS orphan_batches
    FROM stock_batch sb
    WHERE NOT EXISTS (SELECT 1 FROM stock_movement sm WHERE sm.batch_id = sb.id)`);

  // 4. Ledger entries by reference type
  await q('Ledger entries by source (accounting feed)', `
    SELECT reference_type, entry_type, category, count(*) AS entries, sum(amount_pesewas) AS total_pesewas
    FROM ledger_entry GROUP BY reference_type, entry_type, category ORDER BY entries DESC`);

  // 5. Sync gap: approved POs (status invoiced) with NO AP ledger entry
  await q('GAP: Invoiced POs without AP (credit) ledger entry', `
    SELECT po.id, po.po_number, po.total_pesewas
    FROM purchase po
    WHERE po.status IN ('invoiced','partial','paid')
      AND NOT EXISTS (
        SELECT 1 FROM ledger_entry le
        WHERE le.reference_type = 'purchase_invoice' AND le.reference_id = po.id
      )
    ORDER BY po.order_date DESC LIMIT 20`);

  // 6. Sync gap: paid POs with NO SUPPLIER_PAYMENT ledger entries
  await q('GAP: Paid/partially-paid POs without payment ledger entries', `
    SELECT po.id, po.po_number, po.payment_status, po.paid_amount_pesewas
    FROM purchase po
    WHERE po.paid_amount_pesewas > 0
      AND NOT EXISTS (
        SELECT 1 FROM ledger_entry le
        WHERE le.reference_type = 'SUPPLIER_PAYMENT'
          AND le.description LIKE '%' || po.po_number || '%'
      )
    ORDER BY po.order_date DESC LIMIT 20`);

  // 7. Stock movement summary
  await q('Stock movements by type', `
    SELECT type, count(*) AS movements, sum(quantity_change) AS net_qty
    FROM stock_movement GROUP BY type ORDER BY movements DESC`);

  // 8. Consistency: stock_item.quantity_on_hand vs ledger of movements
  await q('MISMATCH: stock_items where quantity_on_hand != last movement quantity_after (top 15)', `
    SELECT si.product_id, p.name, si.quantity_on_hand,
      (SELECT sm.quantity_after FROM stock_movement sm
        WHERE sm.product_id = si.product_id AND sm.store_id = si.store_id
        ORDER BY sm.created_at DESC LIMIT 1) AS last_movement_after
    FROM stock_item si
    LEFT JOIN product p ON p.id = si.product_id
    WHERE si.quantity_on_hand IS DISTINCT FROM (
      SELECT sm.quantity_after FROM stock_movement sm
        WHERE sm.product_id = si.product_id AND sm.store_id = si.store_id
        ORDER BY sm.created_at DESC LIMIT 1)
    LIMIT 15`);

  // 9. Supplier invoices vs PO totals
  await q('Supplier invoices total vs linked PO total', `
    SELECT si.invoice_number, si.total_amount_pesewas AS invoice_total,
           po.po_number, po.total_pesewas AS po_total,
           (si.total_amount_pesewas - po.total_pesewas) AS difference
    FROM invoice si
    LEFT JOIN purchase po ON po.id = si.purchase_order_id
    ORDER BY si.created_at DESC LIMIT 10`);

  // 10. Sales vs revenue ledger
  await q('Sales (completed) vs revenue ledger entries', `
    SELECT
      (SELECT count(*) FROM sale WHERE status='completed') AS completed_sales,
      (SELECT count(*) FROM ledger_entry WHERE reference_type='sale') AS revenue_entries,
      (SELECT coalesce(sum(total_pesewas),0) FROM sale WHERE status='completed') AS sales_total,
      (SELECT coalesce(sum(amount_pesewas),0) FROM ledger_entry WHERE reference_type='sale') AS ledger_total`);

  // 11. Negative stock (should be none)
  await q('Negative stock items (should be empty)', `
    SELECT si.product_id, p.name, si.quantity_on_hand
    FROM stock_item si JOIN product p ON p.id = si.product_id
    WHERE si.quantity_on_hand < 0 LIMIT 10`);

  console.log('\n[AUDIT] Done.');
  await pool.end();
  process.exit(0);
}

main().catch((err) => { console.error('[AUDIT] Fatal:', err); process.exit(1); });
