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

async function runQuery(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`⚠️ Query attempt ${i + 1} failed, retrying in 1s...`, err.message);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

console.log('🌱 Seeding Batch 3 Extracted Products into Neon PostgreSQL...');

// Ensure Store
const stores = await runQuery(() => sql`SELECT id FROM store WHERE code = 'ISR' LIMIT 1`);
if (!stores.length) {
    console.error('No store found.');
    process.exit(1);
}
const storeId = stores[0].id;

// Categories
const categories = await runQuery(() => sql`SELECT id, slug FROM category`);
const catMap = new Map(categories.map(c => [c.slug, c.id]));
const supplementsCatId = catMap.get('supplements-wellness') || categories[0].id;
const vitaminsCatId = catMap.get('vitamins-minerals') || supplementsCatId;

// Suppliers
const [supMRO] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-MRO', 'MaryRuth Organics LLC USA', 'Sales Desk', 'orders@maryruthorganics.com', '+1 310 954 1009', '1171 S Robertson Blvd', 'Los Angeles', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierMROId = supMRO.id;

const [sup21C] = await runQuery(() => sql`SELECT id FROM supplier WHERE code = 'SUP-21C' LIMIT 1`);
const supplier21CId = sup21C ? sup21C.id : supplierMROId;

const batch3Products = [
  {
    sku: 'MRO-LMM-RAS-650ML',
    barcode: '850018704009',
    name: 'MaryRuth\'s Liquid Morning Multivitamin Broad Spectrum Raspberry (650ml)',
    genericName: 'MaryRuth\'s Liquid Morning Multivitamin Broad Spectrum Raspberry (22 fl oz / 650 ml)',
    description: 'MaryRuth\'s Liquid Morning Multivitamin Broad Spectrum in delicious Raspberry flavor provides essential daily wellness, beauty, and immunity support. Formulated with a comprehensive blend of vitamins (A, C, D3, E, B-Complex), minerals, and amino acids for maximum cellular absorption and vital energy throughout the day. Clean label certified, vegan, non-GMO, gluten-free, and sugar-free. 22 FL OZ (650 mL).',
    categoryId: vitaminsCatId,
    primarySupplierId: supplierMROId,
    type: 'supplement',
    costPricePesewas: 32000,
    sellingPricePesewas: 48000,
    unit: 'bottle',
    packSize: 1,
    dosageForm: 'Liquid',
    strength: 'Broad Spectrum Daily Multivitamin',
    manufacturer: 'MaryRuth Organics LLC USA',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-MROLMR65-2026',
    imageUrl: '/products/maryruths-liquid-morning-multivitamin-broad-spectrum-raspberry-650ml.png',
  },
  {
    sku: 'ORG-COL-726G',
    barcode: '851770003901',
    name: 'Orgain Collagen Peptides + Probiotics Unflavored (726g)',
    genericName: 'Orgain Grass-Fed Collagen Peptides + Probiotics (25.6 oz / 726 g)',
    description: 'Orgain Collagen Peptides + Probiotics is formulated with 20g of grass-fed, pasture-raised collagen peptides and 1 billion active probiotics per serving. Supports healthy hair, vibrant skin, strong nails, joint flexibility, and digestive gut health. Unflavored, easily dissolvable in hot or cold liquids, paleo-friendly, and gluten-free. NET WT 25.6 OZ (1.6 LB / 726 g).',
    categoryId: supplementsCatId,
    primarySupplierId: supplier21CId,
    type: 'supplement',
    costPricePesewas: 32000,
    sellingPricePesewas: 46000,
    unit: 'tub',
    packSize: 1,
    dosageForm: 'Powder',
    strength: '20g Grass-Fed Collagen + 1B Probiotics',
    manufacturer: 'Orgain LLC USA',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 25,
    batchNumber: 'LOT-ORGCOL72-2026',
    imageUrl: '/products/orgain-collagen-peptides-probiotics-unflavored-726g.png',
  },
];

