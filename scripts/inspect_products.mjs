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
const enterProductsDir = path.resolve(__dirname, '../../enter_/public/products');
const webImages = new Set(fs.existsSync(webProductsDir) ? fs.readdirSync(webProductsDir) : []);
const enterImages = new Set(fs.existsSync(enterProductsDir) ? fs.readdirSync(enterProductsDir) : []);

console.log(`Web public images count: ${webImages.size}`);
console.log(`Enter_ public images count: ${enterImages.size}`);

const prods = await sql`
  SELECT id, name, sku, barcode, brand, generic_name, description, category_id, image_url, status, created_at
  FROM product
  ORDER BY name ASC
`;

console.log(`\nTotal products in DB: ${prods.length}`);

// Group by name / normalized name
const nameGroups = {};
for (const p of prods) {
  const norm = p.name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!nameGroups[norm]) nameGroups[norm] = [];
  nameGroups[norm].push(p);
}

const duplicateGroups = Object.entries(nameGroups).filter(([_, list]) => list.length > 1);
console.log(`\nDuplicate product groups by exact/normalized name: ${duplicateGroups.length}`);
for (const [name, list] of duplicateGroups) {
  console.log(` - "${name}" (${list.length} records): IDs: ${list.map(p => p.id).join(', ')} | SKUs: ${list.map(p => p.sku).join(', ')}`);
}

// Check products with missing/invalid image_url
const missingImage = [];
const imageNotFound = [];
const validImage = [];

for (const p of prods) {
  if (!p.image_url) {
    missingImage.push(p);
  } else {
    const filename = path.basename(p.image_url);
    if (webImages.has(filename)) {
      validImage.push({ prod: p, filename });
    } else {
      imageNotFound.push({ prod: p, image_url: p.image_url, filename });
    }
  }
}

console.log(`\nProducts with valid image existing in web/public/products: ${validImage.length}`);
console.log(`Products with missing (null/empty) image_url: ${missingImage.length}`);
console.log(`Products where image_url file is not found on disk: ${imageNotFound.length}`);

if (missingImage.length > 0) {
  console.log('\nSample missing image products:');
  for (const p of missingImage.slice(0, 25)) {
    console.log(` [${p.sku}] "${p.name}" (brand: ${p.brand}, cat: ${p.category_id})`);
  }
}

if (imageNotFound.length > 0) {
  console.log('\nSample image not found products:');
  for (const item of imageNotFound.slice(0, 25)) {
    console.log(` [${item.prod.sku}] "${item.prod.name}" -> ${item.image_url}`);
  }
}
