/**
 * One-time backfill: generates public slugs for products missing them so the
 * storefront /product/[slug] pages resolve. Idempotent — skips products that
 * already have a slug.
 *
 * Usage: npx tsx src/scripts/backfill-product-slugs.ts
 */
import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) { console.error('DATABASE_URL is not set'); process.exit(1); }

  const pool = new Pool({ connectionString: dbUrl, max: 3 });

  // Load all existing slugs for uniqueness checks
  const { rows: existingRows } = await pool.query('SELECT slug FROM product WHERE slug IS NOT NULL');
  const used = new Set<string>(existingRows.map((r: any) => r.slug));

  const { rows: missing } = await pool.query(
    'SELECT id, name FROM product WHERE slug IS NULL ORDER BY created_at ASC',
  );

  console.log(`[SLUGS] Found ${missing.length} products without slugs`);

  let updated = 0;
  const skipped: string[] = [];

  for (const p of missing) {
    const base = slugify(p.name) || `product-${p.id.slice(0, 8)}`;
    if (!base) { skipped.push(p.name); continue; }

    let slug = base;
    let counter = 2;
    while (used.has(slug)) {
      slug = `${base}-${counter++}`;
    }
    used.add(slug);

    await pool.query('UPDATE product SET slug = $1, updated_at = now() WHERE id = $2', [slug, p.id]);
    updated++;
    if (updated <= 10) console.log(`[SLUGS] ${updated}/${missing.length} "${p.name}" → ${slug}`);
    else if (updated % 50 === 0) console.log(`[SLUGS] ${updated}/${missing.length}...`);
  }

  console.log(`\n[SLUGS] Done. Updated: ${updated}, Skipped: ${skipped.length}`);
  if (skipped.length > 0) console.log('[SLUGS] Skipped (unslugifiable names):', skipped);
  await pool.end();
  process.exit(0);
}

main().catch((err) => { console.error('[SLUGS] Fatal:', err); process.exit(1); });
