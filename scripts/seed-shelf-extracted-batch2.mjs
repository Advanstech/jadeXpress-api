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

console.log('🌱 Seeding Batch 2 Extracted Products into Neon PostgreSQL...');

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
const beautyCatId = catMap.get('beauty-skin') || catMap.get('skincare-lotions') || supplementsCatId;

// Suppliers
const [supPG] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-PG', 'Procter & Gamble (Crest)', 'Customer Support', 'orders@crest.com', '+1 800 445 5388', '1 Procter & Gamble Plaza', 'Cincinnati', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierPGId = supPG.id;

const [supGLF] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-GLF', 'Garden of Life LLC USA', 'Client Services', 'orders@gardenoflife.com', '+1 800 365 7709', '4200 Northcorp Pkwy', 'Palm Beach Gardens', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierGLFId = supGLF.id;

const [supLIV] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-LIV', 'Liquid I.V. (The LIV Group)', 'Wholesale Desk', 'orders@liquid-iv.com', '+1 855 846 4887', '777 S Alameda St', 'Los Angeles', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierLIVId = supLIV.id;

const [supMRO] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-MRO', 'MaryRuth Organics LLC USA', 'Sales Desk', 'orders@maryruthorganics.com', '+1 310 954 1009', '1171 S Robertson Blvd', 'Los Angeles', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierMROId = supMRO.id;

const batch2Products = [
  {
    sku: 'CRESTPRO-ADV-5PK',
    barcode: '037000780441',
    name: 'Crest Pro-Health Advanced Toothpaste (5-Pack, 5 x 167g)',
    genericName: 'Crest Pro-Health Advanced Deep Clean Mint Toothpaste 5 Pack (29.5 oz / 836 g)',
    description: 'Crest Pro-Health Advanced Fluoride Toothpaste delivers 24-hour antibacterial protection and whole mouth defense with 10 benefits in 1: cavities, gingivitis, sensitivity, plaque, whitening, fresh breath, anti-bac protection, whole mouth clean, acid erosion defense, and enamel protection. Deep Clean Mint flavor. Value pack includes 5 tubes (5.9 oz / 167 g each; Total Net Wt 29.5 oz / 836 g).',
    categoryId: beautyCatId,
    primarySupplierId: supplierPGId,
    type: 'supplement',
    costPricePesewas: 22000,
    sellingPricePesewas: 32000,
    unit: 'box',
    packSize: 5,
    dosageForm: 'Toothpaste',
    strength: '10-in-1 Whole Mouth Defense Fluoride',
    manufacturer: 'Procter & Gamble (Crest)',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-CRESTPRO5-2026',
    imageUrl: '/products/crest-pro-health-advanced-5pack.png',
  },
  {
    sku: 'GOL-PRO-45B',
    barcode: '658010123181',
    name: 'Garden of Life Dr. Formulated Probiotics Advanced Women\'s Daily Care (60 Capsules)',
    genericName: 'Garden of Life Dr. Formulated Probiotics 45 Billion CFU (60 Veggie Capsules)',
    description: 'Garden of Life Dr. Formulated Probiotics Advanced Women\'s Daily Care delivers 45 Billion CFU guaranteed across 17 diverse probiotic strains clinically studied for women\'s health. Promotes optimal vaginal flora, robust immune function, and digestive balance. Vegetarian, gluten-free, and Non-GMO Project Verified. 60 vegetarian capsules.',
    categoryId: supplementsCatId,
    primarySupplierId: supplierGLFId,
    type: 'supplement',
    costPricePesewas: 32000,
    sellingPricePesewas: 48000,
    unit: 'box',
    packSize: 60,
    dosageForm: 'Capsule',
    strength: '45 Billion CFU (17 Strains)',
    manufacturer: 'Garden of Life LLC USA',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 25,
    batchNumber: 'LOT-GOLPRO45-2026',
    imageUrl: '/products/garden-of-life-probiotics-advanced-womens-daily-care-60c.png',
  },
  {
    sku: 'LIV-HYD-VAR-30PK',
    barcode: '851764007126',
    name: 'Liquid I.V. Hydration Multiplier Variety Pack (30 Sticks)',
    genericName: 'Liquid I.V. Electrolyte Drink Mix Variety Pack 30 Sticks (16.93 oz / 480 g)',
    description: 'Liquid I.V. Hydration Multiplier is an electrolyte drink mix powered by Cellular Transport Technology (CTT)® designed to deliver hydration to your body faster and more efficiently than water alone. Variety pack includes 15 Lemon Lime and 15 Strawberry single-serving on-the-go sticks. Non-GMO, gluten-free, with 3x the electrolytes of traditional sports drinks and 5 essential vitamins (B3, B5, B6, B12, and Vitamin C). 30 sticks (16.93 oz / 480 g).',
    categoryId: supplementsCatId,
    primarySupplierId: supplierLIVId,
    type: 'supplement',
    costPricePesewas: 26000,
    sellingPricePesewas: 38000,
    unit: 'pack',
    packSize: 30,
    dosageForm: 'Powder Sticks',
    strength: 'Electrolyte Multiplier CTT',
    manufacturer: 'Liquid I.V. (Unilever)',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 25,
    batchNumber: 'LOT-LIVHYD30-2026',
    imageUrl: '/products/liquid-iv-hydration-multiplier-variety-pack-30s.png',
  },
  {
    sku: 'MRO-LMM-PCH-650ML',
    barcode: '850018704207',
    name: 'MaryRuth\'s Liquid Morning Multivitamin + Hair Growth Peach Mango (650ml)',
    genericName: 'MaryRuth\'s Liquid Morning Multivitamin + Hair Growth Peach Mango (22 fl oz / 650 ml)',
    description: 'MaryRuth\'s Liquid Morning Multivitamin + Hair Growth in delicious Peach Mango flavor is clinically formulated with Lustriva® to support women in growing thicker, fuller hair and boosting skin elasticity in as few as 3 weeks. Packed with essential daily vitamins (A, C, D3, E, B-Complex), amino acids, and minerals in an easily absorbable liquid format. Clean label certified, vegan, non-GMO, and sugar-free. 22 FL OZ (650 mL).',
    categoryId: vitaminsCatId,
    primarySupplierId: supplierMROId,
    type: 'supplement',
    costPricePesewas: 34000,
    sellingPricePesewas: 49000,
    unit: 'bottle',
    packSize: 1,
    dosageForm: 'Liquid',
    strength: 'Lustriva® + Essential Multivitamin Complex',
    manufacturer: 'MaryRuth Organics LLC USA',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-MROLMM65-2026',
    imageUrl: '/products/maryruths-liquid-morning-multivitamin-hair-growth-peach-mango-650ml.png',
  },
];

for (const p of batch2Products) {
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

  // Also update related single-item or earlier Crest Pro-Health product image references
  if (p.sku === 'CRESTPRO-ADV-5PK') {
    await runQuery(() => sql`
      UPDATE product SET image_url = '/products/crest-pro-health-advanced-toothpaste.png'
      WHERE sku = 'CRESTPRO-OWHC-3F0N-1'
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

console.log('\n🎉 Successfully seeded Batch 2 extracted products in Neon PostgreSQL!');
