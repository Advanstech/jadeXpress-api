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

console.log('🌱 Seeding 5 Extracted Shelf Products into Neon PostgreSQL...');

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
const skincareCatId = catMap.get('skincare-lotions') || catMap.get('beauty-skin');
const beautyCatId = catMap.get('beauty-skin') || skincareCatId;

// Suppliers
const [supAVE] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-AVE', 'Johnson & Johnson (Aveeno)', 'Supply Chain', 'orders@jnj.com', '+1 800 222 1222', '1 Johnson & Johnson Plaza', 'New Brunswick', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierAVEId = supAVE.id;

const [supCER] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-CER', 'L''Oréal USA (CeraVe)', 'Supply Desk', 'orders@cerave.com', '+1 800 321 4567', '10 Hudson Yards', 'New York', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierCERId = supCER.id;

const [supOGX] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-OGX', 'Vogue International (OGX USA)', 'Supply Chain', 'orders@ogxbeauty.com', '+1 800 873 2445', '407 Tech Pkwy', 'Clearwater', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierOGXId = supOGX.id;

const [supPG] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-PG', 'Procter & Gamble (Crest)', 'Customer Support', 'orders@crest.com', '+1 800 445 5388', '1 Procter & Gamble Plaza', 'Cincinnati', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierPGId = supPG.id;

