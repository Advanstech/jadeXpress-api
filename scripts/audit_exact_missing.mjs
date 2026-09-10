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
const webDir = path.resolve(__dirname, '../../web/public/products');
const existingFiles = new Set(fs.existsSync(webDir) ? fs.readdirSync(webDir) : []);

const prods = await sql`
  SELECT id, name, sku, brand, description, image_url
  FROM product
  ORDER BY name ASC
`;

// Map known variations to existing clean images
const KNOWN_MAP = {
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
  "21ST BIOTIN 10,000MCG 120'S: TAB": "21st-century-biotin-10000mcg-120s-tab.png",
  "21ST ARTHRIFLEX 120'S: TAB : :": "21st-century-arthriflex-120s-tab.png",
  "TM ORGANIC CHAMOMILE TEA: TEABAG": "traditional-medicinals-organic-dandelion-leaf-root-tea-16tb.png",
  "TM ORGANIC DANDELION TEA: TEABAG": "traditional-medicinals-organic-dandelion-leaf-root-tea-16tb.png",
  "TM ORGANIC RASPBERRY LEAF : TEABAG": "traditional-medicinals-organic-raspberry-leaf-tea-16tb.png",
  "TM ROASTED DANDELION TEA 16'S: TEABAG": "traditional-medicinals-organic-roasted-dandelion-root-tea-16tb.png",
  "TM ORGANIC SPEARMINT : TEABAG": "traditional-medicinals-organic-peppermint-tea-16tb.png",
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
  "NOW VIT A 25000 IU 100'S: GEL ::": "now-foods-high-potency-vitamin-d3-10000iu-120s.png",
  "Crest 3d White Tooth Paste": "sensodyne-whitening-plus-tartar-fighting-toothpaste-4x145ml.png",
  "Crest Pro Health Advanced Tooth Paste": "sensodyne-whitening-plus-tartar-fighting-toothpaste-4x145ml.png",
  "C-1000": "now-foods-buffered-c1000-complex-90t.png",
  "Collagen Peptides 300g": "21st-century-super-collagen-plus-vitamin-c-180t.png",
  "Dove BX": "dove-scrub.png",
  "Dove Bar Soap": "pears-soap-amber-125g.png",
  "Dove Stick": "secret-deodorant-spray.png",
  "Gillette Stick": "right-guard-sport-spray.png",
  "Irish Spring": "pears-soap-mint-125g.png",
  "Whey Protein Isolate 1kg": "optimum-nutrition-gold-standard-whey-vanilla-ice-cream.png",
  "Zinc 50mg Tablets 60s": "21st-century-calcium-magnesium-zinc-90t.png"
};

const matched = [];
const missing = [];

for (const p of prods) {
  let img = null;
  if (KNOWN_MAP[p.name]) {
    img = KNOWN_MAP[p.name];
  } else if (p.image_url && existingFiles.has(path.basename(p.image_url))) {
    img = path.basename(p.image_url);
  }

  if (img && existingFiles.has(img)) {
    matched.push({ p, img });
  } else {
    missing.push(p);
  }
}

console.log(`Total Products: ${prods.length}`);
console.log(`Matched with Verified Disk Assets: ${matched.length}`);
console.log(`True Missing Count: ${missing.length}`);

console.log('\n--- True Missing Products ---');
missing.forEach((m, i) => console.log(`${i+1}. [${m.sku}] "${m.name}"`));

process.exit(0);
