import pg from 'pg';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const poId = '41ba53d1-7575-498a-902f-34805c1e9add'; // MUBAUNDI / MKT0006

const { rows: mv } = await client.query(
  `SELECT store_id, type, quantity_change, quantity_before, quantity_after, reference_type
   FROM stock_movement WHERE reference_id = $1 LIMIT 5`, [poId]);
console.log('movements:', mv);

// all stock_item rows for a few of its products, any store
const { rows: items } = await client.query(
  `SELECT product_id FROM purchase_item WHERE purchase_order_id=$1 LIMIT 5`, [poId]);
for (const it of items) {
  const { rows: si } = await client.query(
    `SELECT store_id, quantity_on_hand, updated_at FROM stock_item WHERE product_id=$1`, [it.product_id]);
  console.log(`product ${it.product_id.slice(0,8)}:`, si);
}

// how many stores exist?
const { rows: stores } = await client.query(`SELECT id, name FROM store`);
console.log('stores:', stores);

// Do movements for these products after the PO show adjustments?
const { rows: later } = await client.query(
  `SELECT type, reference_type, quantity_change, quantity_after, created_at FROM stock_movement
   WHERE product_id = $1 AND created_at > '2026-09-21T13:47:00Z' ORDER BY created_at`, [items[0].product_id]);
console.log('later movements for first product:', later);
await client.end();