const extractedProducts = [
  {
    sku: 'AVE-LOT-709ML',
    barcode: '381370036318',
    name: 'Aveeno Daily Moisturizing Body Lotion (709ml)',
    genericName: 'Aveeno Daily Moisturizing Lotion (24 fl oz / 709 ml)',
    description: 'Aveeno Daily Moisturizing Lotion is clinically proven to instantly strengthen the skin barrier with 48-hour continuous hydration. Formulated with soothing Prebiotic Oat, this non-greasy, fast-absorbing lotion nourishes normal, dry, and sensitive skin. Fragrance-free, paraben-free, and dye-free. 24 fl. oz. (709 mL).',
    categoryId: skincareCatId,
    primarySupplierId: supplierAVEId,
    type: 'supplement',
    costPricePesewas: 18000,
    sellingPricePesewas: 26000,
    unit: 'bottle',
    packSize: 1,
    dosageForm: 'Lotion',
    strength: 'Prebiotic Oat 48Hr Hydration',
    manufacturer: 'Johnson & Johnson (Aveeno)',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 24,
    batchNumber: 'LOT-AVELOT70-2026',
    imageUrl: '/products/aveeno-daily-moisturizing-709ml.png',
  },
  {
    sku: 'AVE-DMBW-975ML',
    barcode: '381371182281',
    name: 'Aveeno Daily Moisturizing Body Wash (975ml)',
    genericName: 'Aveeno Daily Moisturizing Body Wash Value Size (33 fl oz / 975 ml)',
    description: 'Aveeno Daily Moisturizing Body Wash gently cleanses and deeply nourishes dry, sensitive skin with a rich Prebiotic Oat formula. Lightly scented and soap-free, it replenishes essential moisture for visibly healthier-looking skin. Value Size 33 fl. oz. (975 mL) provides 83% more wash.',
    categoryId: skincareCatId,
    primarySupplierId: supplierAVEId,
    type: 'supplement',
    costPricePesewas: 17000,
    sellingPricePesewas: 24500,
    unit: 'bottle',
    packSize: 1,
    dosageForm: 'Body Wash',
    strength: 'Prebiotic Oat Lightly Scented',
    manufacturer: 'Johnson & Johnson (Aveeno)',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 25,
    batchNumber: 'LOT-AVEDMBW9-2026',
    imageUrl: '/products/aveeno-daily-moisturizing-body-wash-975ml.png',
  },
  {
    sku: 'CER-FFC-355ML',
    barcode: '3606000537712',
    name: 'CeraVe Foaming Facial Cleanser (355ml)',
    genericName: 'CeraVe Foaming Facial Cleanser for Normal to Oily Skin (12 fl oz / 355 ml)',
    description: 'CeraVe Foaming Facial Cleanser effectively removes excess oil, dirt, and makeup without disrupting the skin\'s natural protective barrier. Developed with dermatologists, it is formulated with 3 essential ceramides (1, 3, 6-II), niacinamide, and hyaluronic acid for daily oil control. Non-comedogenic, non-drying, and fragrance-free. 12 FL OZ (355 mL).',
    categoryId: skincareCatId,
    primarySupplierId: supplierCERId,
    type: 'supplement',
    costPricePesewas: 17500,
    sellingPricePesewas: 25000,
    unit: 'bottle',
    packSize: 1,
    dosageForm: 'Cleanser',
    strength: '3 Essential Ceramides + Niacinamide + HA',
    manufacturer: 'L\'Oréal USA (CeraVe)',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 25,
    batchNumber: 'LOT-CERFFC35-2026',
    imageUrl: '/products/cerave-foaming-facial-cleanser-355ml.png',
  },
  {
    sku: 'OGX-COC-COF-577ML',
    barcode: '022796901811',
    name: 'OGX Smoothing + Coconut Coffee Body Scrub & Wash (577ml)',
    genericName: 'OGX Smoothing + Coconut Coffee Scrub & Wash (19.5 fl oz / 577 ml)',
    description: 'OGX Smoothing + Coconut Coffee Body Scrub & Wash is an invigorating, sulfate-free blend infused with exotic arabica coffee and nourishing coconut oil. Gently exfoliates and boosts hydration while promoting silky-soft, supple skin. Features a rich, fresh coffee aroma. 577 mL / 19.5 fl. oz.',
    categoryId: skincareCatId,
    primarySupplierId: supplierOGXId,
    type: 'supplement',
    costPricePesewas: 12000,
    sellingPricePesewas: 17500,
    unit: 'bottle',
    packSize: 1,
    dosageForm: 'Body Scrub & Wash',
    strength: 'Arabica Coffee & Coconut Oil',
    manufacturer: 'Vogue International (OGX)',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-OGXCOCCO-2026',
    imageUrl: '/products/ogx-smoothing-coconut-coffee-scrub-wash-577ml.png',
  },
  {
    sku: 'CREST3DW-PROADV-5PK',
    barcode: '037000806455',
    name: 'Crest 3D White Pro Advanced Whitening Toothpaste (5-Pack, 5 x 147g)',
    genericName: 'Crest 3D White Pro Advanced Whitening Toothpaste 5 Pack (26 oz / 737 g)',
    description: 'Crest 3D White Pro Advanced Whitening Fluoride Anticavity Toothpaste removes 100% more surface stains and provides 24-hour active stain prevention with twice-daily brushing. Clinically proven whitening ingredients deliver visibly whiter teeth in 3 days while strengthening enamel and fighting cavities. Value bundle includes 5 tubes (5.2 oz / 147 g each; Total Net Wt 26 oz / 737 g).',
    categoryId: beautyCatId,
    primarySupplierId: supplierPGId,
    type: 'supplement',
    costPricePesewas: 22000,
    sellingPricePesewas: 32000,
    unit: 'box',
    packSize: 5,
    dosageForm: 'Toothpaste',
    strength: 'Pro Advanced Whitening Fluoride',
    manufacturer: 'Procter & Gamble (Crest)',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-CREST3DP-2026',
    imageUrl: '/products/crest-3d-white-pro-advanced-whitening-5pack.png',
  },
];

for (const p of extractedProducts) {
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

  // Also update generic Crest 3D White toothpaste image if matching
  if (p.sku === 'CREST3DW-PROADV-5PK') {
    await runQuery(() => sql`
      UPDATE product SET image_url = '/products/crest-3d-white-toothpaste.png'
      WHERE sku IN ('CREST3D-G8RA', 'CREST3DW-OWHC-QU2E-0')
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

console.log('\n🎉 Successfully seeded and updated all 5 extracted products in Neon PostgreSQL!');
