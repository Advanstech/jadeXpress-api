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

const prods = await sql`SELECT id, name, sku, brand, image_url FROM product`;

const assignedImages = new Set();
for (const p of prods) {
  if (p.image_url) {
    assignedImages.add(path.basename(p.image_url));
  }
}

const unassignedImages = imageFiles.filter(img => !assignedImages.has(img));
console.log(`Total images on disk: ${imageFiles.length}`);
console.log(`Assigned images in DB: ${assignedImages.size}`);
console.log(`Unassigned images on disk: ${unassignedImages.length}`);
console.log('\nUnassigned images:');
unassignedImages.forEach((img, i) => console.log(`${i+1}. ${img}`));

process.exit(0);
