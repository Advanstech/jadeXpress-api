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

const prods = await sql`SELECT id, name, sku, brand, description, image_url, dosage_form, strength FROM product ORDER BY name ASC`;

console.log(`Total Products in DB: ${prods.length}`);
console.log(`Total Images on Disk: ${imageFiles.length}`);

const hasValidImage = [];
const missingImage = [];

for (const p of prods) {
  if (p.image_url && imageFiles.includes(path.basename(p.image_url))) {
    hasValidImage.push(p);
  } else {
    missingImage.push(p);
  }
}

console.log(`\nProducts WITH valid image on disk: ${hasValidImage.length}`);
console.log(`Products MISSING image on disk: ${missingImage.length}`);

console.log('\n--- Missing Image Products ---');
missingImage.forEach((p, idx) => {
  console.log(`${idx + 1}. [${p.sku}] "${p.name}" (Brand: ${p.brand || 'N/A'}, Form: ${p.dosage_form || 'N/A'}, Strength: ${p.strength || 'N/A'}, ImgURL: ${p.image_url || 'null'})`);
});

process.exit(0);
