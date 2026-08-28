import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim(),
      v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

const sql = neon(process.env.DATABASE_URL);

const productsDir = path.resolve(__dirname, '../../web/public/products');
const imageFiles = fs.readdirSync(productsDir).filter((f) => /\.(png|jpe?g|webp|svg)$/i.test(f));

console.log(`Found ${imageFiles.length} images in ${productsDir}`);

const prods = await sql`
  SELECT id, name, sku, slug, image_url, brand, generic_name
  FROM product
  ORDER BY name ASC
`;

console.log(`Found ${prods.length} products in database`);

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findBestImage(prod) {
  const normName = normalize(prod.name);
  const normGeneric = normalize(prod.generic_name);
  const normSku = normalize(prod.sku);
  const words = normName.split(' ').filter((w) => w.length > 2);

  // 1. Exact or partial slug match
  const slug = prod.slug || slugify(prod.name);
  const exactSlugMatch = imageFiles.find((img) => {
    const base = path.parse(img).name;
    return base === slug || base.startsWith(slug) || slug.startsWith(base);
  });
  if (exactSlugMatch) return exactSlugMatch;

  // 2. Exact word overlaps
  let bestScore = 0;
  let bestImg = null;

  for (const img of imageFiles) {
    const imgName = normalize(path.parse(img).name);
    const imgWords = imgName.split(' ').filter((w) => w.length > 2);

    let score = 0;
    for (const w of words) {
      if (imgWords.includes(w)) {
        score += 3;
      } else if (imgName.includes(w)) {
        score += 1;
      }
    }

    if (prod.brand && imgName.includes(normalize(prod.brand))) {
      score += 4;
    }

    if (score > bestScore) {
      bestScore = score;
      bestImg = img;
    }
  }

  // Require minimum match score
  if (bestScore >= 4) {
    return bestImg;
  }

  return null;
}

const usedSlugs = new Set();
// Pre-populate with existing non-null slugs from database
for (const p of prods) {
  if (p.slug) usedSlugs.add(p.slug);
}

function getUniqueSlug(prod) {
  if (prod.slug) return prod.slug;
  let baseSlug = slugify(prod.name);
  if (!baseSlug) baseSlug = 'product';
  let candidate = baseSlug;
  let counter = 1;
  while (usedSlugs.has(candidate)) {
    candidate = `${baseSlug}-${counter}`;
    counter++;
  }
  usedSlugs.add(candidate);
  return candidate;
}

let updatedCount = 0;

for (const prod of prods) {
  let matchedImage = null;

  // If already has imageUrl, verify file exists
  if (prod.image_url) {
    const filename = path.basename(prod.image_url);
    if (imageFiles.includes(filename)) {
      matchedImage = filename;
    }
  }

  if (!matchedImage) {
    matchedImage = findBestImage(prod);
  }

  const newSlug = getUniqueSlug(prod);
  const imageUrl = matchedImage ? `/products/${matchedImage}` : prod.image_url;

  await sql`
    UPDATE product
    SET
      slug = ${newSlug},
      image_url = ${imageUrl},
      updated_at = NOW()
    WHERE id = ${prod.id}
  `;
  updatedCount++;
  if (matchedImage) {
    console.log(`✓ [${prod.sku}] ${prod.name} -> ${imageUrl}`);
  }
}

console.log(`\n🎉 Successfully synced ${updatedCount} products with image URLs and unique slugs!`);
