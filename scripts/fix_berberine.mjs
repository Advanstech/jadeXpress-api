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

await sql`
  UPDATE product
  SET
    image_url = '/products/now-foods-berberine-glucose-support-90s.png',
    images = '["/products/now-foods-berberine-glucose-support-90s.png"]'::jsonb,
    brand = 'NOW Foods',
    slug = 'now-foods-berberine-glucose-support-90s',
    updated_at = NOW()
  WHERE sku = 'NOWBERBE-BF8K-JYF3-6'
`;

console.log('✅ Updated Berberine!');
process.exit(0);
