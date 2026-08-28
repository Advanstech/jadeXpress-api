/**
 * Initial seed for JadeXpress POS.
 * Creates: organisation, 2 stores, default expense categories, owner staff account.
 *
 * Run: node scripts/seed.mjs
 * Safe to re-run — uses INSERT ... ON CONFLICT DO NOTHING.
 */
import { neon } from '@neondatabase/serverless';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

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

console.log('🌱  Seeding JadeXpress Neon database…\n');

// ── 1. Organisation ────────────────────────────────────────────────────────
const [org] = await sql`
  INSERT INTO organisation (name, trading_name, currency_code, vat_rate_bps, nhil_rate_bps, getfund_rate_bps)
  VALUES ('JadeXpress Enterprise', 'The Vitamin Shop', 'GHS', 1500, 250, 250)
  ON CONFLICT DO NOTHING
  RETURNING id
`;
const orgRow = org ?? (await sql`SELECT id FROM organisation LIMIT 1`)[0];
const orgId = orgRow.id;
console.log(`✓  Organisation: ${orgId}`);

// ── 2. Stores ─────────────────────────────────────────────────────────────
const stores = [
  { code: 'ISR', name: 'Israel Park (Accra)',  city: 'Accra',  address: 'Israel Park, Accra, Ghana' },
  { code: 'SWT', name: 'Sowutuom (Accra)',     city: 'Accra',  address: 'Sowutuom, Accra, Ghana',   status: 'coming_soon' },
];

const storeIds = {};
for (const s of stores) {
  const [row] = await sql`
    INSERT INTO store (organisation_id, code, name, address, city, status)
    VALUES (${orgId}, ${s.code}, ${s.name}, ${s.address}, ${s.city}, ${s.status ?? 'active'})
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id, code
  `;
  storeIds[row.code] = row.id;
  console.log(`✓  Store [${row.code}]: ${row.id}`);
}

// ── 3. Default expense categories (org-wide, no storeId) ──────────────────
const expCats = [
  { name: 'Rent & Premises',    system_code: 'rent' },
  { name: 'Utilities',          system_code: 'utilities' },
  { name: 'Staff Salaries',     system_code: 'salaries' },
  { name: 'Shop Supplies',      system_code: 'supplies' },
  { name: 'Marketing',          system_code: 'marketing' },
  { name: 'Maintenance',        system_code: 'maintenance' },
  { name: 'Transport',          system_code: 'transport' },
  { name: 'Regulatory & Fees',  system_code: 'regulatory' },
  { name: 'Insurance',          system_code: 'insurance' },
  { name: 'Miscellaneous',      system_code: 'miscellaneous' },
];

for (const cat of expCats) {
  await sql`
    INSERT INTO expense_categories (name, system_code, is_active)
    VALUES (${cat.name}, ${cat.system_code}, true)
    ON CONFLICT DO NOTHING
  `;
}
console.log(`✓  ${expCats.length} expense categories seeded`);

// ── 4. Staff accounts ────────────────────────────────────────────────────────
// Default PIN: 0000 — CHANGE THIS before going live
// bcrypt hash of "0000" with rounds=12 (pre-computed for seed)
const DEFAULT_PIN_HASH = '$2b$12$RTnhoBKZmxQRegXQCK0vVe5gwRVybCewbY6jzdmD61YGJzhPwEcLS'; // bcrypt("0000")
// Password hash of "JadeXpress@2026"
const DEFAULT_PWD_HASH = '$2b$12$DdgsbuVPMj5h8mtQnFynAO7WSrCBv7oYAxKjgaFh53IWp1vs/zKUu'; // bcrypt("JadeXpress@2026")

const primaryStoreId = storeIds['ISR'];

