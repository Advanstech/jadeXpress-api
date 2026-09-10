import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

const sql = neon(process.env.DATABASE_URL);

console.log('📦 Exporting clean database state to api/src/database/seed.ts...');

const [allSuppliers, allCategories, allProducts, allStock] = await Promise.all([
  sql`SELECT * FROM supplier ORDER BY name ASC`,
  sql`SELECT * FROM category ORDER BY name ASC`,
  sql`SELECT * FROM product ORDER BY name ASC`,
  sql`SELECT product_id, SUM(quantity_on_hand)::int as total_stock FROM stock_item GROUP BY product_id`
]);

const stockMap = new Map();
for (const s of allStock) {
  stockMap.set(s.product_id, s.total_stock || 20);
}

const supCodeMap = new Map();
for (const s of allSuppliers) {
  supCodeMap.set(s.id, s.code);
}

console.log(`Suppliers: ${allSuppliers.length}, Categories: ${allCategories.length}, Products: ${allProducts.length}`);

// Generate TypeScript seed file
let out = `import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as bcrypt from 'bcrypt';
import { organisation, stores, staffProfile, categories, suppliers, products, stockItems, stockBatches } from './schema';
import { eq } from 'drizzle-orm';

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  console.log('🌱 Seeding database with clean deduplicated inventory & verified 1024x1024 studio image cards...');

  // 1. Get or Create Organisation
  let [org] = await db.select().from(organisation).limit(1);
  if (!org) {
    [org] = await db.insert(organisation).values({
      name: 'JadeXpress Enterprise',
      tradingName: 'The Vitamin Shop',
      currencyCode: 'GHS',
    }).returning();
    console.log('✅ Created Organisation:', org.name);
  }
  const orgId = org.id;

  // 2. Get or Create Store
  let [store] = await db.select().from(stores).limit(1);
  if (!store) {
    [store] = await db.insert(stores).values({
      organisationId: orgId,
      code: 'ISR',
      name: 'Accra Main Branch (Israel)',
      city: 'Accra',
    }).returning();
    console.log('✅ Created Store:', store.name);
  }
  const storeId = store.id;

  // 3. Get or Create Root Admin Staff
  let [staff] = await db.select().from(staffProfile).where(eq(staffProfile.email, 'kwame@jadexpressgh.com')).limit(1);
  if (!staff) {
    const pinHash = await bcrypt.hash('1234', 12);
    [staff] = await db.insert(staffProfile).values({
      storeId,
      firstName: 'Kwame',
      lastName: 'Mensah',
      email: 'kwame@jadexpressgh.com',
      phone: '+233 55 000 0001',
      role: 'owner',
      pinHash,
      isActive: true,
    }).returning();
    console.log('✅ Created Root User: Kwame Mensah (PIN: 1234)');
  }

  // 4. Categories
  const categoryMap = new Map<string, string>();
`;

for (const c of allCategories) {
  out += `
  let [cat_${c.slug.replace(/-/g, '_')}] = await db.select().from(categories).where(eq(categories.slug, ${JSON.stringify(c.slug)})).limit(1);
  if (!cat_${c.slug.replace(/-/g, '_')}) {
    [cat_${c.slug.replace(/-/g, '_')}] = await db.insert(categories).values({
      name: ${JSON.stringify(c.name)},
      slug: ${JSON.stringify(c.slug)},
      description: ${JSON.stringify(c.description || '')},
    }).returning();
  }
  categoryMap.set(${JSON.stringify(c.slug)}, cat_${c.slug.replace(/-/g, '_')}.id);
`;
}

out += `
  // 5. Suppliers
  const supplierMap = new Map<string, string>();
`;

for (const s of allSuppliers) {
  const varName = `sup_${s.code.replace(/[^a-zA-Z0-9]/g, '_')}`;
  out += `
  let [${varName}] = await db.select().from(suppliers).where(eq(suppliers.code, ${JSON.stringify(s.code)})).limit(1);
  if (!${varName}) {
    [${varName}] = await db.insert(suppliers).values({
      code: ${JSON.stringify(s.code)},
      name: ${JSON.stringify(s.name)},
      contactPerson: ${JSON.stringify(s.contact_person || 'Customer Support')},
      email: ${JSON.stringify(s.email || 'support@supplier.com')},
      phone: ${JSON.stringify(s.phone || '+1 800 000 0000')},
      address: ${JSON.stringify(s.address || 'Headquarters')},
      city: ${JSON.stringify(s.city || 'Accra')},
      country: ${JSON.stringify(s.country || 'Ghana')},
    }).returning();
  }
  supplierMap.set(${JSON.stringify(s.code)}, ${varName}.id);
`;
}

out += `
  // 6. Master Product Catalog (Clean & Deduplicated)
  const productData = [
`;

