import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

neonConfig.webSocketConstructor = ws;
const dirname = path.dirname(fileURLToPath(import.meta.url));
for (const line of fs.readFileSync(path.resolve(dirname, '../.env'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.trim().startsWith('#') && !process.env[line.slice(0, i).trim()]) process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

const DUPLICATE_NAME = 'Crest Pro Health'; // auto-created duplicate (exact name match)
const KEEP_NAME_LIKE = 'Crest Pro-Health Advanced Toothpaste (Single Tube%';

const referenceColumns = [
  ['purchase_item', 'product_id'], ['co_purchase_pattern', 'product_a_id'], ['co_purchase_pattern', 'product_b_id'],
  ['demand_forecast', 'product_id'], ['refund_item', 'product_id'], ['rx_item', 'product_id'], ['sale_item', 'product_id'],
  ['stock_alert', 'product_id'], ['stock_batch', 'product_id'], ['stock_movement', 'product_id'],
  ['stock_transfer_item', 'product_id'], ['storefront_order_item', 'product_id'],
];
const quote = (v) => `"${v.replace(/"/g, '""')}"`;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query('BEGIN');

  const { rows: dup } = await client.query(
    `SELECT * FROM product WHERE name ILIKE $1 AND name NOT ILIKE $2 ORDER BY created_at DESC FOR UPDATE`,
    [`%${DUPLICATE_NAME}%`, 'Crest Pro-Health%'],
  );
  const { rows: keep } = await client.query('SELECT * FROM product WHERE name ILIKE $1 ORDER BY name FOR UPDATE', [KEEP_NAME_LIKE]);

  if (dup.length === 0) { console.log(`No product matching "${DUPLICATE_NAME}" — nothing to merge.`); await client.query('ROLLBACK'); process.exit(0); }
  if (keep.length === 0) { console.log(`No keeper product matching "${KEEP_NAME_LIKE}" — aborting.`); await client.query('ROLLBACK'); process.exit(1); }
  if (dup.length > 1) {
    console.log(`Multiple candidates for "${DUPLICATE_NAME}":`);
    for (const d of dup) console.log(`  ${d.sku} — ${d.name} (${d.id})`);
    console.log('Refine DUPLICATE_NAME to pick one — aborting.');
    await client.query('ROLLBACK'); process.exit(1);
  }

  const duplicate = dup[0];
  const primary = keep[0];
  console.log(`Merging "${duplicate.name}" [${duplicate.sku}] -> "${primary.name}" [${primary.sku}]`);

  // Free barcode on duplicate so keeper can inherit it without a unique conflict
  if (!primary.barcode && duplicate.barcode) await client.query('UPDATE product SET barcode=NULL WHERE id=$1', [duplicate.id]);

  // Merge stock rows per store
  const { rows: stockRows } = await client.query(
    'SELECT * FROM stock_item WHERE product_id = ANY($1::uuid[]) ORDER BY updated_at DESC FOR UPDATE',
    [[primary.id, duplicate.id]],
  );
  for (const storeId of [...new Set(stockRows.map((r) => r.store_id))]) {
    const rows = stockRows.filter((r) => r.store_id === storeId);
    const keeper = rows.find((r) => r.product_id === primary.id) ?? rows[0];
    const sums = rows.reduce((a, r) => ({
      onHand: a.onHand + r.quantity_on_hand,
      reserved: a.reserved + r.quantity_reserved,
      onOrder: a.onOrder + r.quantity_on_order,
    }), { onHand: 0, reserved: 0, onOrder: 0 });
    await client.query(
      'UPDATE stock_item SET product_id=$1, quantity_on_hand=$2, quantity_reserved=$3, quantity_on_order=$4, updated_at=NOW() WHERE id=$5',
      [primary.id, sums.onHand, sums.reserved, sums.onOrder, keeper.id],
    );
    const remove = rows.filter((r) => r.id !== keeper.id).map((r) => r.id);
    if (remove.length) await client.query('DELETE FROM stock_item WHERE id = ANY($1::uuid[])', [remove]);
  }

  // Repoint every dependent table
  for (const [table, column] of referenceColumns) {
    const { rowCount } = await client.query(`UPDATE ${quote(table)} SET ${quote(column)}=$1 WHERE ${quote(column)}=$2`, [primary.id, duplicate.id]);
    if (rowCount) console.log(`  repointed ${rowCount} row(s) in ${table}.${column}`);
  }

  // Enrich keeper with any missing fields from the duplicate
  await client.query(`UPDATE product SET
    brand=coalesce(brand,$2), generic_name=coalesce(generic_name,$3), description=coalesce(description,$4),
    short_description=coalesce(short_description,$5), category_id=coalesce(category_id,$6), primary_supplier_id=coalesce(primary_supplier_id,$7),
    barcode=coalesce(barcode,$8), image_url=coalesce(image_url,$9),
    images=CASE WHEN coalesce(jsonb_array_length(images),0)=0 THEN $10::jsonb ELSE images END,
    updated_at=NOW() WHERE id=$1`,
    [primary.id, duplicate.brand, duplicate.generic_name, duplicate.description, duplicate.short_description,
     duplicate.category_id, duplicate.primary_supplier_id, duplicate.barcode, duplicate.image_url,
     JSON.stringify(duplicate.images ?? [])]);

  await client.query('DELETE FROM product WHERE id=$1', [duplicate.id]);
  await client.query('COMMIT');
  console.log('Merge committed.');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
