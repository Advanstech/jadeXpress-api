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

const prods = await sql`
  SELECT id, name, sku, barcode, brand, generic_name, description, category_id, image_url, cost_price_pesewas, selling_price_pesewas
  FROM product
  ORDER BY name ASC
`;

function normalize(n) {
  return (n || '')
    .toLowerCase()
    .replace(/['":;,\.\(\)\/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

console.log(`Total DB Products: ${prods.length}`);
console.log(`Total Image Files in web/public/products: ${imageFiles.length}`);

// Let's inspect each product's current image_url vs matched image
const results = [];
for (const p of prods) {
  const normName = normalize(p.name);
  const words = normName.split(' ').filter(w => w.length > 2 && !['tab', 'cap', 'gel', 'softgel', 'caps', 'item', 'raw', 'pwd', 'teeth', 'oil'].includes(w));
  
  let currentValid = false;
  if (p.image_url) {
    const fn = path.basename(p.image_url);
    if (imageFiles.includes(fn)) {
      currentValid = true;
    }
  }

  // Find best candidates from image files
  const candidates = [];
  for (const img of imageFiles) {
    const base = path.parse(img).name;
    const imgNorm = normalize(base);
    let score = 0;
    for (const w of words) {
      if (imgNorm.includes(w)) score += 2;
    }
    if (p.brand && imgNorm.includes(normalize(p.brand))) score += 3;
    if (score >= 4) {
      candidates.push({ img, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);

  results.push({
    prod: p,
    currentValid,
    currentImage: p.image_url ? path.basename(p.image_url) : null,
    bestCandidate: candidates[0] ? candidates[0].img : null,
    candidateScore: candidates[0] ? candidates[0].score : 0,
  });
}

const noValidImage = results.filter(r => !r.currentValid);
console.log(`\nProducts without a valid current image on disk: ${noValidImage.length}`);

const canAutoMatch = noValidImage.filter(r => r.candidateScore >= 6);
console.log(`Can automatically match with high confidence (score >= 6): ${canAutoMatch.length}`);
for (const r of canAutoMatch) {
  console.log(` [${r.prod.sku}] "${r.prod.name}" -> ${r.bestCandidate} (score ${r.candidateScore})`);
}

const lowerConfidence = noValidImage.filter(r => r.candidateScore >= 4 && r.candidateScore < 6);
console.log(`\nMedium confidence matches (score 4-5): ${lowerConfidence.length}`);
for (const r of lowerConfidence) {
  console.log(` [${r.prod.sku}] "${r.prod.name}" -> ${r.bestCandidate} (score ${r.candidateScore})`);
}

const completelyUnmatched = noValidImage.filter(r => r.candidateScore < 4);
console.log(`\nCompletely unmatched products: ${completelyUnmatched.length}`);
for (const r of completelyUnmatched) {
  console.log(` [${r.prod.sku}] "${r.prod.name}"`);
}

process.exit(0);
