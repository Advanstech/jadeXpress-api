import pg from 'pg';
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// Find the supplier + its POs
const { rows: pos } = await client.query(`
  SELECT po.id, po.po_number, po.status, po.payment_status, po.store_id, po.created_at,
         i.invoice_number, i.ocr_extracted, i.image_url IS NOT NULL AS has_image
  FROM purchase po
  LEFT JOIN invoice i ON i.purchase_order_id = po.id
  JOIN supplier s ON s.id = po.supplier_id
  WHERE s.name ILIKE '%stebed%' OR s.code ILIKE '%stebed%'
  ORDER BY po.created_at DESC LIMIT 10
`);
console.log('POs:', JSON.stringify(pos, null, 1));

for (const po of pos) {
  const { rows: items } = await client.query(
    `SELECT id, product_id, quantity_ordered, quantity_received FROM purchase_item WHERE purchase_order_id = $1`, [po.id]);
  const { rows: batches } = await client.query(
    `SELECT id, product_id, quantity_received, quantity_remaining FROM stock_batch WHERE purchase_order_id = $1`, [po.id]);
  const { rows: moves } = await client.query(
    `SELECT count(*) FROM stock_movement WHERE reference_id = $1`, [po.id]);
  console.log(`\n=== ${po.po_number} [${po.status}] inv=${po.invoice_number} ===`);
  console.log('items:', items.map(i => `${i.product_id.slice(0,8)} ord=${i.quantity_ordered} rec=${i.quantity_received}`));
  console.log('batches:', batches.length, 'movements:', moves[0].count);
  for (const it of items) {
    const { rows: si } = await client.query(
      `SELECT quantity_on_hand FROM stock_item WHERE product_id=$1 AND store_id=$2`, [it.product_id, po.store_id]);
    console.log(`  stock_item ${it.product_id.slice(0,8)}: ${si[0]?.quantity_on_hand ?? 'NO ROW'}`);
  }
}
await client.end();
