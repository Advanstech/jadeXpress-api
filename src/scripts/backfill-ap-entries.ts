/**
 * One-time backfill: creates Accounts Payable ledger entries for purchase
 * orders that received goods (or were invoiced) before the accounting sync
 * fix, so the ledger fully reflects inventory liabilities.
 *
 * Idempotent — skips POs that already have an AP entry.
 *
 * Usage: npx tsx src/scripts/backfill-ap-entries.ts
 */
import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) { console.error('DATABASE_URL is not set'); process.exit(1); }

  const pool = new Pool({ connectionString: dbUrl, max: 3 });

  // Find received/invoiced/paid POs without an AP ledger entry
  const { rows: pos } = await pool.query(`
    SELECT po.id, po.po_number, po.store_id, po.total_pesewas, po.status,
           po.approved_by_id, po.raised_by_id, po.order_date
    FROM purchase po
    WHERE po.status IN ('received', 'partial', 'invoiced', 'paid')
      AND NOT EXISTS (
        SELECT 1 FROM ledger_entry le
        WHERE le.reference_type = 'purchase_invoice' AND le.reference_id = po.id
      )
    ORDER BY po.order_date ASC`);

  console.log(`[BACKFILL] Found ${pos.length} POs needing AP ledger entries`);

  let created = 0;
  for (const po of pos) {
    await pool.query(
      `INSERT INTO ledger_entry
        (store_id, entry_type, category, amount_pesewas, description, reference_type, reference_id, performed_by_id, entry_date)
       VALUES ($1, 'credit', 'cost_of_goods', $2, $3, 'purchase_invoice', $4, $5, $6)`,
      [
        po.store_id,
        po.total_pesewas,
        `Goods Received (AP backfill) - PO #${po.po_number}`,
        po.id,
        po.approved_by_id ?? po.raised_by_id ?? null,
        po.order_date,
      ],
    );
    created++;
    console.log(`[BACKFILL] ${created}/${pos.length} PO #${po.po_number} — AP entry GHS ${(po.total_pesewas / 100).toFixed(2)}`);
  }

  console.log(`\n[BACKFILL] Done. Created ${created} AP entries.`);
  await pool.end();
  process.exit(0);
}

main().catch((err) => { console.error('[BACKFILL] Fatal:', err); process.exit(1); });
