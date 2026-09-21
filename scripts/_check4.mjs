import pg from 'pg';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const poId = '41ba53d1-7575-498a-902f-34805c1e9add';

// every movement type for one affected product
const { rows: items } = await client.query(
  `SELECT product_id FROM purchase_item WHERE purchase_order_id=$1 LIMIT 3`, [poId]);
for (const it of items) {
  const { rows: mv } = await client.query(
    `SELECT type, reference_type, reference_id, quantity_change, quantity_before, quantity_after, performed_by_id, notes, created_at
     FROM stock_movement WHERE product_id=$1 ORDER BY created_at`, [it.product_id]);
  console.log(`\nproduct ${it.product_id.slice(0,8)}:`);
  mv.forEach(m => console.log(' ', m.created_at.toISOString(), m.type, `chg=${m.quantity_change}`, `after=${m.quantity_after}`, `ref=${m.reference_type}`, `notes=${m.notes ?? ''}`));
}

// What audit table is called?
const { rows: tbls } = await client.query(
  `SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%audit%' OR table_name ILIKE '%activ%' OR table_name ILIKE '%log%'`);
console.log('\nlog tables:', tbls.map(t => t.table_name));
await client.end();
