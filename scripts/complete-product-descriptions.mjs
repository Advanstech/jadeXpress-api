import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
for (const line of fs.readFileSync(path.resolve(dirname, '../.env'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.trim().startsWith('#') && !process.env[line.slice(0, i).trim()]) process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const sql = neon(process.env.DATABASE_URL);
const updates = [
  ['21STC100-SP08-JJDL-7', '21st Century Vitamin C 1000 mg with Rose Hips (110 Tablets)', 'Vitamin C 1000 mg tablets with rose hips. Bottle contains 110 tablets.'],
  ['21STDAIL-SQ3H-W7TX-10', '21st Century Daily Greens Superfood Powder (7.4 oz)', 'Daily greens superfood powder in a 7.4 oz container.'],
  ['21STFISH-SQ3J-749X-13', '21st Century Fish Oil 1200 mg (90 Softgels)', 'Fish oil supplement providing 1200 mg per serving. Bottle contains 90 softgels.'],
  ['21STFULL-SQ3J-2JZP-14', '21st Century Full Fuel Creatine Powder (1 lb)', 'Creatine powder in a 1 lb container.'],
  ['21STGINK-SQ3K-23BN-16', '21st Century Ginkgo Biloba Extract (60 Capsules)', 'Ginkgo biloba extract supplement. Bottle contains 60 capsules.'],
  ['21STMAGN-SQJR-XFQC-20', '21st Century Chelated Magnesium Glycinate (90 Capsules)', 'Chelated magnesium glycinate supplement. Bottle contains 90 capsules.'],
  ['21STMELA-SQJS-6MLU-21', '21st Century Melatonin Gummies (120 Gummies)', 'Melatonin dietary supplement. Bottle contains 120 gummies.'],
  ['21STSUPE-SQJT-EA2E-23', '21st Century Super Collagen Plus Vitamin C (180 Tablets)', 'Collagen supplement with vitamin C. Bottle contains 180 tablets.'],
  ['21STVITD-SQJT-5PKJ-24', '21st Century Vitamin D3 + K2 (120 Capsules)', 'Vitamin D3 and K2 dietary supplement. Bottle contains 120 capsules.'],
  ['21STZINC-SQJT-B133-25', '21st Century Chelated Zinc 50 mg (110 Tablets)', 'Chelated zinc supplement providing 50 mg per tablet. Bottle contains 110 tablets.'],
  ['CYSTEXUT-SQJU-AL2P-26', 'Cystex UTI Prebiotic Cranberry Liquid (225 ml)', 'Prebiotic cranberry liquid in a 225 ml bottle.'],
];
for (const [sku, name, description] of updates) {
  await sql`UPDATE product SET name=${name}, description=${description}, short_description=coalesce(short_description, ${description}), updated_at=NOW() WHERE sku=${sku}`;
}
console.log(`Updated ${updates.length} product names and descriptions.`);
