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
  { name: 'Vitamins & Minerals',  slug: 'vitamins-minerals' },
  { name: 'Protein & Sports',     slug: 'protein-sports' },
  { name: 'Herbal & Botanicals',  slug: 'herbal-botanicals' },
  { name: 'Omega & Fish Oils',    slug: 'omega-fish-oils' },
  { name: 'Beauty & Skin',        slug: 'beauty-skin' },
  { name: 'Hair Care',            slug: 'hair-care' },
  { name: 'Weight Management',    slug: 'weight-management' },
  { name: 'Digestive Health',     slug: 'digestive-health' },
  { name: 'Immune Support',       slug: 'immune-support' },
  { name: 'Children\'s Health',   slug: 'childrens-health' },
];

for (const cat of prodCats) {
  await sql`
    INSERT INTO category (name, slug, is_active, sort_order)
    VALUES (${cat.name}, ${cat.slug}, true, 0)
    ON CONFLICT (slug) DO NOTHING
  `;
}
console.log(`✓  ${prodCats.length} product categories seeded`);

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

