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

console.log('🧹 Starting JadeXpress Product Deduplication & Test Cleanup...\n');

// 1. Delete test products if any remaining
const testNames = ['RestPOS', 'UberEats', 'Test Product For Po'];
for (const testName of testNames) {
  const testProds = await sql`SELECT id, name, sku FROM product WHERE name ILIKE ${testName}`;
  for (const tp of testProds) {
    console.log(`🗑️ Deleting test product: [${tp.sku}] ${tp.name} (${tp.id})`);
    try { await sql`DELETE FROM stock_movement WHERE product_id = ${tp.id}`; } catch (e) {}
    try { await sql`DELETE FROM stock_batch WHERE product_id = ${tp.id}`; } catch (e) {}
    try { await sql`DELETE FROM stock_item WHERE product_id = ${tp.id}`; } catch (e) {}
    try { await sql`DELETE FROM stock_alert WHERE product_id = ${tp.id}`; } catch (e) {}
    try { await sql`DELETE FROM stock_transfer_item WHERE product_id = ${tp.id}`; } catch (e) {}
    try { await sql`DELETE FROM purchase_item WHERE product_id = ${tp.id}`; } catch (e) {}
    try { await sql`DELETE FROM sale_item WHERE product_id = ${tp.id}`; } catch (e) {}
    try { await sql`DELETE FROM product WHERE id = ${tp.id}`; } catch (e) {}
  }
}

// 2. Fetch all products and stock items
const allProducts = await sql`SELECT * FROM product ORDER BY created_at ASC`;
const allStockItems = await sql`SELECT * FROM stock_item`;

console.log(`Loaded ${allProducts.length} active products from database.`);

const webProductsDir = path.resolve(__dirname, '../../web/public/products');
const imageFiles = new Set(fs.existsSync(webProductsDir) ? fs.readdirSync(webProductsDir) : []);

function normalizeName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/['":;,\.\(\)\/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Group products by normalized name
const groups = new Map();
for (const p of allProducts) {
  const norm = normalizeName(p.name);
  if (!groups.has(norm)) groups.set(norm, []);
  groups.get(norm).push(p);
}

let duplicateGroupsCount = 0;
let mergedProductsCount = 0;
let mergedStockTotal = 0;

for (const [normName, group] of groups.entries()) {
  if (group.length <= 1) continue;

  duplicateGroupsCount++;

  // Score candidates to pick the best primary
  const scored = group.map(p => {
    let score = 0;
    const stock = allStockItems.filter(si => si.product_id === p.id).reduce((sum, si) => sum + (si.quantity_on_hand || 0), 0);
    const hasDiskImage = p.image_url && imageFiles.has(path.basename(p.image_url));
    
    if (hasDiskImage) score += 50;
    if (stock > 0) score += 20;
    if (p.brand) score += 10;
    if (p.barcode) score += 5;
    if (p.description) score += 5;

    return { ...p, stock, score };
  });

  scored.sort((a, b) => b.score - a.score || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const primary = scored[0];
  const duplicates = scored.slice(1);

  console.log(`\n📦 Duplicate Group: "${normName}" -> Keeping Primary [${primary.sku}] ID: ${primary.id}`);

  for (const dup of duplicates) {
    console.log(`  🔀 Merging [${dup.sku}] (ID: ${dup.id})`);

    // 1. Move stock batches to primary
    try { await sql`UPDATE stock_batch SET product_id = ${primary.id} WHERE product_id = ${dup.id}`; } catch(e) {}

    // 2. Move stock movements to primary
    try { await sql`UPDATE stock_movement SET product_id = ${primary.id} WHERE product_id = ${dup.id}`; } catch(e) {}

    // 3. Move other references
    try { await sql`UPDATE purchase_item SET product_id = ${primary.id} WHERE product_id = ${dup.id}`; } catch(e) {}
    try { await sql`UPDATE sale_item SET product_id = ${primary.id} WHERE product_id = ${dup.id}`; } catch(e) {}

    // 4. Merge stock_items
    const dupStockItems = allStockItems.filter(si => si.product_id === dup.id);
    for (const dsi of dupStockItems) {
      const primaryStockItem = allStockItems.find(si => si.product_id === primary.id && si.store_id === dsi.store_id);
      if (primaryStockItem) {
        const newQty = (primaryStockItem.quantity_on_hand || 0) + (dsi.quantity_on_hand || 0);
        await sql`UPDATE stock_item SET quantity_on_hand = ${newQty} WHERE id = ${primaryStockItem.id}`;
        primaryStockItem.quantity_on_hand = newQty;
        mergedStockTotal += (dsi.quantity_on_hand || 0);
        await sql`DELETE FROM stock_item WHERE id = ${dsi.id}`;
      } else {
        await sql`UPDATE stock_item SET product_id = ${primary.id} WHERE id = ${dsi.id}`;
      }
    }

    // 5. Fill missing fields on primary
    if (!primary.primary_supplier_id && dup.primary_supplier_id) {
      await sql`UPDATE product SET primary_supplier_id = ${dup.primary_supplier_id} WHERE id = ${primary.id}`;
      primary.primary_supplier_id = dup.primary_supplier_id;
    }
    if (!primary.brand && dup.brand) {
      await sql`UPDATE product SET brand = ${dup.brand} WHERE id = ${primary.id}`;
      primary.brand = dup.brand;
    }
    if (!primary.category_id && dup.category_id) {
      await sql`UPDATE product SET category_id = ${dup.category_id} WHERE id = ${primary.id}`;
      primary.category_id = dup.category_id;
    }
    if (!primary.barcode && dup.barcode) {
      await sql`UPDATE product SET barcode = ${dup.barcode} WHERE id = ${primary.id}`;
      primary.barcode = dup.barcode;
    }
    if (!primary.description && dup.description) {
      await sql`UPDATE product SET description = ${dup.description} WHERE id = ${primary.id}`;
      primary.description = dup.description;
    }
    if (!primary.image_url && dup.image_url) {
      await sql`UPDATE product SET image_url = ${dup.image_url} WHERE id = ${primary.id}`;
      primary.image_url = dup.image_url;
    }

    // 6. Delete duplicate product
    await sql`DELETE FROM product WHERE id = ${dup.id}`;
    mergedProductsCount++;
  }
}

console.log(`\n🎉 Deduplication complete!`);
console.log(` - Consolidated ${duplicateGroupsCount} duplicate groups.`);
console.log(` - Deleted ${mergedProductsCount} redundant duplicate product records.`);
console.log(` - Merged ${mergedStockTotal} total stock units.`);

const remainingProds = await sql`SELECT count(*)::int as count FROM product`;
console.log(` - Total unique active products in database now: ${remainingProds[0].count}`);

process.exit(0);
