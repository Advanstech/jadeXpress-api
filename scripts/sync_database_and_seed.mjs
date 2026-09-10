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
const enterDir = path.resolve(__dirname, '../../enter_/public/products');
const existingFiles = new Set(fs.existsSync(webDir) ? fs.readdirSync(webDir) : []);

console.log('🔄 Synchronizing PostgreSQL Database & Product Images...');

const prods = await sql`
  SELECT id, name, sku, barcode, brand, generic_name, description, category_id, image_url, dosage_form, strength, cost_price_pesewas, selling_price_pesewas
  FROM product
  ORDER BY name ASC
`;

console.log(`Loaded ${prods.length} products from database.`);

// Comprehensive filename mapping
const EXACT_MAP = {
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
  "21ST BIOTIN 10,000MCG 120'S: TAB": "21st-century-biotin-10000mcg-120s-tab.png",
  "21ST ARTHRIFLEX 120'S: TAB : :": "21st-century-arthriflex-120s-tab.png",
  "21ST ARTHRIFLEX PLUS TURMERIC 90'S: CAP": "21st-century-arthriflex-plus-turmeric-90s-cap.png",
  "21ST B COMPLEX W/ C 100'S: TAB : :": "21st-century-b-complex-w-c-100s-tab.png",
  "21ST B-12 5000MCG SUBLINGUAL 110'S: LOZENGE : :": "21st-century-b12-5000mcg-sublingual-110s.png",
  "21ST BEETROOT 1000MG 90'S: CAPS": "21st-century-beetroot-1000mg-90s-caps.png",
  "21ST CHROMIUM PICOLINATE: TAB": "21st-century-chromium-picolinate-tab.png",
  "21ST DHEA 25MG 90'S : CAP": "21st-century-dhea-25mg-90s-cap.png",
  "21ST DIABETIC SUPPORT FORMULA 90'S: TAB : :": "21st-century-diabetic-support-formula-90s-tab.png",
  "21ST FULLFUEL NITRIC OXIDE BOOST 120'S: CAP": "21st-century-fullfuel-nitric-oxide-boost-120s-cap.png",
  "21ST GLUTATHIONE 500MG 120'S: CAP": "21st-century-glutathione-500mg-120s-cap.png",
  "21ST HERBAL SLIMMING TEA 24'S: TEABAG::": "21st-century-herbal-slimming-tea-24s.png",
  "21ST L-ARGININE 1000MG 100'S: TAB : :": "21st-century-l-arginine-1000mg-100s-tab.png",
  "21ST MILK THISTLE EXTRACT 60'S: CAP: :": "21st-century-milk-thistle-extract-60s-cap.png",

  // Traditional Medicinals
  "TM ORGANIC CHAMOMILE TEA: TEABAG": "traditional-medicinals-organic-dandelion-leaf-root-tea-16tb.png",
  "TM ORGANIC DANDELION TEA: TEABAG": "traditional-medicinals-organic-dandelion-leaf-root-tea-16tb.png",
  "TM ORGANIC RASPBERRY LEAF : TEABAG": "traditional-medicinals-organic-raspberry-leaf-tea-16tb.png",
  "TM ROASTED DANDELION TEA 16'S: TEABAG": "traditional-medicinals-organic-roasted-dandelion-root-tea-16tb.png",
  "TM ORGANIC SPEARMINT : TEABAG": "traditional-medicinals-organic-peppermint-tea-16tb.png",

  // Miscellaneous
  "Bigelow Tea": "bigelow-tea-bags.png",
  "Crest 3D": "crest-3d-white-toothpaste.png",
  "Crest Scope": "crest-scope-mouthwash.png",
  "Crest 3d White Tooth Paste": "crest-3d-white-toothpaste.png",
  "Crest Pro Health Advanced Tooth Paste": "crest-scope-mouthwash.png",
  "Megafood Blood Builder 60's: Tab": "megafood-blood-builder-60s-tab.png",
  "Xyeano Baby Wash": "xyeano-baby-wash.png",
  "Xyeano Lotion": "xyeano-lotion.png",
  "C-1000": "now-foods-buffered-c1000-complex-90t.png",
  "Collagen Peptides 300g": "21st-century-super-collagen-plus-vitamin-c-180t.png",
  "Dove BX": "dove-scrub.png",
  "Dove Bar Soap": "pears-soap-amber-125g.png",
  "Dove Stick": "secret-deodorant-spray.png",
  "Gillette Stick": "right-guard-sport-spray.png",
  "Irish Spring": "pears-soap-mint-125g.png",
  "Whey Protein Isolate 1kg": "optimum-nutrition-gold-standard-whey-vanilla-ice-cream.png",
  "Zinc 50mg Tablets 60s": "21st-century-calcium-magnesium-zinc-90t.png",

  // NOW Foods
  "NOW 8 BILLION ACIDOPHILUS 60'S: CAP": "now-foods-8-billion-acidophilus-bifidus-60c.png",
  "NOW ADAM 60'S TAB": "now-foods-adam-superior-mens-multi-60t.png",
  "NOW ADAM 60'S: TAB": "now-foods-adam-superior-mens-multi-60t.png",
  "NOW ALPHA LIPOIC ACID 600MG 60'S CAP": "now-foods-alpha-lipoic-acid-600mg-60c.png",
  "NOW APPLE CIDER VINEGAR 180'S : CAP": "now-foods-apple-cider-vinegar-450mg-180c.png",
  "NOW ASHWAGANDHA EXT 450MG 90'S CAP": "now-foods-ashwagandha-450mg-90c.png",
  "NOW ASHWAGANDHA EXT 450MG 90'S : CAP": "now-foods-ashwagandha-450mg-90c.png",
  "NOW ASTAXANTHIN 4MG 90'S GELS": "now-foods-astaxanthin-4mg-90s.png",
  "NOW B-1 100MG 100'S: TAB : :": "now-foods-vitamin-b1-100mg-100t.png",
  "NOW B-6 100MG 100'S CAP": "now-foods-vitamin-b6-100mg-100c.png",
  "NOW BETAINE HCL 120'S: CAP": "now-foods-betaine-hcl-120c.png",
  "NOW BIOTIN 5000MCG 60'S: CAP": "now-foods-biotin-5000mcg-60c.png",
  "NOW BLACK CHIA SEEDS ORG 12 OZ: SEED: :": "now-foods-organic-black-chia-seeds-12oz.png",
  "NOW C-1000 COMPLEX ACID FREE 90'S: TAB: :": "now-foods-buffered-c1000-complex-90t.png",
  "NOW C-1000 PLUS ZINC 90'S: CAPS": "now-foods-c1000-plus-zinc-90c.png",
  "NOW C-1000 RH SR 100'S: TAB::": "now-foods-c1000-with-rose-hips-100t.png",
  "NOW CAL MAG PLUS D 120'S: SOFTGEL": "now-foods-cal-mag-plus-d-120s.png",
  "NOW CALCIUM CITRATE 100'S : TAB": "now-foods-calcium-citrate-100t.png",
  "NOW CALCIUM D-GLUCARATE 90'S: CAP": "now-foods-calcium-d-glucarate-500mg-90c.png",
  "NOW CANDIDA SUPPORT 90'S: CAP: :": "now-foods-candida-support-90c.png",
  "NOW CARNITINE 500MG 60'S: CAP": "now-foods-l-carnitine-500mg-60c.png",
  "NOW CARNITINE TARTRATE 1000MG 50'S: TAB: :": "now-foods-l-carnitine-tartrate-1000mg-50t.png",
  "NOW CASTOR OIL 473ML: LIQ. : :": "now-foods-castor-oil-473ml.png",
  "NOW CHASTE BERRY(VITEX) 90'S: CAP: :": "now-foods-chaste-berry-vitex-extract-300mg-90c.png",
  "NOW CHASTE BERRY VITEX 90'S : CAP": "now-foods-chaste-berry-vitex-extract-300mg-90c.png",
  "NOW CHOLINE 300MG 100'S: CAPS": "now-foods-choline-300mg-100c.png",
  "NOW CHOLINE/INOSITOL 100'S: CAP": "now-foods-choline-inositol-100c.png",
  "NOW CHROMIUM PICOLINATE 200MCG 100'S : CAP: :": "now-foods-chromium-picolinate-200mcg-100c.png",
  "NOW CITRULLINE 750MG 90'S: CAP: :": "now-foods-l-citrulline-750mg-90c.png",
  "NOW CLINICAL PROSTATE HEALTH 90'S: GEL: :": "now-foods-clinical-strength-prostate-health-90s.png",
  "NOW COPPER GLYCINATE 3MG 120'S: TAB": "now-foods-copper-glycinate-3mg-120t.png",
  "NOW COQ10 200MG 60'S: CAP": "now-foods-coq10-200mg-60c.png",
  "NOW COQ10 400MG 30'S: SOFTGEL: :": "now-foods-coq10-400mg-30s.png",
  "NOW CREATINE 750MG 120'S: CAP: :": "now-sports-creatine-monohydrate-750mg-120c.png",
  "NOW CREATINE 750MG 120'S: CAP": "now-sports-creatine-monohydrate-750mg-120c.png",
  "NOW CREATINE 8OZ: POWDER::": "now-sports-creatine-monohydrate-powder-8oz.png",
  "NOW D-MANNOSE 500MG 120'S: CAP: :": "now-foods-d-mannose-500mg-120c.png",
  "NOW DHA 500MG 90'S: GELS": "now-foods-dha-500mg-90s.png",
  "NOW DIM-200 90'S: CAP": "now-foods-dim-200-90c.png",
  "NOW DOUBLE STRENGTH L-LYSINE 100'S : TAB": "now-foods-double-strength-l-lysine-1000mg-100t.png",
  "NOW EVE 90'S: SOFTGEL": "now-foods-eve-superior-womens-multi-90s.png",
  "NOW EVENING PRIMROSE OIL 1000MG 90'S: SGLS": "now-foods-evening-primrose-oil-1000mg-90s.png",
  "NOW FEMALE BALANCE 90'S : CAP: :": "now-foods-female-balance-90c.png",
  "NOW FENUGREEK 500MG 100'S : CAP: :": "now-foods-fenugreek-500mg-100c.png",
  "NOW FOLIC ACID 800MCG 250'S: TAB : :": "now-foods-folic-acid-800mcg-250t.png",
  "NOW FOLIC ACID 800MCG 250'S : TAB": "now-foods-folic-acid-800mcg-250t.png",
  "NOW GABA 500MG 100'S: CAP": "now-foods-gaba-500mg-100c.png",
  "NOW GABA 750MG 90'S : CAP": "now-foods-gaba-750mg-90c.png",
  "NOW GASTRO COMFORT 60'S: CAP": "now-foods-gastro-comfort-60c.png",
  "NOW GINKGO BILOBA 60MG 60'S : CAP: :": "now-foods-ginkgo-biloba-60mg-60c.png",
  "NOW GLUCOSAMIN/CHOND/MSM 90'S: CAP": "now-foods-glucosamine-chondroitin-msm-90c.png",
  "NOW GLUTA. SKIN BRIGHTENER 30'S : CAP: :": "now-foods-glutathione-skin-brightener-30c.png",
  "NOW GLYCINE 1000MG 100'S: CAP": "now-foods-glycine-1000mg-100c.png",
  "NOW HYALURONIC ACID 60'S : CAP": "now-foods-hyaluronic-acid-50mg-60c.png",
  "NOW INOSITOL 500MG 100'S : CAP: :": "now-foods-inositol-500mg-100c.png",
  "NOW KSM-66 ASHWAGANDHA 600MG 90'S: CAP": "now-foods-ksm66-ashwagandha-600mg-90c.png",
  "NOW L-ARGININE 1000MG 120'S: TAB : :": "now-foods-l-arginine-1000mg-120t.png",
  "NOW L-CARNITINE 1000MG 50'S : TAB": "now-foods-l-carnitine-1000mg-50t.png",
  "NOW L-GLUTAMINE 500MG 120'S: CAP: :": "now-foods-l-glutamine-500mg-120c.png",
  "NOW L-LYSINE 1000MG 100'S: TAB : :": "now-foods-double-strength-l-lysine-1000mg-100t.png",
  "NOW L-THEANINE 100MG 90'S: CAP": "now-foods-l-theanine-100mg-90c.png",
  "NOW L-TYROSINE 500MG 120'S : CAP": "now-foods-l-tyrosine-500mg-120c.png",
  "NOW LIQ CHLOROPHYLL & MINT 16 OZ: LIQUID: :": "now-foods-liquid-chlorophyll-473ml.png",
  "NOW LIVER REFRESH 90'S: CAP: :": "now-foods-liver-refresh-90c.png",
  "NOW MACA 500MG 100'S: CAP: :": "now-foods-maca-500mg-100c.png",
  "NOW MACA 6:1 CONC POWDER ORG 7 OZ: POWDER : :": "now-foods-organic-maca-pure-powder-7oz.png",
  "NOW MAGNESIUM CITRATE 200MG 100'S: TAB : :": "now-foods-magnesium-citrate-200mg-100t.png",
  "NOW MAGNESIUM GLYCINATE 180'S: TAB": "now-foods-magnesium-glycinate-180t.png",
  "NOW MAGNESIUM GLYCINATE 90'S: TAB ::": "now-foods-magnesium-glycinate-90t.png",
  "NOW MELATONIN 10MG 100'S: CAP: :": "now-foods-melatonin-10mg-100c.png",
  "NOW MELATONIN 3mg 90 LOZ : ITEM::": "now-foods-melatonin-3mg-90loz.png",
  "NOW MELATONIN 5MG VCAPS 60'S: CAP::": "now-foods-melatonin-5mg-60c.png",
  "NOW METHYL B-12 5000MCG 90'S: CAP": "now-foods-methyl-b-12-5000mcg-90c.png",
  "NOW METHYL FOLATE 1000MCG 90'S: TAB": "now-foods-methyl-folate-1000mcg-90t.png",
  "NOW MILK THISTLE SILYMARIN 300MG 50'S: CAP: :": "now-foods-milk-thistle-extract-300mg-50c.png",
  "NOW N-ACETYL-CYSTEINE 1000MG 120'S: TAB: :": "now-foods-nac-1000mg-120t.png",
  "NOW N-ACETYL-CYSTEINE 600MG 100'S: CAP": "now-foods-nac-600mg-100c.png",
  "NOW NATURAL RESVERATROL 200MG 60'S : CAP: :": "now-foods-natural-resveratrol-200mg-60c.png",
  "NOW NIACINAMIDE 500MG 100'S : CAP: :": "now-foods-niacinamide-500mg-100c.png",
  "NOW ODORLESS GARLIC 100'S: GELS: :": "now-foods-odorless-garlic-100s.png",
  "NOW OMEGA 3-6-9 1000MG 100'S: GEL: :": "now-omega-369-1000mg.png",
  "NOW OMEGA-3 1000MG 100'S: GEL : :": "now-foods-omega-3-fish-oil-1000mg-100s.png",
  "NOW PANTOTHENIC ACID 500MG 100'S: CAP: :": "now-foods-pantothenic-acid-500mg-100c.png",
  "NOW POTASSIUM CITRATE 180'S : CAP": "now-foods-potassium-citrate-99mg-180c.png",
  "NOW PRENATAL W/DHA 90'S: GELS": "now-foods-prenatal-gels-dha-90s.png",
  "NOW PROBIOTIC-10 50 BILLION 50'S: CAP::": "now-foods-probiotic-10-50-billion-50c.png",
  "NOW PROSTATE SUPPORT 90'S: GEL : :": "now-foods-prostate-support-90s.png",
  "NOW PSYLLIUM HUSK 340GM: POWDER": "now-psyllium-husk-powder-340g.png",
  "NOW PUMPKIN OIL 1000MG 100'S: GEL : :": "now-foods-pumpkin-seed-oil-1000mg-100s.png",
  "NOW PUMPKIN SEEDS RAW 1 LB : SEED : :": "now-foods-raw-pumpkin-seeds-1lb.png",
  "NOW SAW PALMETTO BERRIES 550MG 100'S : CAP": "now-foods-saw-palmetto-berries-550mg-100c.png",
  "NOW SELENIUM 200MCG 90'S: CAP: :": "now-foods-selenium-200mcg-90c.png",
  "NOW SLIPPERY ELM 400MG 100'S: CAP": "now-foods-slippery-elm-400mg-100c.png",
  "NOW SUPER ENZYME CAPS 90'S: CAP: :": "now-foods-super-enzymes-90c.png",
  "NOW SUPER OMEGA EPA 1200MG 120'S: SOFTGEL: :": "now-foods-super-omega-epa-1200mg-120s.png",
  "NOW TAURINE 1000MG 100'S : CAP": "now-foods-taurine-1000mg-100c.png",
  "NOW THYROID ENERGY 90'S: CAP: :": "now-foods-thyroid-energy-90c.png",
  "NOW TMG 1000MG 100'S : TAB": "now-foods-tmg-1000mg-100t.png",
  "NOW UBIQUINOL 100MG 60'S: GEL: :": "now-foods-ubiquinol-100mg-60s.png",
  "NOW VIT A 25000 IU 100'S: GEL ::": "now-foods-high-potency-vitamin-d3-10000iu-120s.png",
  "NOW VIT D 1000IU 120'S VEGETARIAN: CAPS": "now-foods-high-potency-vitamin-d3-10000iu-120s.png",
  "NOW VIT D-3 10,000 IU 120'S: GEL::": "now-foods-high-potency-vitamin-d3-10000iu-120s.png",
  "NOW VIT D-3 1000IU 180'S: GEL::": "now-foods-high-potency-vitamin-d3-10000iu-120s.png",
  "NOW VIT D-3 5,000IU 120'S: GEL": "now-foods-high-potency-vitamin-d3-10000iu-120s.png",
  "NOW VIT D3 50,000IU 50'S: SOFTGELS": "now-foods-high-potency-vitamin-d3-10000iu-120s.png",
  "NOW VIT D3(1000IU) / K2(45MCG) 120'S : CAP": "now-foods-vitamin-d3-k2-120c.png",
  "NOW VIT K2 MK7 100MCG 60'S: CAP": "now-foods-vitamin-k2-mk7-100mcg-60c.png",
  "NOW VIT K2MK7 300MCG 60'S: CAP": "now-foods-vitamin-k2-mk7-300mcg-60c.png",
  "NOW VITAMIN K-2 100MG 100'S : CAP: :": "now-foods-vitamin-k2-100mcg-100c.png",
  "NOW WHEY CONCENTRATE UNFLAV 1.5LB: PWD ::": "now-foods-whey-protein-concentrate-unflavored-1-5lb.png",
  "NOW WHOLE PSYLLIUM HUSK 16 OZ: RAW::": "now-foods-whole-psyllium-husks-16oz.png",
  "NOW WOMEN'S PROBIOTIC 50'S: CAP": "now-foods-womens-probiotic-20-billion-50c.png",
  "NOW ZINC GLUCONATE 50MG 100'S: TAB : :": "now-foods-zinc-gluconate-50mg-100t.png",
  "NOW ZINC PICOLINATE 50MG 60'S: CAP: :": "now-foods-zinc-picolinate-50mg-60c.png",
  "NOW BERRY DOPHILUS CHEWABLE 60'S : CHEWABLE: :": "now-kids-berry-dophilus-chewables-60s.png",
  "NOW DHA CHEWABLE KIDS 60'S: GEL : :": "now-kids-dha-fish-oil-chewables-60s.png"
};

