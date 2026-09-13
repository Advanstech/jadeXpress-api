import { neon } from '@neondatabase/serverless';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '../.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

const sql = neon(process.env.DATABASE_URL);

async function runQuery(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`⚠️ Query attempt ${i + 1} failed, retrying in 1s...`, err.message);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

console.log('🔄 Refining Crest Pack vs Single Piece Inventory in Neon PostgreSQL...');

const [supPG] = await runQuery(() => sql`SELECT id FROM supplier WHERE code = 'SUP-PG' LIMIT 1`);
const supplierPGId = supPG ? supPG.id : null;

// 1. Crest 3D White Single Piece (Tube)
await runQuery(() => sql`
  UPDATE product SET
    name = 'Crest 3D White Pro Advanced Whitening Toothpaste (Single Tube, 147g)',
    generic_name = 'Crest 3D White Pro Advanced Whitening Toothpaste 1 Piece (5.2 oz / 147 g)',
    barcode = '037000806448',
    description = 'Crest 3D White Pro Advanced Whitening Fluoride Anticavity Toothpaste removes 100% more surface stains and delivers 24-hour stain prevention with twice-daily brushing. Clinically proven whitening ingredients for visibly whiter teeth in 3 days. Single 5.2 oz (147 g) tube piece (also available in 5-pack value bundles).',
    unit = 'tube',
    pack_size = 1,
    dosage_form = 'Toothpaste (Single Tube)',
    strength = 'Pro Advanced Whitening Fluoride',
    manufacturer = 'Procter & Gamble (Crest)',
    country_of_origin = 'USA',
    cost_price_pesewas = 5600,
    selling_price_pesewas = 7500,
    primary_supplier_id = ${supplierPGId || sql`primary_supplier_id`},
    image_url = '/products/crest-3d-white-toothpaste.png'
  WHERE sku = 'CREST3DW-OWHC-QU2E-0'
`);

// 2. Crest Pro-Health Advanced Single Piece (Tube)
await runQuery(() => sql`
  UPDATE product SET
    name = 'Crest Pro-Health Advanced Toothpaste (Single Tube, 167g)',
    generic_name = 'Crest Pro-Health Advanced Deep Clean Mint Toothpaste 1 Piece (5.9 oz / 167 g)',
    barcode = '037000780434',
    description = 'Crest Pro-Health Advanced Fluoride Toothpaste delivers 24-hour antibacterial protection and whole mouth defense with 10 benefits in 1 (cavities, gingivitis, sensitivity, plaque, whitening, fresh breath, anti-bac protection, whole mouth clean, acid erosion defense, and enamel protection). Deep Clean Mint flavor. Single 5.9 oz (167 g) tube piece (also available in 5-pack value bundles).',
    unit = 'tube',
    pack_size = 1,
    dosage_form = 'Toothpaste (Single Tube)',
    strength = '10-in-1 Whole Mouth Defense Fluoride',
    manufacturer = 'Procter & Gamble (Crest)',
    country_of_origin = 'USA',
    cost_price_pesewas = 5600,
    selling_price_pesewas = 7500,
    primary_supplier_id = ${supplierPGId || sql`primary_supplier_id`},
    image_url = '/products/crest-pro-health-advanced-toothpaste.png'
  WHERE sku = 'CRESTPRO-OWHC-3F0N-1'
`);

// 3. Crest 3D White 5-Pack Box
await runQuery(() => sql`
  UPDATE product SET
    name = 'Crest 3D White Pro Advanced Whitening Toothpaste (5-Pack Value Box, 5 x 147g)',
    generic_name = 'Crest 3D White Pro Advanced Whitening Toothpaste 5 Pack (26 oz / 737 g)',
    barcode = '037000806455',
    description = 'Crest 3D White Pro Advanced Whitening Fluoride Anticavity Toothpaste value multipack. Removes 100% more surface stains and provides 24-hour active stain prevention with twice-daily brushing. Value bundle includes 5 individual 5.2 oz (147 g) tubes (Total Net Wt 26 oz / 737 g). Can be inventoried as full multipacks or unbundled into individual tube pieces.',
    unit = 'box',
    pack_size = 5,
    dosage_form = 'Toothpaste (5-Pack Box)',
    strength = 'Pro Advanced Whitening Fluoride',
    manufacturer = 'Procter & Gamble (Crest)',
    country_of_origin = 'USA',
    cost_price_pesewas = 22000,
    selling_price_pesewas = 32000,
    primary_supplier_id = ${supplierPGId || sql`primary_supplier_id`},
    image_url = '/products/crest-3d-white-pro-advanced-whitening-5pack.png'
  WHERE sku = 'CREST3DW-PROADV-5PK'
`);

// 4. Crest Pro-Health Advanced 5-Pack Box
await runQuery(() => sql`
  UPDATE product SET
    name = 'Crest Pro-Health Advanced Toothpaste (5-Pack Value Box, 5 x 167g)',
    generic_name = 'Crest Pro-Health Advanced Deep Clean Mint Toothpaste 5 Pack (29.5 oz / 836 g)',
    barcode = '037000780441',
    description = 'Crest Pro-Health Advanced Fluoride Toothpaste 5-pack value multipack. Delivers 24-hour antibacterial protection and whole mouth defense with 10 benefits in 1: cavities, gingivitis, sensitivity, plaque, whitening, fresh breath, anti-bac protection, whole mouth clean, acid erosion defense, and enamel protection. Deep Clean Mint flavor. Value pack includes 5 individual 5.9 oz (167 g) tubes (Total Net Wt 29.5 oz / 836 g). Can be inventoried as full multipacks or unbundled into individual tube pieces.',
    unit = 'box',
    pack_size = 5,
    dosage_form = 'Toothpaste (5-Pack Box)',
    strength = '10-in-1 Whole Mouth Defense Fluoride',
    manufacturer = 'Procter & Gamble (Crest)',
    country_of_origin = 'USA',
    cost_price_pesewas = 22000,
    selling_price_pesewas = 32000,
    primary_supplier_id = ${supplierPGId || sql`primary_supplier_id`},
    image_url = '/products/crest-pro-health-advanced-5pack.png'
  WHERE sku = 'CRESTPRO-ADV-5PK'
`);

console.log('✅ Successfully updated Crest single piece and multipack inventory models in Neon PostgreSQL!');
