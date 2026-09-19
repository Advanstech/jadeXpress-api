// Storefront catalog sync — one-off repair + re-runnable flag setter.
//
//   node scripts/sync-storefront-catalog.mjs          # apply everything
//   node scripts/sync-storefront-catalog.mjs --dry    # preview only
//
// Does three things:
//   1. Assigns a category to active products that have none (name-based rules).
//   2. Sets is_bestseller (top stocked) and is_featured (one per category)
//      so the storefront homepage/shop sections aren't empty.
//   3. Extracts inline base64 image_urls to real files under
//      web/public/products/ and enter_/public/products/, then stores the path.

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

neonConfig.webSocketConstructor = ws;
const dirname = path.dirname(fileURLToPath(import.meta.url));
for (const line of fs.readFileSync(path.resolve(dirname, '../.env'), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.trim().startsWith('#') && !process.env[line.slice(0, i).trim()])
    process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

const DRY = process.argv.includes('--dry');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// First match wins — name heuristics for uncategorized active products.
// Fish oil must come before skincare ("oil" alone would mis-categorize it).
const CATEGORY_RULES = [
  [/fish oil|omega|cod liver|krill/i, 'omega-fish-oils'],
  [/neutrogena|eos\b|bolden|nivea|dove|olay|cerave|aveeno|lotion|cream|scrub|wash|toner|soap|shampoo/i, 'skincare-lotions'],
  [/ginkgo|herbal|botanical|turmeric|moringa|ginseng|echinacea/i, 'herbal-botanicals'],
  [/vitamin|zinc|magnesium|melatonin|collagen|chelated|multivitamin|biotin|iron|calcium|d3|k2|c1000|b12|folic/i, 'vitamins-minerals'],
  [/protein|whey|mass gainer|bcaa|creatine/i, 'protein-sports'],
];
const FALLBACK_CATEGORY = 'supplements-wellness';

const PUBLIC_DIRS = [
  path.resolve(dirname, '../../web/public'),
  path.resolve(dirname, '../../enter_/public'),
];

const client = await pool.connect();
try {
  await client.query('BEGIN');

  // ── 1. Uncategorized products → categories ─────────────────────────────
  const { rows: cats } = await client.query(
    `SELECT id, slug, name FROM category WHERE is_active = true`,
  );
  const catBySlug = new Map(cats.map((c) => [c.slug, c]));

  const { rows: orphans } = await client.query(
    `SELECT id, name FROM product WHERE status = 'active' AND category_id IS NULL ORDER BY name`,
  );
  console.log(`\n== Uncategorized products: ${orphans.length} ==`);
  for (const p of orphans) {
    const rule = CATEGORY_RULES.find(([re]) => re.test(p.name));
    const target = catBySlug.get(rule?.[1] ?? FALLBACK_CATEGORY);
    if (!target) { console.log(`  ! no category for rule on "${p.name}"`); continue; }
    console.log(`  ${p.name}  →  ${target.name}`);
    if (!DRY) {
      await client.query(`UPDATE product SET category_id = $1, updated_at = now() WHERE id = $2`, [target.id, p.id]);
    }
  }

  // ── 2. Inline base64 images → files ────────────────────────────────────
  // Runs before flag selection so converted products become eligible.
  const { rows: b64 } = await client.query(
    `SELECT id, slug, name, image_url FROM product WHERE image_url LIKE 'data:image/%'`,
  );
  console.log(`\n== Inline base64 images: ${b64.length} ==`);
  for (const p of b64) {
    const m = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/s.exec(p.image_url);
    if (!m) { console.log(`  ! unrecognized data-uri on "${p.name}" — skipped`); continue; }
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const filename = `${p.slug || p.id}.${ext}`;
    const relPath = `/products/${filename}`;
    if (!DRY) {
      const buf = Buffer.from(m[2], 'base64');
      for (const dir of PUBLIC_DIRS) {
        const out = path.join(dir, 'products', filename);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, buf);
      }
      await client.query(`UPDATE product SET image_url = $1, updated_at = now() WHERE id = $2`, [relPath, p.id]);
    }
    console.log(`  ${p.name}  →  ${relPath} (${Math.round(m[2].length * 0.75 / 1024)}KB)`);
  }

  // ── 3. Featured / bestseller flags ─────────────────────────────────────
  // Bestseller = deepest stock (proxy until sales data exists — re-run after
  // real sales accumulate and it will still prefer in-stock items).
  const { rows: topStock } = await client.query(`
    SELECT p.id, p.name, COALESCE(SUM(si.quantity_on_hand),0)::int AS qty
    FROM product p
    LEFT JOIN stock_item si ON si.product_id = p.id
    WHERE p.status = 'active'
      AND p.image_url IS NOT NULL AND p.image_url NOT LIKE 'data:%'
      AND p.category_id IS NOT NULL
    GROUP BY p.id
    ORDER BY qty DESC, p.created_at ASC
    LIMIT 12
  `);

  // Featured = one top-stocked product per category for grid variety.
  const { rows: perCat } = await client.query(`
    SELECT DISTINCT ON (p.category_id) p.id, p.name, c.name AS cat,
           COALESCE(SUM(si.quantity_on_hand),0)::int AS qty
    FROM product p
    JOIN category c ON c.id = p.category_id
    LEFT JOIN stock_item si ON si.product_id = p.id
    WHERE p.status = 'active'
      AND p.image_url IS NOT NULL AND p.image_url NOT LIKE 'data:%'
    GROUP BY p.id, p.category_id, c.name
    HAVING COALESCE(SUM(si.quantity_on_hand),0) > 0
    ORDER BY p.category_id, qty DESC
  `);

  const bestsellerIds = topStock.map((r) => r.id);
  const featuredIds = perCat.slice(0, 12).map((r) => r.id);

  console.log(`\n== Flags ==`);
  console.log(`Bestsellers (${bestsellerIds.length}):`);
  topStock.forEach((r) => console.log(`  ${r.qty}×  ${r.name}`));
  console.log(`Featured (${featuredIds.length}):`);
  perCat.slice(0, 12).forEach((r) => console.log(`  ${r.qty}×  ${r.name}  [${r.cat}]`));

  if (!DRY) {
    await client.query(`UPDATE product SET is_bestseller = false, is_featured = false`);
    if (bestsellerIds.length) {
      await client.query(`UPDATE product SET is_bestseller = true WHERE id = ANY($1)`, [bestsellerIds]);
    }
    if (featuredIds.length) {
      await client.query(`UPDATE product SET is_featured = true WHERE id = ANY($1)`, [featuredIds]);
    }
  }

  if (DRY) {
    await client.query('ROLLBACK');
    console.log('\n(dry run — nothing written)');
  } else {
    await client.query('COMMIT');
    console.log('\nDone — committed.');
  }
} catch (err) {
  await client.query('ROLLBACK');
  console.error('Failed — rolled back:', err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