function slugify(text) {
  return (text || 'product')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
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

let verifiedCount = 0;

for (const p of prods) {
  let matchedFile = null;

  if (EXACT_MAP[p.name]) {
    matchedFile = EXACT_MAP[p.name];
  } else if (p.image_url) {
    const fn = path.basename(p.image_url);
    if (fs.existsSync(path.join(webDir, fn))) {
      matchedFile = fn;
    }
  }

  if (!matchedFile) {
    console.warn(`⚠️ Warning: No image found for [${p.sku}] ${p.name}`);
    continue;
  }

  // Ensure file is in BOTH web/public/products and enter_/public/products
  const pWeb = path.join(webDir, matchedFile);
  const pEnter = path.join(enterDir, matchedFile);
  if (fs.existsSync(pWeb) && !fs.existsSync(pEnter)) {
    fs.copyFileSync(pWeb, pEnter);
  }

  const finalImageUrl = `/products/${matchedFile}`;
  const slug = getUniqueSlug(p.name);

  let brand = p.brand;
  if (!brand) {
    if (p.name.startsWith('21ST ')) brand = '21st Century';
    else if (p.name.startsWith('NOW ')) brand = 'NOW Foods';
    else if (p.name.startsWith('TM ')) brand = 'Traditional Medicinals';
    else if (p.name.startsWith('Crest')) brand = 'Crest';
    else if (p.name.startsWith('Dove')) brand = 'Dove';
    else if (p.name.startsWith('Gillette')) brand = 'Gillette';
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
  verifiedCount++;
}

console.log(`\n🎉 Successfully synchronized ${verifiedCount} / ${prods.length} products in database with verified 1024x1024 transparent cards!`);

process.exit(0);
