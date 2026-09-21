import pg from 'pg';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const poId = '41ba53d1-7575-498a-902f-34805c1e9add';

const { rows: prodIds } = await client.query(
  `SELECT product_id FROM purchase_item WHERE purchase_order_id = $1`, [poId]);
const ids = prodIds.map(r => r.product_id);

const { rows: overlap } = await client.query(`
  SELECT b.purchase_order_id AS orphan_po, count(*) AS shared_products, sum(b.quantity_received) AS units
  FROM stock_batch b
  LEFT JOIN purchase po ON po.id = b.purchase_order_id
  WHERE po.id IS NULL AND b.product_id = ANY($1::uuid[])
  GROUP BY b.purchase_order_id`, [ids]);
console.log('orphan batches on MUBAUNDI products:', overlap);

const { rows: mb } = await client.query(
  `SELECT count(*) c, sum(quantity_received) recv, sum(quantity_remaining) rem,
          count(*) FILTER (WHERE is_active) active, count(*) FILTER (WHERE NOT is_active) inactive
   FROM stock_batch WHERE purchase_order_id = $1`, [poId]);
console.log('MUBAUNDI batches:', mb);
await client.end();
