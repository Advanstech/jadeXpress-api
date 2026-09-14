import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

neonConfig.webSocketConstructor = ws;
const dirname = path.dirname(fileURLToPath(import.meta.url));
for (const line of fs.readFileSync(path.resolve(dirname, '../.env'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.trim().startsWith('#') && !process.env[line.slice(0, i).trim()]) process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// All Crest products
const { rows } = await pool.query(
  `SELECT id, sku, name, barcode, image_url, brand, unit, pack_size, created_at
   FROM product WHERE name ILIKE '%crest%' OR sku ILIKE '%crest%' ORDER BY created_at DESC, name`
);
console.log(JSON.stringify(rows, null, 1));
await pool.end();
