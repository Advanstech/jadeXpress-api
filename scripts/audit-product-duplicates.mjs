import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
for (const line of fs.readFileSync(path.resolve(dirname, '../.env'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.trim().startsWith('#') && !process.env[line.slice(0, i).trim()]) {
    process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
}
const sql = neon(process.env.DATABASE_URL);
const products = await sql`
  SELECT p.*, coalesce(s.qty, 0)::int AS stock
  FROM product p
  LEFT JOIN (SELECT product_id, sum(quantity_on_hand) qty FROM stock_item GROUP BY product_id) s ON s.product_id = p.id
  ORDER BY p.name
`;
const normalize = (value) => (value ?? '').toLowerCase()
  .replace(/\b(tablets?|tabs?|capsules?|caps?|softgels?|lozenges?|teabags?|powder)\b/g, ' ')
  .replace(/\b(ext|extract)\b/g, ' extract ')
  .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (value) => new Set(normalize(value).split(' ').filter(Boolean));
const similarity = (a, b) => {
  const aa = tokens(a), bb = tokens(b);
  const intersection = [...aa].filter((x) => bb.has(x)).length;
  return intersection / Math.max(aa.size, bb.size, 1);
};
const exact = new Map();
for (const product of products) {
  const key = normalize(product.name);
  exact.set(key, [...(exact.get(key) ?? []), product]);
}
const certain = [...exact.entries()].filter(([, group]) => group.length > 1);
const certainIds = new Set(certain.flatMap(([, group]) => group.map((p) => p.id)));
const candidates = [];
for (let i = 0; i < products.length; i++) {
  for (let j = i + 1; j < products.length; j++) {
    const a = products[i], b = products[j];
    if (certainIds.has(a.id) && certainIds.has(b.id)) continue;
    const score = similarity(a.name, b.name);
    const sameBarcode = a.barcode && b.barcode && a.barcode === b.barcode;
    if (sameBarcode || score >= 0.82) candidates.push({ score: sameBarcode ? 1 : score, a, b, sameBarcode });
  }
}
const refs = await sql`
  SELECT tc.table_name, kcu.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.constraint_schema = kcu.constraint_schema
  JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.constraint_schema = tc.constraint_schema
  WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'product' AND ccu.column_name = 'id'
  ORDER BY tc.table_name, kcu.column_name
`;
const allIds = [...new Set([...certain.flatMap(([, g]) => g.map((p) => p.id)), ...candidates.flatMap((c) => [c.a.id, c.b.id])])];
const counts = {};
for (const ref of refs) {
  const table = ref.table_name.replace(/"/g, '""');
  const column = ref.column_name.replace(/"/g, '""');
  const rows = await sql.query(`SELECT "${column}"::text id, count(*)::int count FROM "${table}" WHERE "${column}" = ANY($1::uuid[]) GROUP BY "${column}"`, [allIds]);
  for (const row of rows) {
    counts[row.id] ??= {};
    counts[row.id][`${ref.table_name}.${ref.column_name}`] = row.count;
  }
}
const compact = (p) => ({ id: p.id, name: p.name, sku: p.sku, barcode: p.barcode, brand: p.brand, description: p.description, shortDescription: p.short_description, imageUrl: p.image_url, images: p.images, stock: p.stock, references: counts[p.id] ?? {} });
console.log(JSON.stringify({ totalProducts: products.length, products: products.map(compact), foreignKeys: refs, certain: certain.map(([key, group]) => ({ key, products: group.map(compact) })), candidates: candidates.sort((a, b) => b.score - a.score).map((c) => ({ score: Number(c.score.toFixed(3)), sameBarcode: c.sameBarcode, products: [compact(c.a), compact(c.b)] })) }, null, 2));