// Realistic Ghanaian names for JadeXpress Israel Park branch.
// Update these with the actual team members when ready — or onboard via the Admin UI.
const staffToSeed = [
  {
    first: 'Abena',   last: 'Asante',    email: 'owner@jadexpressgh.com',
    phone: '+233 24 100 0001', role: 'owner',
  },
  {
    first: 'Kofi',    last: 'Boateng',   email: 'manager@jadexpressgh.com',
    phone: '+233 24 100 0002', role: 'manager',
  },
  {
    first: 'Ama',     last: 'Mensah',    email: 'supervisor@jadexpressgh.com',
    phone: '+233 24 100 0003', role: 'supervisor',
  },
  {
    first: 'Kwame',   last: 'Darko',     email: 'pharmacist@jadexpressgh.com',
    phone: '+233 24 100 0004', role: 'pharmacist',
  },
  {
    first: 'Akosua',  last: 'Owusu',     email: 'cashier@jadexpressgh.com',
    phone: '+233 24 100 0005', role: 'cashier',
  },
  {
    first: 'Nana',    last: 'Amponsah',  email: 'stock@jadexpressgh.com',
    phone: '+233 24 100 0006', role: 'stock_officer',
  },
];

for (const staff of staffToSeed) {
  const [row] = await sql`
    INSERT INTO staff_profile (
      store_id, first_name, last_name, email, phone, role, pin_hash, password_hash, is_active
    )
    VALUES (
      ${primaryStoreId},
      ${staff.first}, ${staff.last},
      ${staff.email},
      ${staff.phone},
      ${staff.role},
      ${DEFAULT_PIN_HASH},
      ${DEFAULT_PWD_HASH},
      true
    )
    ON CONFLICT (email) DO UPDATE
      SET first_name    = EXCLUDED.first_name,
          last_name     = EXCLUDED.last_name,
          phone         = EXCLUDED.phone,
          pin_hash      = EXCLUDED.pin_hash,
          password_hash = EXCLUDED.password_hash
    RETURNING id, email, role, first_name, last_name
  `;
  console.log(`✓  [${staff.role}] ${row.first_name} ${row.last_name} — ${row.email} [${row.id}]`);
}


