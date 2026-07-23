/**
 * Creates the expense_categories table (plural name avoids collision with
 * the 'expense_category' Postgres enum type), then adds all 3 missing FKs.
 */
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

const steps = [
  {
    desc: 'Create expense_categories table',
    stmt: `
      CREATE TABLE IF NOT EXISTS "expense_categories" (
        "id"          uuid        PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name"        varchar(150) NOT NULL,
        "store_id"    uuid,
        "system_code" "expense_category",
        "is_active"   boolean     DEFAULT true NOT NULL,
        "created_at"  timestamp with time zone DEFAULT now() NOT NULL
      )
    `,
  },
  {
    desc: 'FK expense_categories → store',
    stmt: `
      ALTER TABLE "expense_categories"
        ADD CONSTRAINT "expense_categories_store_id_store_id_fk"
        FOREIGN KEY ("store_id") REFERENCES "public"."store"("id")
        ON DELETE no action ON UPDATE no action
    `,
  },
  {
    desc: 'FK budget → expense_categories',
    stmt: `
      ALTER TABLE "budget"
        ADD CONSTRAINT "budget_category_id_expense_categories_id_fk"
        FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id")
        ON DELETE no action ON UPDATE no action
    `,
  },
  {
    desc: 'FK expense → expense_categories',
    stmt: `
      ALTER TABLE "expense"
        ADD CONSTRAINT "expense_category_id_expense_categories_id_fk"
        FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id")
        ON DELETE no action ON UPDATE no action
    `,
  },
  {
    desc: 'Index on expense_categories.name',
    stmt: `CREATE INDEX IF NOT EXISTS "expense_categories_name_idx" ON "expense_categories" ("name")`,
  },
];

for (const { desc, stmt } of steps) {
  try {
    await sql.unsafe(stmt.trim());
    console.log(`✓  ${desc}`);
  } catch (e) {
    const msg = e?.message ?? '';
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      console.log(`·  ${desc} — already exists, skipped`);
    } else {
      console.error(`❌  ${desc}`);
      console.error(`   ${msg.slice(0, 200)}`);
    }
  }
}

// Final table count
const tables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' ORDER BY table_name
`;
console.log(`\n📋  Neon now has ${tables.length} tables:`);
tables.forEach(r => console.log('  ', r.table_name));
console.log('\n✅  Done.');
