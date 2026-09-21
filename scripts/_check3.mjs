import pg from 'pg';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// audit/activity around 15:40-16:00 for deletes/adjustments
const { rows: audit } = await client.query(`
  SELECT action, entity_type, entity_id, details, created_at
  FROM audit_log
  WHERE created_at BETWEEN '2026-09-21T15:30:00Z' AND '2026-09-21T16:30:00Z'
  ORDER BY created_at LIMIT 50`).catch(e => ({ rows: [], err: e.message }));
console.log('audit rows:', audit.length ? audit : 'none/error');

// do these products appear on other POs?
const poId = '41ba53d1-7575-498a-902f-34805c1e9add';
const { rows: shared } = await client.query(`
  SELECT pi.product_id, pi.purchase_order_id, po.po_number, po.status, po.created_at
  FROM purchase_item pi
  JOIN purchase po ON po.id = pi.purchase_order_id
  WHERE pi.product_id IN (SELECT product_id FROM purchase_item WHERE purchase_order_id=$1)
    AND pi.purchase_order_id <> $1
  ORDER BY po.created_at`, [poId]);
console.log('other POs sharing these products:', shared.length);
console.log(shared.slice(0, 20));

// stock_item rows updated in that window across the store — how many?
const { rows: z } = await client.query(`
  SELECT count(*), min(updated_at), max(updated_at) FROM stock_item
  WHERE updated_at BETWEEN '2026-09-21T15:40:00Z' AND '2026-09-21T16:00:00Z'`);
console.log('stock_item updates 15:40-16:00:', z);
await client.end();