for (const p of batch3Products) {
  let prodRows = await runQuery(() => sql`SELECT id FROM product WHERE sku = ${p.sku}`);
  let productId;
  if (!prodRows.length) {
    const [prod] = await runQuery(() => sql`
      INSERT INTO product (
        sku, barcode, name, generic_name, description, category_id, primary_supplier_id,
        type, cost_price_pesewas, selling_price_pesewas, unit, pack_size, dosage_form,
        strength, manufacturer, country_of_origin, reorder_point, reorder_qty, image_url
      )
      VALUES (
        ${p.sku}, ${p.barcode}, ${p.name}, ${p.genericName}, ${p.description}, ${p.categoryId}, ${p.primarySupplierId},
        ${p.type}, ${p.costPricePesewas}, ${p.sellingPricePesewas}, ${p.unit}, ${p.packSize}, ${p.dosageForm},
        ${p.strength}, ${p.manufacturer}, ${p.countryOfOrigin}, ${p.reorderPoint}, ${p.reorderQty}, ${p.imageUrl}
      )
      RETURNING id
    `);
    productId = prod.id;
  } else {
    productId = prodRows[0].id;
    await runQuery(() => sql`
      UPDATE product SET
        barcode = ${p.barcode},
        name = ${p.name},
        generic_name = ${p.genericName},
        description = ${p.description},
        category_id = ${p.categoryId},
        primary_supplier_id = ${p.primarySupplierId},
        cost_price_pesewas = ${p.costPricePesewas},
        selling_price_pesewas = ${p.sellingPricePesewas},
        unit = ${p.unit},
        pack_size = ${p.packSize},
        dosage_form = ${p.dosageForm},
        strength = ${p.strength},
        manufacturer = ${p.manufacturer},
        country_of_origin = ${p.countryOfOrigin},
        reorder_point = ${p.reorderPoint},
        reorder_qty = ${p.reorderQty},
        image_url = ${p.imageUrl}
      WHERE id = ${productId}
    `);
  }

  // Upsert Stock Item
  const stockRows = await runQuery(() => sql`SELECT id FROM stock_item WHERE product_id = ${productId} AND store_id = ${storeId}`);
  if (!stockRows.length) {
    await runQuery(() => sql`
      INSERT INTO stock_item (product_id, store_id, quantity_on_hand)
      VALUES (${productId}, ${storeId}, ${p.initialQty})
    `);
  } else {
    await runQuery(() => sql`
      UPDATE stock_item SET quantity_on_hand = ${p.initialQty} WHERE id = ${stockRows[0].id}
    `);
  }

  // Stock Batch
  const batchRows = await runQuery(() => sql`SELECT id FROM stock_batch WHERE batch_number = ${p.batchNumber}`);
  if (!batchRows.length) {
    await runQuery(() => sql`
      INSERT INTO stock_batch (
        product_id, store_id, supplier_id, batch_number, quantity_received, quantity_remaining, cost_price_pesewas, received_at, expiry_date
      )
      VALUES (
        ${productId}, ${storeId}, ${p.primarySupplierId}, ${p.batchNumber}, ${p.initialQty}, ${p.initialQty}, ${p.costPricePesewas}, NOW(), '2027-12-31'
      )
    `);
  } else {
    await runQuery(() => sql`
      UPDATE stock_batch SET
        quantity_remaining = ${p.initialQty},
        cost_price_pesewas = ${p.costPricePesewas}
      WHERE id = ${batchRows[0].id}
    `);
  }

  console.log(`✅ Product seeded/updated: ${p.name} (SKU: ${p.sku}) | Stock: ${p.initialQty} units | Price: GH₵ ${(p.sellingPricePesewas / 100).toFixed(2)}`);
}

console.log('\n🎉 Successfully seeded Batch 3 extracted products in Neon PostgreSQL!');
