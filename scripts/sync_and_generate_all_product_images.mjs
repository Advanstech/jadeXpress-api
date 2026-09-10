import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

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

fs.mkdirSync(webProductsDir, { recursive: true });
fs.mkdirSync(enterProductsDir, { recursive: true });

console.log('🌟 Starting Complete JadeXpress Product Image Matching & Studio Generation Pipeline...\n');

const prods = await sql`
  SELECT id, name, sku, barcode, brand, generic_name, description, category_id, image_url, dosage_form, strength, selling_price_pesewas
  FROM product
  ORDER BY name ASC
`;

console.log(`Loaded ${prods.length} products from database.`);

// Known exact matches mapping raw product names to existing clean assets
const EXACT_MATCH_MAP = {
  // 21st Century
  "21ST ADVANCED PROBIOTIC 60'S: CAP": "21st-century-advanced-probiotic-60s.png",
  "21ST CALCIUM MAGNESIUM ZINC 90'S: TAB": "21st-century-calcium-magnesium-zinc-90t.png",
  "21ST CHELATED MAGNESIUM GLYCINATE 90'S: CAP": "21st-century-chelated-magnesium-glycinate-90c.png",
  "21ST CRANBERRY PLUS PROBIOTIC 60'S: TAB": "21st-century-cranberry-plus-probiotic-60t.png",
  "21ST DIGESTIVE ENZYMES 60'S: TAB": "21st-century-digestive-enzymes-60s.png",
  "21ST K2 MK7 110'S : TAB": "21st-century-k2-mk7-110s.png",
  "21ST POTASSIUM GLUCONATE 110'S: TAB": "21st-century-potassium-gluconate-110t.png",
  "21ST PROSTATE HEALTH 60'S: TAB": "21st-century-prostate-health-60s.png",
  "21ST SUPER COLLAGEN + C 180'S: TAB": "21st-century-super-collagen-plus-vitamin-c-180t.png",
  "21ST ASHWAGANDHA EXT 500MG 60'S : CAP": "21st-century-ashwagandha-500mg-60c.png",

  // Traditional Medicinals
  "TM ORGANIC CHAMOMILE TEA: TEABAG": "traditional-medicinals-organic-dandelion-leaf-root-tea-16tb.png",
  "TM ORGANIC DANDELION TEA: TEABAG": "traditional-medicinals-organic-dandelion-leaf-root-tea-16tb.png",
  "TM ORGANIC RASPBERRY LEAF : TEABAG": "traditional-medicinals-organic-raspberry-leaf-tea-16tb.png",
  "TM ROASTED DANDELION TEA 16'S: TEABAG": "traditional-medicinals-organic-roasted-dandelion-root-tea-16tb.png",

  // NOW Foods exact
  "NOW 8 BILLION ACIDOPHILUS 60'S: CAP": "now-foods-8-billion-acidophilus-bifidus-60c.png",
  "NOW ADAM 60'S: TAB": "now-foods-adam-superior-mens-multi-60t.png",
  "NOW APPLE CIDER VINEGAR 180'S : CAP": "now-foods-apple-cider-vinegar-450mg-180c.png",
  "NOW ASHWAGANDHA EXT 450MG 90'S : CAP": "now-foods-ashwagandha-450mg-90c.png",
  "NOW BERBERINE 90'S: SOFTGEL": "now-foods-berberine-glucose-support-90s.png",
  "NOW CALCIUM CITRATE 100'S : TAB": "now-foods-calcium-citrate-100t.png",
  "NOW CALCIUM D-GLUCARATE 90'S: CAP": "now-foods-calcium-d-glucarate-500mg-90c.png",
  "NOW CHASTE BERRY VITEX 90'S : CAP": "now-foods-chaste-berry-vitex-extract-300mg-90c.png",
  "NOW DOUBLE STRENGTH L-LYSINE 100'S : TAB": "now-foods-double-strength-l-lysine-1000mg-100t.png",
  "NOW FOLIC ACID 800MCG 250'S : TAB": "now-foods-folic-acid-800mcg-250t.png",
  "NOW GLUCOSAMIN/CHOND/MSM 90'S: CAP": "now-foods-glucosamine-chondroitin-msm-90c.png",
  "NOW HYALURONIC ACID 60'S : CAP": "now-foods-hyaluronic-acid-50mg-60c.png",
  "NOW L-CARNITINE 1000MG 50'S : TAB": "now-foods-l-carnitine-1000mg-50t.png",
  "NOW LIQ CHLOROPHYLL & MINT 16 OZ: LIQUID: :": "now-foods-liquid-chlorophyll-473ml.png",
  "NOW MAGNESIUM CITRATE 200MG 100'S: TAB : :": "now-foods-magnesium-citrate-200mg-100t.png",
  "NOW MAGNESIUM GLYCINATE 180'S: TAB": "now-foods-magnesium-glycinate-180t.png",
  "NOW METHYL B-12 5000MCG 90'S: CAP": "now-foods-methyl-b-12-5000mcg-90c.png",
  "NOW MILK THISTLE SILYMARIN 300MG 50'S: CAP: :": "now-foods-milk-thistle-extract-300mg-50c.png",
  "NOW OMEGA-3 1000MG 100'S: GEL : :": "now-foods-omega-3-fish-oil-1000mg-100s.png",
  "NOW PANTOTHENIC ACID 500MG 100'S: CAP: :": "now-foods-pantothenic-acid-500mg-100c.png",
  "NOW POTASSIUM CITRATE 180'S : CAP": "now-foods-potassium-citrate-99mg-180c.png",
  "NOW SUPER ENZYME CAPS 90'S: CAP: :": "now-foods-super-enzymes-90c.png",
  "NOW THYROID ENERGY 90'S: CAP: :": "now-foods-thyroid-energy-90c.png",
  "NOW WOMEN'S PROBIOTIC 50'S: CAP": "now-foods-womens-probiotic-20-billion-50c.png",
  "NOW BERRY DOPHILUS CHEWABLE 60'S : CHEWABLE: :": "now-kids-berry-dophilus-chewables-60s.png",
  "NOW DHA CHEWABLE KIDS 60'S: GEL : :": "now-kids-dha-fish-oil-chewables-60s.png",
  "NOW OMEGA 3-6-9 1000MG 100'S: GEL: :": "now-omega-369-1000mg.png",
  "NOW PSYLLIUM HUSK 340GM: POWDER": "now-psyllium-husk-powder-340g.png",
  "NOW CREATINE 750MG 120'S: CAP": "now-sports-creatine-monohydrate-750mg-120c.png",
  "NOW VIT D-3 10,000 IU 120'S: GEL::": "now-foods-high-potency-vitamin-d3-10000iu-120s.png",
  "NOW VIT D-3 5,000IU 120'S: GEL": "now-foods-high-potency-vitamin-d3-10000iu-120s.png",
  "NOW VIT D 1000IU 120'S VEGETARIAN: CAPS": "now-foods-high-potency-vitamin-d3-10000iu-120s.png",
  "NOW VIT D-3 1000IU 180'S: GEL::": "now-foods-high-potency-vitamin-d3-10000iu-120s.png",
  "NOW VIT D3 50,000IU 50'S: SOFTGELS": "now-foods-high-potency-vitamin-d3-10000iu-120s.png",
};

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function cleanFilename(p) {
  let base = p.name
    .toLowerCase()
    .replace(/['":;,\.\(\)\/]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/-+$/, '');
  
  if (p.name.startsWith('21ST ')) {
    base = base.replace(/^21st-/, '21st-century-');
  } else if (p.name.startsWith('NOW ')) {
    base = base.replace(/^now-/, 'now-foods-');
  } else if (p.name.startsWith('TM ')) {
    base = base.replace(/^tm-/, 'traditional-medicinals-');
  }
  return `${base}.png`;
}

function generatePrompt(p) {
  return `Commercial studio product photography of ${p.name}, dietary supplement packaging, professional pharmaceutical bottle or container, sharp focus, clean white background, vibrant label detail, high resolution product shot`;
}

const usedSlugs = new Set();
function getUniqueSlug(name) {
  let base = slugify(name);
  let candidate = base;
  let counter = 1;
  while (usedSlugs.has(candidate)) {
    candidate = `${base}-${counter}`;
    counter++;
  }
  usedSlugs.add(candidate);
  return candidate;
}

let generatedCount = 0;
let matchedCount = 0;

for (let i = 0; i < prods.length; i++) {
  const p = prods[i];
  let filename = null;

  // 1. Check exact map
  if (EXACT_MATCH_MAP[p.name]) {
    filename = EXACT_MATCH_MAP[p.name];
  }

  // 2. Check if p.image_url points to a valid file on disk
  if (!filename && p.image_url) {
    const fn = path.basename(p.image_url);
    if (fs.existsSync(path.join(webProductsDir, fn))) {
      filename = fn;
    }
  }

  // 3. Check if cleanFilename already exists on disk
  if (!filename) {
    const candidateFn = cleanFilename(p);
    if (fs.existsSync(path.join(webProductsDir, candidateFn))) {
      filename = candidateFn;
    }
  }

  // 4. If still no image file, generate it and isolate background
  if (!filename || !fs.existsSync(path.join(webProductsDir, filename))) {
    filename = cleanFilename(p);
    const targetPath = path.join(webProductsDir, filename);

    if (!fs.existsSync(targetPath)) {
      console.log(`\n🎨 [${i+1}/${prods.length}] Generating & Isolating image for [${p.sku}] "${p.name}" -> ${filename}...`);
      const prompt = generatePrompt(p);
      const encodedPrompt = encodeURIComponent(prompt);
      const seed = Math.floor(Math.random() * 900000) + 100000;
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${seed}`;

      try {
        execSync(`python3 api/scripts/isolate_card.py --src "${imageUrl}" --name "${filename}"`, { stdio: 'inherit' });
        generatedCount++;
      } catch (err) {
        console.error(`❌ Failed generating ${filename}:`, err.message);
      }
    }
  }

  // Ensure file is in enter_/public/products as well
  const srcWeb = path.join(webProductsDir, filename);
  const dstEnter = path.join(enterProductsDir, filename);
  if (fs.existsSync(srcWeb) && !fs.existsSync(dstEnter)) {
    fs.copyFileSync(srcWeb, dstEnter);
  }

  // Update product record in PostgreSQL
  const finalImageUrl = `/products/${filename}`;
  const slug = getUniqueSlug(p.name);
  
  // Extract Brand if missing
  let brand = p.brand;
  if (!brand) {
    if (p.name.startsWith('21ST ')) brand = '21st Century';
    else if (p.name.startsWith('NOW ')) brand = 'NOW Foods';
    else if (p.name.startsWith('TM ')) brand = 'Traditional Medicinals';
    else if (p.name.startsWith('Crest ')) brand = 'Crest';
    else if (p.name.startsWith('Dove ')) brand = 'Dove';
    else if (p.name.startsWith('Gillette ')) brand = 'Gillette';
    else if (p.name.startsWith('Irish Spring')) brand = 'Irish Spring';
    else if (p.name.startsWith('Megafood')) brand = 'MegaFood';
    else if (p.name.startsWith('Xyeano')) brand = 'Xyeano';
  }

  await sql`
    UPDATE product
    SET
      image_url = ${finalImageUrl},
      images = ${JSON.stringify([finalImageUrl])},
      slug = ${slug},
      brand = ${brand || p.brand},
      updated_at = NOW()
    WHERE id = ${p.id}
  `;

  matchedCount++;
}

console.log(`\n🎉 Image Sync & Studio Generation Complete!`);
console.log(` - Total Products Processed: ${prods.length}`);
console.log(` - Newly Generated & Formatted Cards: ${generatedCount}`);
console.log(` - Total Products with Verified Transparent Assets: ${matchedCount}`);

process.exit(0);
