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
const skus = ['21STC100-SP08-JJDL-7', '21STFISH-SQ3J-749X-13', '21STFULL-SQ3J-2JZP-14', '21STGINK-SQ3K-23BN-16', '21STMELA-SQJS-6MLU-21', '21STVITD-SQJT-5PKJ-24', '21STZINC-SQJT-B133-25'];
const rows = await sql`UPDATE product SET image_url=NULL, images='[]'::jsonb, updated_at=NOW() WHERE sku = ANY(${skus}) RETURNING sku, name`;
console.log(JSON.stringify(rows, null, 2));
