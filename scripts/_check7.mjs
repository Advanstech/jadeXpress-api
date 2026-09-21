import pg from 'pg';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows: orphans } = await client.query(`
  SELECT b.purchase_order_id, count(*) AS batches, sum(b.quantity_received) AS units
  FROM stock_batch b
  LEFT JOIN purchase po ON po.id = b.purchase_order_id
  WHERE po.id IS NULL AND b.purchase_order_id IS NOT NULL
  GROUP BY b.purchase_order_id LIMIT 10`);
console.log('orphan batch groups (deleted POs):', orphans);

const { rows: omv } = await client.query(`
  SELECT m.reference_id, count(*) AS movements, max(m.created_at) AS latest
  FROM stock_movement m
  LEFT JOIN purchase po ON po.id = m.reference_id
  WHERE m.reference_type = 'purchase' AND po.id IS NULL
  GROUP BY m.reference_id ORDER BY latest DESC LIMIT 10`);
console.log('orphan purchase movements:', omv);

const { rows: sup } = await client.query(
  `SELECT id, name FROM supplier WHERE name ILIKE '%stebed%' OR code = 'SUP-4201'`);
console.log('supplier:', sup);
if (sup[0]) {
  const { rows: allPos } = await client.query(
    `SELECT id, po_number, status, created_at FROM purchase WHERE supplier_id = $1 ORDER BY created_at`, [sup[0].id]);
  console.log('all POs for supplier:', allPos);
}
await client.end();
