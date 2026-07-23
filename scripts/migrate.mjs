import { neon } from '@neondatabase/serverless';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually — avoid any dotenv interception
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

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌  DATABASE_URL not set in .env');
  process.exit(1);
}

console.log('🔌  Connecting to Neon...');
const sql = neon(DATABASE_URL);

// Find migration file
const migDir = join(__dirname, '../drizzle/migrations');
const files = (await import('fs')).readdirSync(migDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.error('❌  No migration files found in drizzle/migrations/');
  process.exit(1);
}

const migFile = files[0];
console.log(`📄  Applying migration: ${migFile}`);

const raw = readFileSync(join(migDir, migFile), 'utf8');

// Split: remove breakpoint markers then split on semicolons
const statements = raw
  .replace(/--> statement-breakpoint\n/g, '')
  .split('\n')
  .join(' ')
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 4 && !s.startsWith('--'));

console.log(`⚙️   Found ${statements.length} statements to execute\n`);

let applied = 0;
let skipped = 0;
let failed  = 0;

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  try {
    await sql.query(stmt);
    applied++;
    process.stdout.write('✓ ');
    if ((applied + skipped) % 10 === 0) process.stdout.write('\n');
  } catch (err) {
    const msg = err?.message ?? String(err);
    if (
      msg.includes('already exists') ||
      msg.includes('duplicate key') ||
      msg.includes('multiple primary keys')
    ) {
      skipped++;
      process.stdout.write('· ');
    } else {
      failed++;
      console.error(`\n❌  Statement ${i + 1} failed:`);
      console.error(`   SQL: ${stmt.slice(0, 120)}`);
      console.error(`   ERR: ${msg.slice(0, 200)}\n`);
    }
  }
}

console.log('\n');
console.log('━'.repeat(50));
console.log(`✅  Applied : ${applied}`);
console.log(`⏭️   Skipped : ${skipped} (already existed)`);
if (failed > 0) console.log(`❌  Failed  : ${failed}`);
console.log('━'.repeat(50));

if (failed === 0) {
  console.log('\n🎉  Schema successfully pushed to Neon Postgres!\n');
} else {
  console.log('\n⚠️   Some statements failed — check output above.\n');
  process.exit(1);
}
