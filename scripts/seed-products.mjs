import { neon } from '@neondatabase/serverless';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '../.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

const sql = neon(process.env.DATABASE_URL);

console.log('🌱 Seeding Products...');

const stores = await sql`SELECT id FROM store WHERE code = 'ISR' LIMIT 1`;
if (!stores.length) {
    console.error('No store found. Run seed.mjs first.');
    process.exit(1);
}
const storeId = stores[0].id;

const categories = await sql`SELECT id, slug FROM category`;
const getCat = (slug) => categories.find(c => c.slug === slug)?.id || null;

const products = [
    { sku: 'VIT-C-1000', barcode: '123456789012', name: 'Vitamin C 1000mg 30s', category: 'vitamins-minerals', cost: 4500, price: 6500 },
    { sku: 'OMG-3-60', barcode: '123456789013', name: 'Omega 3 Fish Oil 60s', category: 'omega-fish-oils', cost: 12000, price: 18000 },
    { sku: 'WHEY-PRO-1KG', barcode: '123456789014', name: 'Whey Protein Isolate 1kg', category: 'protein-sports', cost: 35000, price: 45000 },
    { sku: 'ZINC-50', barcode: '123456789015', name: 'Zinc 50mg Tablets 60s', category: 'vitamins-minerals', cost: 2500, price: 4000 },
    { sku: 'COL-PEP-300', barcode: '123456789016', name: 'Collagen Peptides 300g', category: 'beauty-skin', cost: 25000, price: 32000 },
];

for (const p of products) {
    const catId = getCat(p.category);
    const [inserted] = await sql`
        INSERT INTO product (sku, barcode, name, category_id, cost_price_pesewas, selling_price_pesewas, type, unit)
        VALUES (${p.sku}, ${p.barcode}, ${p.name}, ${catId}, ${p.cost}, ${p.price}, 'supplement', 'piece')
        ON CONFLICT (sku) DO NOTHING
        RETURNING id
    `;
    if (inserted) {
        await sql`
            INSERT INTO stock_item (product_id, store_id, quantity_on_hand)
            VALUES (${inserted.id}, ${storeId}, 0)
            ON CONFLICT DO NOTHING
        `;
        console.log(`✓ Inserted product: ${p.name}`);
    } else {
        console.log(`- Skipped existing product: ${p.name}`);
    }
}
console.log('✅ Done!');
