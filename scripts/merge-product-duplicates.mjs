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
const normalize = (value) => (value ?? '').toLowerCase().replace(/['":;,\.()\/-]/g, ' ').replace(/\s+/g, ' ').trim();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
const extraGroups = [
  ['df8e83fa-ef09-41d5-aa8f-ac581c47a281', 'b204cb32-f528-4696-a780-5d3d60069583', '688c25fe-185f-4a2a-af75-3430465b0f62'],
  ['a3b2dbc8-0406-4935-9f88-d9677483065b', 'bbcc90b9-e72e-4856-9574-d6b4f982b1b5'],
  ['f7e2662d-2960-40b9-bcab-77586015a53a', 'd92921ad-878d-4c38-aee5-fe8a74f2a85a'],
  ['a9b4c2b1-77bc-41c3-931e-1202d3e7ecec', 'b8dc9898-aa78-438b-8ed9-505e4c327801'],
  ['daf722e4-a262-4de3-8c1e-f79f95a4f403', 'dedee3ca-8ccc-4a9f-958c-f4e71d2accc0'],
  ['985d5892-435e-4e07-8103-a610d7fb4f61', '9f6338c0-86ee-48fe-88fe-0bd21d6ed26f'],
  ['599c03eb-b7e4-49ba-93db-0249c89d92fa', 'e5ef9966-2515-4fb3-949b-ee8de620b2c7'],
  ['e2a82d3a-33e9-44fd-8572-eb84eaa09386', '6ef6dafc-cb93-43a6-aeaf-e2c3d1232978'],
];
const referenceColumns = [
  ['purchase_item', 'product_id'], ['co_purchase_pattern', 'product_a_id'], ['co_purchase_pattern', 'product_b_id'],
  ['demand_forecast', 'product_id'], ['refund_item', 'product_id'], ['rx_item', 'product_id'], ['sale_item', 'product_id'],
  ['stock_alert', 'product_id'], ['stock_batch', 'product_id'], ['stock_movement', 'product_id'],
  ['stock_transfer_item', 'product_id'], ['storefront_order_item', 'product_id'],
];
const quote = (value) => `"${value.replace(/"/g, '""')}"`;
const score = (p) => (p.image_url ? 100 : 0) + (p.description ? 20 : 0) + (p.brand ? 10 : 0) + (p.category_id ? 10 : 0) + (p.barcode ? 5 : 0) + Number(p.stock ?? 0);
let merged = 0;
try {
  await client.query('BEGIN');
  const { rows: products } = await client.query(`SELECT p.*, coalesce(s.stock, 0)::int stock FROM product p LEFT JOIN (SELECT product_id, sum(quantity_on_hand) stock FROM stock_item GROUP BY product_id) s ON s.product_id = p.id FOR UPDATE OF p`);
  const byId = new Map(products.map((p) => [p.id, p]));
  const exact = new Map();
  for (const product of products) exact.set(normalize(product.name), [...(exact.get(normalize(product.name)) ?? []), product]);
  const groups = [...exact.values()].filter((g) => g.length > 1).map((g) => g.sort((a, b) => score(b) - score(a)).map((p) => p.id));
  const groupedIds = new Set(groups.flat());
  for (const group of extraGroups) {
    const available = group.filter((id) => byId.has(id) && !groupedIds.has(id));
    if (available.length > 1) groups.push(available);
    else if (group.length > 2) {
      const full = group.filter((id) => byId.has(id));
      const existingGroup = groups.find((g) => g.some((id) => full.includes(id)));
      if (existingGroup) for (const id of full) if (!existingGroup.includes(id)) existingGroup.push(id);
    }
  }
  for (const ids of groups) {
    const primaryId = ids[0];
    const primary = byId.get(primaryId);
    if (!primary) continue;
    for (const duplicateId of ids.slice(1)) {
      const duplicate = byId.get(duplicateId);
      if (!duplicate) continue;
      if (!primary.barcode && duplicate.barcode) await client.query('UPDATE product SET barcode=NULL WHERE id=$1', [duplicateId]);
      const { rows: stockRows } = await client.query('SELECT * FROM stock_item WHERE product_id = ANY($1::uuid[]) ORDER BY updated_at DESC FOR UPDATE', [[primaryId, duplicateId]]);
      const stores = [...new Set(stockRows.map((row) => row.store_id))];
      for (const storeId of stores) {
        const rows = stockRows.filter((row) => row.store_id === storeId);
        const keeper = rows.find((row) => row.product_id === primaryId) ?? rows[0];
        const sums = rows.reduce((a, row) => ({ onHand: a.onHand + row.quantity_on_hand, reserved: a.reserved + row.quantity_reserved, onOrder: a.onOrder + row.quantity_on_order }), { onHand: 0, reserved: 0, onOrder: 0 });
        await client.query('UPDATE stock_item SET product_id=$1, quantity_on_hand=$2, quantity_reserved=$3, quantity_on_order=$4, updated_at=NOW() WHERE id=$5', [primaryId, sums.onHand, sums.reserved, sums.onOrder, keeper.id]);
        const remove = rows.filter((row) => row.id !== keeper.id).map((row) => row.id);
        if (remove.length) await client.query('DELETE FROM stock_item WHERE id = ANY($1::uuid[])', [remove]);
      }
      for (const [table, column] of referenceColumns) await client.query(`UPDATE ${quote(table)} SET ${quote(column)}=$1 WHERE ${quote(column)}=$2`, [primaryId, duplicateId]);
      await client.query(`UPDATE product SET
        brand=coalesce(brand,$2), generic_name=coalesce(generic_name,$3), description=coalesce(description,$4),
        short_description=coalesce(short_description,$5), category_id=coalesce(category_id,$6), primary_supplier_id=coalesce(primary_supplier_id,$7),
        barcode=coalesce(barcode,$8), image_url=coalesce(image_url,$9), images=CASE WHEN coalesce(jsonb_array_length(images),0)=0 THEN $10::jsonb ELSE images END,
        updated_at=NOW() WHERE id=$1`, [primaryId, duplicate.brand, duplicate.generic_name, duplicate.description, duplicate.short_description, duplicate.category_id, duplicate.primary_supplier_id, duplicate.barcode, duplicate.image_url, JSON.stringify(duplicate.images ?? [])]);
      await client.query('DELETE FROM product WHERE id=$1', [duplicateId]);
      console.log(`Merged ${duplicate.name} [${duplicate.sku}] -> ${primary.name} [${primary.sku}]`);
      merged++;
    }
  }
  await client.query('COMMIT');
  console.log(`Committed ${merged} product merges.`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