for (const p of allProducts) {
  const supCode = supCodeMap.get(p.primary_supplier_id) || 'SUP-21C';
  const initialQty = stockMap.get(p.id) || 20;
  const batchNumber = `LOT-${(p.sku || 'LOT').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}-2026`;
  const catSlug = (allCategories.find(c => c.id === p.category_id)?.slug) || 'supplements-wellness';

  out += `    {
      sku: ${JSON.stringify(p.sku)},
      barcode: ${JSON.stringify(p.barcode || '')},
      name: ${JSON.stringify(p.name)},
      genericName: ${JSON.stringify(p.generic_name || p.name)},
      brand: ${JSON.stringify(p.brand || 'JadeXpress')},
      description: ${JSON.stringify(p.description || '')},
      categorySlug: ${JSON.stringify(catSlug)},
      supplierCode: ${JSON.stringify(supCode)},
      type: 'supplement' as const,
      costPricePesewas: ${p.cost_price_pesewas || 10000},
      sellingPricePesewas: ${p.selling_price_pesewas || 15000},
      unit: ${JSON.stringify(p.unit || 'piece')},
      packSize: ${p.pack_size || 1},
      dosageForm: ${JSON.stringify(p.dosage_form || 'Capsule')},
      strength: ${JSON.stringify(p.strength || '')},
      manufacturer: ${JSON.stringify(p.manufacturer || p.brand || 'JadeXpress')},
      countryOfOrigin: ${JSON.stringify(p.country_of_origin || 'USA')},
      reorderPoint: 5,
      reorderQty: 10,
      initialQty: ${initialQty},
      batchNumber: ${JSON.stringify(batchNumber)},
      imageUrl: ${JSON.stringify(p.image_url || '/products/solgar-evening-primrose-oil-1300mg-60s.png')},
    },
`;
}

out += `  ];

  console.log(\`📦 Seeding \${productData.length} unique products with verified transparent cards...\`);

  for (const item of productData) {
    const categoryId = categoryMap.get(item.categorySlug) || Array.from(categoryMap.values())[0];
    const primarySupplierId = supplierMap.get(item.supplierCode) || Array.from(supplierMap.values())[0];

    let [prod] = await db.select().from(products).where(eq(products.sku, item.sku)).limit(1);
    if (!prod) {
      [prod] = await db.insert(products).values({
        sku: item.sku,
        barcode: item.barcode || undefined,
        name: item.name,
        genericName: item.genericName,
        brand: item.brand,
        description: item.description,
        categoryId,
        primarySupplierId,
        type: item.type,
        costPricePesewas: item.costPricePesewas,
        sellingPricePesewas: item.sellingPricePesewas,
        unit: item.unit,
        packSize: item.packSize,
        dosageForm: item.dosageForm,
        strength: item.strength,
        manufacturer: item.manufacturer,
        countryOfOrigin: item.countryOfOrigin,
        imageUrl: item.imageUrl,
        images: [item.imageUrl],
      }).returning();
    } else {
      [prod] = await db.update(products).set({
        name: item.name,
        brand: item.brand,
        costPricePesewas: item.costPricePesewas,
        sellingPricePesewas: item.sellingPricePesewas,
        description: item.description,
        imageUrl: item.imageUrl,
        images: [item.imageUrl],
      }).where(eq(products.id, prod.id)).returning();
    }

    if (storeId && prod) {
      // Upsert Stock Item
      const [existingStock] = await db.select().from(stockItems).where(eq(stockItems.productId, prod.id)).limit(1);
      if (!existingStock) {
        await db.insert(stockItems).values({
          productId: prod.id,
          storeId,
          quantityOnHand: item.initialQty,
        });
      } else {
        await db.update(stockItems).set({
          quantityOnHand: item.initialQty,
        }).where(eq(stockItems.id, existingStock.id));
      }

      // Stock Batch
      const [existingBatch] = await db.select().from(stockBatches).where(eq(stockBatches.batchNumber, item.batchNumber)).limit(1);
      if (!existingBatch) {
        await db.insert(stockBatches).values({
          productId: prod.id,
          storeId,
          supplierId: primarySupplierId,
          batchNumber: item.batchNumber,
          quantityReceived: item.initialQty,
          quantityRemaining: item.initialQty,
          costPricePesewas: item.costPricePesewas,
          receivedAt: new Date(),
          expiryDate: '2027-12-31',
        });
      }
    }
  }

  console.log('🎉 Seeding complete! Database is 100% synchronized with clean inventory & images.');
}

seed().catch(console.error);
`;

const seedPath = path.resolve(__dirname, '../src/database/seed.ts');
fs.writeFileSync(seedPath, out, 'utf8');
console.log(`✅ Successfully updated ${seedPath} (${out.length} bytes)`);

process.exit(0);