// ── 5. Default product categories ─────────────────────────────────────────
const prodCats = [
  {
    name: 'Beauty & Skin',
    slug: 'beauty-skin',
    tagline: 'Clean, radiant botanical skincare & complexion essentials',
    description: 'Revitalize your natural glow with dermatologist-approved serums, cleansers, and organic skincare formulas.',
    imageUrl: '/categories/beauty-skin.jpg',
    sortOrder: 1,
  },
  {
    name: 'Children\'s Health',
    slug: 'childrens-health',
    tagline: 'Gentle daily multivitamins & wholesome nutrition for kids',
    description: 'Delicious, pediatrician-approved gummy vitamins, immune boosters, and growth supplements designed specifically for children.',
    imageUrl: '/categories/childrens-health.jpg',
    sortOrder: 2,
  },
  {
    name: 'Digestive Health',
    slug: 'digestive-health',
    tagline: 'Probiotics, soothing enzymes & daily gut balance',
    description: 'Support balanced digestion, reduce bloating, and boost nutrient absorption with high-potency probiotics and herbal digestive blends.',
    imageUrl: '/categories/digestive-health.jpg',
    sortOrder: 3,
  },
  {
    name: 'Hair Care',
    slug: 'hair-care',
    tagline: 'Nourishing oils, scalp care & restorative strengthening treatments',
    description: 'Strengthen, hydrate, and protect hair with biotin-rich therapies, pure Moroccan argan oils, and revitalizing scalp serums.',
    imageUrl: '/categories/hair-care.jpg',
    sortOrder: 4,
  },
  {
    name: 'Herbal & Botanicals',
    slug: 'herbal-botanicals',
    tagline: 'Traditional healing remedies, pure roots & herbal extracts',
    description: 'Harness the timeless power of nature with sustainably sourced African botanicals, moringa, ashwagandha, and pure herbal extracts.',
    imageUrl: '/categories/herbal-botanicals.jpg',
    sortOrder: 5,
  },
  {
    name: 'Immune Support',
    slug: 'immune-support',
    tagline: 'High-potency Vitamin C, Zinc, Elderberry & antioxidant defense',
    description: 'Fortify your body\'s natural defenses year-round with clinical-strength antioxidants, echinacea, and essential immune complexes.',
    imageUrl: '/categories/immune-support.jpg',
    sortOrder: 6,
  },
  {
    name: 'Omega & Fish Oils',
    slug: 'omega-fish-oils',
    tagline: 'Pure, purified EPA & DHA for heart, brain & joint health',
    description: 'Molecularly distilled, burp-free omega-3 fish oils and wild Alaskan salmon oils for cardiovascular and cognitive vitality.',
    imageUrl: '/categories/omega-fish-oils.jpg',
    sortOrder: 7,
  },
  {
    name: 'Protein & Sports',
    slug: 'protein-sports',
    tagline: 'Plant & whey proteins, BCAAs, electrolytes & active performance',
    description: 'Fuel recovery, build lean muscle, and sustain peak endurance with clean protein isolates, creatine, and hydration electrolytes.',
    imageUrl: '/categories/protein-sports.jpg',
    sortOrder: 8,
  },
  {
    name: 'Skincare & Lotions',
    slug: 'skincare-lotions',
    tagline: 'Rich Ghanaian shea butter, ceramide moisturizers & body creams',
    description: 'Deeply hydrate and repair the skin barrier with authentic unrefined shea butter, lactic acid lotions, and dermatologist creams.',
    imageUrl: '/categories/skincare-lotions.jpg',
    sortOrder: 9,
  },
  {
    name: 'Supplements & Wellness',
    slug: 'supplements-wellness',
    tagline: 'Collagen peptides, daily vitality stacks & longevity formulas',
    description: 'Comprehensive daily health support featuring hydrolyzed collagen peptides, adaptogens, and holistic wellness essentials.',
    imageUrl: '/categories/supplements-wellness.jpg',
    sortOrder: 10,
  },
  {
    name: 'Vitamins & Minerals',
    slug: 'vitamins-minerals',
    tagline: 'Essential daily micronutrients, Vitamin D3, Magnesium & Iron',
    description: 'Fill nutritional gaps and sustain daily energy with complete multivitamins, chelated minerals, and high-absorption vitamins.',
    imageUrl: '/categories/vitamins-minerals.jpg',
    sortOrder: 11,
  },
  {
    name: 'Weight Management',
    slug: 'weight-management',
    tagline: 'Natural metabolism support, green tea extracts & fiber blends',
    description: 'Healthy, sustainable weight wellness with appetite-balancing fibers, thermogenic green tea extracts, and clean energy botanicals.',
    imageUrl: '/categories/weight-management.jpg',
    sortOrder: 12,
  },
];

for (const cat of prodCats) {
  await sql`
    INSERT INTO category (name, slug, is_active, sort_order, tagline, description, image_url)
    VALUES (${cat.name}, ${cat.slug}, true, ${cat.sortOrder}, ${cat.tagline}, ${cat.description}, ${cat.imageUrl})
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      tagline = EXCLUDED.tagline,
      description = EXCLUDED.description,
      image_url = EXCLUDED.image_url,
      sort_order = EXCLUDED.sort_order,
      is_active = true
  `;
}
console.log(`✓  ${prodCats.length} product categories seeded & updated with rich image metadata`);

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉  Seed complete!

  Organisation ID : ${orgId}
  Store ISR (live): ${storeIds['ISR']}
  Store SWT (soon): ${storeIds['SWT']}

  Staff seeded (all share PIN 0000):
    Owner      → Abena Asante       (owner@jadexpressgh.com)
    Manager    → Kofi Boateng       (manager@jadexpressgh.com)
    Supervisor → Ama Mensah         (supervisor@jadexpressgh.com)
    Pharmacist → Kwame Darko        (pharmacist@jadexpressgh.com)
    Cashier    → Akosua Owusu       (cashier@jadexpressgh.com)
    Stock Ofcr → Nana Amponsah      (stock@jadexpressgh.com)

  ⚠️  Default PIN: 0000 — update each staff PIN via Admin → Staff → Edit

  Next steps:
  1. npm run start:dev
  2. POST /api/v1/auth/pin-login  { staffId, pin: "0000", storeId }
  3. Open Swagger at http://localhost:3001/docs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

