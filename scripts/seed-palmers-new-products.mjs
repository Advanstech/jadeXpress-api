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
      console.warn(`⚠️ Query attempt ${i + 1} failed, retrying in 1s...`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

console.log('🌱 Seeding Palmer\'s Tahitian Vanilla & Brazilian Coco Products...');

const stores = await runQuery(() => sql`SELECT id FROM store WHERE code = 'ISR' LIMIT 1`);
if (!stores.length) {
  console.error('No store found.');
  process.exit(1);
}
const storeId = stores[0].id;

// Ensure Supplier
const [supPAL] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-PAL', 'E.T. Browne Drug Co. (Palmer''s USA)', 'Customer Care', 'orders@palmers.com', '+1 800 378 6146', '440 Sylvan Avenue', 'Englewood Cliffs', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierPALId = supPAL.id;

// Category
const [catSkin] = await runQuery(() => sql`SELECT id FROM category WHERE slug = 'skincare-lotions' LIMIT 1`);
const categoryId = catSkin.id;

const products = [
  {
    sku: 'PAL-TV-OIL192ML',
    barcode: '010181045233',
    name: "Palmer's Cocoa Butter Formula Tahitian Vanilla Moisture Drenching Body Oil (192 ml)",
    genericName: 'Moisture Drenching Body Oil with Tahitian Vanilla, Cocoa Butter & Shea',
    description: "Palmer's Cocoa Butter Formula Tahitian Vanilla Moisture Drenching Body Oil with Vitamin E provides 72-hour moisture. Dermatologist approved, antioxidant-rich formula with Tahitian Vanilla, Cocoa Butter, and Shea for silky smooth skin. 192 ml / 6.5 fl. oz. e.",
    categoryId: categoryId,
    primarySupplierId: supplierPALId,
    type: 'supplement',
    costPricePesewas: 13000,
    sellingPricePesewas: 20000,
    unit: 'bottle',
    packSize: 1,
    dosageForm: 'Body Oil',
    strength: 'Tahitian Vanilla, Cocoa Butter & Shea',
    manufacturer: "E.T. Browne Drug Co. (Palmer's)",
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 30,
    batchNumber: 'LOT-PALTVO19-2026',
    imageUrl: '/products/palmers-tahitian-vanilla-body-oil-192ml.png',
  },
  {
    sku: 'PAL-TV-CRM250G',
    barcode: '010181045240',
    name: "Palmer's Cocoa Butter Formula Tahitian Vanilla Whipped Moisture Drenching Body Cream (250g)",
    genericName: 'Whipped Moisture Drenching Body Cream with Tahitian Vanilla, Cocoa Butter & Shea',
    description: "Palmer's Cocoa Butter Formula Tahitian Vanilla Whipped Moisture Drenching Body Cream with Vitamin E provides 72-hour moisture. Dermatologist approved, rich antioxidant moisture blend for velvety soft skin. Net Wt. 250g / 8.8 oz. e.",
    categoryId: categoryId,
    primarySupplierId: supplierPALId,
    type: 'supplement',
    costPricePesewas: 12500,
    sellingPricePesewas: 19000,
    unit: 'jar',
    packSize: 1,
    dosageForm: 'Body Cream',
    strength: 'Tahitian Vanilla, Cocoa Butter & Shea',
    manufacturer: "E.T. Browne Drug Co. (Palmer's)",
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 25,
    batchNumber: 'LOT-PALTVC25-2026',
    imageUrl: '/products/palmers-tahitian-vanilla-body-cream-250g.png',
  },
  {
    sku: 'PAL-BCO-OIL192ML',
    barcode: '010181045295',
    name: "Palmer's Coconut Oil Formula Brazilian Coco Firming Bum, Bust & Body Oil (192 ml)",
    genericName: 'Firming Bum, Bust & Body Oil with Coconut, Acai, Guarana & Brazil Nut',
    description: "Palmer's Coconut Oil Formula Brazilian Coco Firming Bum, Bust & Body Oil with Vitamin E. Powered by Coconut, Acai, Guarana, and Brazil Nut. Visibly firms skin in as little as 2 weeks with 48-hour moisture. Dermatologist approved. 192 ml / 6.5 fl. oz. e.",
    categoryId: categoryId,
    primarySupplierId: supplierPALId,
    type: 'supplement',
    costPricePesewas: 13500,
    sellingPricePesewas: 21000,
    unit: 'bottle',
    packSize: 1,
    dosageForm: 'Body Oil',
    strength: 'Coconut, Acai, Guarana & Brazil Nut',
    manufacturer: "E.T. Browne Drug Co. (Palmer's)",
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 30,
    batchNumber: 'LOT-PALBCO19-2026',
    imageUrl: '/products/palmers-brazilian-coco-body-oil-192ml.png',
  },
  {
    sku: 'PAL-BCC-CRM250G',
    barcode: '010181045301',
    name: "Palmer's Coconut Oil Formula Brazilian Coco Cream Whipped Firming Bum, Bust & Body Cream (250g)",
    genericName: 'Whipped Firming Bum, Bust & Body Cream with Coconut Oil & Vitamin E',
    description: "Palmer's Coconut Oil Formula Brazilian Coco Cream Whipped Firming Bum, Bust & Body Cream with Vitamin E. Visibly firms skin in as little as 2 weeks with 48-hour moisture. Dermatologist approved. Net Wt. 250g / 8.8 oz. e.",
    categoryId: categoryId,
    primarySupplierId: supplierPALId,
    type: 'supplement',
    costPricePesewas: 13000,
    sellingPricePesewas: 20000,
    unit: 'jar',
    packSize: 1,
    dosageForm: 'Body Cream',
    strength: 'Coconut, Acai, Guarana & Brazil Nut',
    manufacturer: "E.T. Browne Drug Co. (Palmer's)",
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 25,
    batchNumber: 'LOT-PALBCC25-2026',
    imageUrl: '/products/palmers-brazilian-coco-cream-whipped-firming-250g.png',
  }
];

for (const p of products) {
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
        name = ${p.name},
        generic_name = ${p.genericName},
        description = ${p.description},
        cost_price_pesewas = ${p.costPricePesewas},
        selling_price_pesewas = ${p.sellingPricePesewas},
        image_url = ${p.imageUrl},
        dosage_form = ${p.dosageForm},
        strength = ${p.strength},
        manufacturer = ${p.manufacturer}
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
  }

  console.log(`✅ Seeded/Updated: ${p.name} (SKU: ${p.sku})`);
}

console.log('\n🎉 Successfully seeded Palmer\'s products into Neon PostgreSQL!');
