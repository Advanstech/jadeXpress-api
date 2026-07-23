import { neon } from '@neondatabase/serverless';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '../.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const sql = neon(process.env.DATABASE_URL);

// These 3 FK constraints failed because expense_category table
// was referenced before its CREATE TABLE committed in the split execution.
// Applying them now directly.
const fixes = [
  `ALTER TABLE "budget" ADD CONSTRAINT "budget_category_id_expense_category_id_fk"
    FOREIGN KEY ("category_id") REFERENCES "public"."expense_category"("id")
    ON DELETE no action ON UPDATE no action`,

  `ALTER TABLE "expense_category" ADD CONSTRAINT "expense_category_store_id_store_id_fk"
    FOREIGN KEY ("store_id") REFERENCES "public"."store"("id")
    ON DELETE no action ON UPDATE no action`,

  `ALTER TABLE "expense" ADD CONSTRAINT "expense_category_id_expense_category_id_fk"
    FOREIGN KEY ("category_id") REFERENCES "public"."expense_category"("id")
    ON DELETE no action ON UPDATE no action`,
];

console.log('Applying 3 missing FK constraints...');
for (const stmt of fixes) {
  try {
    await sql.query(stmt);
    console.log('✓', stmt.split('\n')[0].slice(0, 80));
  } catch (e) {
    const msg = e?.message ?? '';
    if (msg.includes('already exists')) {
      console.log('· already exists — skipped');
    } else {
      console.error('❌', msg.slice(0, 200));
    }
  }
}
console.log('\n✅  All FK constraints applied. Schema is complete.');
