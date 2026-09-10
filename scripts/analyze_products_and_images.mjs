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

const webProductsDir = path.resolve(__dirname, '../../web/public/products');
const imageFiles = fs.readdirSync(webProductsDir).filter(f => /\.(png|jpe?g|webp|svg)$/i.test(f));
console.log(`Found ${imageFiles.length} images in web/public/products`);

const [prods, stockSummary] = await Promise.all([
  sql`SELECT id, name, sku, barcode, brand, generic_name, description, category_id, image_url, cost_price_pesewas, selling_price_pesewas, created_at FROM product ORDER BY name ASC`,
  sql`SELECT product_id, SUM(quantity_on_hand)::int as total_stock FROM stock_item GROUP BY product_id`
]);

const stockMap = new Map();
for (const s of stockSummary) {
  stockMap.set(s.product_id, Number(s.total_stock) || 0);
}

for (const p of prods) {
  p.total_stock = stockMap.get(p.id) || 0;
}

console.log(`Total products in database: ${prods.length}`);

// Normalization function
function normalizeName(n) {
  return (n || '')
    .toLowerCase()
    .replace(/['":;,\.\(\)\/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 1. Group duplicates
const nameMap = new Map();
for (const p of prods) {
  const norm = normalizeName(p.name);
  if (!nameMap.has(norm)) nameMap.set(norm, []);
  nameMap.get(norm).push(p);
}

let dupCount = 0;
let totalDupProducts = 0;
for (const [norm, list] of nameMap.entries()) {
  if (list.length > 1) {
    dupCount++;
    totalDupProducts += list.length;
  }
}

console.log(`\nDuplicate Groups: ${dupCount} (comprising ${totalDupProducts} total records)`);

// 2. Identify image matching
let matchedCount = 0;
let missingImageProds = [];
let matchedProds = [];

for (const [norm, group] of nameMap.entries()) {
  const withImage = group.filter(p => p.image_url && imageFiles.includes(path.basename(p.image_url)));
  const primary = withImage.length > 0 ? withImage[0] : group.sort((a, b) => Number(b.total_stock) - Number(a.total_stock))[0];

  let matchedImg = null;
  if (primary.image_url && imageFiles.includes(path.basename(primary.image_url))) {
    matchedImg = path.basename(primary.image_url);
  } else {
    // Try word matching
    const nameTokens = norm.split(' ').filter(w => w.length > 2);
    let bestMatch = null;
    let bestScore = 0;
    for (const img of imageFiles) {
      const imgNorm = normalizeName(path.parse(img).name);
      let score = 0;
      for (const token of nameTokens) {
        if (imgNorm.includes(token)) score += 2;
      }
      if (score > bestScore && score >= 4) {
        bestScore = score;
        bestMatch = img;
      }
    }
    if (bestMatch) {
      matchedImg = bestMatch;
    }
  }

  if (matchedImg) {
    matchedCount++;
    matchedProds.push({ prod: primary, image: matchedImg });
  } else {
    missingImageProds.push(primary);
  }
}

console.log(`Unique products after dedup: ${nameMap.size}`);
console.log(`Unique products with existing matching images: ${matchedCount}`);
console.log(`Unique products needing image generation / creation: ${missingImageProds.length}`);

console.log('\n--- Missing Image Products List ---');
missingImageProds.forEach((p, idx) => {
  console.log(`${idx + 1}. [${p.sku}] "${p.name}" (brand: ${p.brand || 'N/A'}, price: ${p.selling_price_pesewas / 100} GHS)`);
});

process.exit(0);
