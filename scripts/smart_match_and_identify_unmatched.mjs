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

const prods = await sql`SELECT id, name, sku, barcode, brand, generic_name, description, category_id, image_url, dosage_form, strength FROM product ORDER BY name ASC`;

console.log(`Total active products: ${prods.length}`);
console.log(`Total image files: ${imageFiles.length}`);

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/['":;,\.\(\)\/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanTokens(str) {
  return normalize(str)
    .split(' ')
    .filter(w => w.length > 1 && !['tab', 'cap', 'gel', 'softgel', 'caps', 'item', 'raw', 'pwd', 'loz', 'lozenge', 'teabag', 'liquid', 'the', 'and', 'with', 'for'].includes(w));
}

const matched = [];
const unmatched = [];

for (const p of prods) {
  // If product already has an image_url and file exists, keep it
  if (p.image_url) {
    const existingFile = path.basename(p.image_url);
    if (imageFiles.includes(existingFile)) {
      matched.push({ prod: p, image: existingFile, source: 'existing_valid' });
      continue;
    }
  }

  // Attempt smart match
  let pName = p.name;
  let brandPrefix = '';
  if (pName.startsWith('21ST ')) brandPrefix = '21st-century';
  else if (pName.startsWith('NOW ')) brandPrefix = 'now';
  else if (pName.startsWith('TM ')) brandPrefix = 'traditional-medicinals';
  else if (p.brand) brandPrefix = normalize(p.brand).replace(/\s+/g, '-');

  const pTokens = cleanTokens(pName);

  let bestImg = null;
  let bestScore = 0;

  for (const img of imageFiles) {
    const baseName = path.parse(img).name;
    const imgTokens = cleanTokens(baseName);
    
    let score = 0;
    // Brand bonus
    if (brandPrefix && (baseName.startsWith(brandPrefix) || baseName.includes(brandPrefix))) {
      score += 5;
    }

    // Token matches
    let tokenOverlap = 0;
    for (const t of pTokens) {
      if (imgTokens.includes(t)) {
        score += 3;
        tokenOverlap++;
      } else if (baseName.includes(t)) {
        score += 1;
      }
    }

    // Require high overlap with brand
    if (score > bestScore) {
      bestScore = score;
      bestImg = { img, score, tokenOverlap, baseName };
    }
  }

  // Set match threshold: must have high score and significant token overlap
  if (bestImg && bestScore >= 11 && bestImg.tokenOverlap >= 2) {
    matched.push({ prod: p, image: bestImg.img, source: 'smart_match', score: bestScore });
  } else {
    unmatched.push({ prod: p, bestCandidate: bestImg });
  }
}

console.log(`\nMatched Products: ${matched.length}`);
console.log(`Unmatched Products (Needing Image Creation): ${unmatched.length}`);

console.log('\n--- Sample Smart Matches ---');
matched.filter(m => m.source === 'smart_match').slice(0, 30).forEach(m => {
  console.log(` [${m.prod.sku}] "${m.prod.name}" -> ${m.image} (score ${m.score})`);
});

console.log('\n--- Unmatched Products List ---');
unmatched.forEach((u, i) => {
  console.log(`${i+1}. [${u.prod.sku}] "${u.prod.name}" | Candidate: ${u.bestCandidate?.img} (score ${u.bestCandidate?.score})`);
});

process.exit(0);
