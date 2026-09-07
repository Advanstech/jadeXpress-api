/**
 * One-time cleanup script: compresses oversized base64 images stored in the
 * product table's image_url column. Uses sharp to resize to max 600px and
 * re-encode as JPEG quality 85.
 *
 * If Cloudinary env vars are set, uploads to Cloudinary and stores the CDN URL.
 * Otherwise, stores the compressed base64 data URL (still much smaller than original).
 *
 * Usage: npx tsx src/scripts/compress-product-images.ts
 */
import 'dotenv/config';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../database/schema';
import { eq, sql, isNotNull } from 'drizzle-orm';
import { products } from '../database/schema/inventory';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';

const MAX_DIM = 600;
const BATCH_SIZE = 50;

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  // Cloudinary setup
  let cloudinaryConfigured = false;
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    cloudinaryConfigured = true;
    console.log('[CLEANUP] Cloudinary configured — will upload compressed images to CDN');
  } else {
    console.log('[CLEANUP] Cloudinary not configured — will store compressed base64 in DB');
  }

  const pool = new Pool({ connectionString: dbUrl, max: 5 });
  const db = drizzle(pool, { schema }) as any;

  // Find all products with base64 data URLs in image_url
  const rows = await db
    .select({ id: products.id, name: products.name, imageUrl: products.imageUrl })
    .from(products)
    .where(sql`${products.imageUrl} LIKE 'data:image%'`);

  console.log(`[CLEANUP] Found ${rows.length} products with base64 images to compress`);

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const dataUrl = row.imageUrl as string;
      if (!dataUrl || !dataUrl.startsWith('data:image')) {
        skipped++;
        continue;
      }

      // Extract base64 from data URL
      const parts = dataUrl.split(';base64,');
      if (parts.length !== 2) {
        skipped++;
        continue;
      }

      const rawBase64 = parts[1];
      const buffer = Buffer.from(rawBase64, 'base64');

      // Compress with sharp
      const compressed = await sharp(buffer)
        .resize(MAX_DIM, MAX_DIM, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      let newUrl: string;

      if (cloudinaryConfigured) {
        try {
          const result = await cloudinary.uploader.upload(
            `data:image/jpeg;base64,${compressed.toString('base64')}`,
            {
              folder: 'jadexpress/products',
              resource_type: 'image',
              transformation: [{ quality: 'auto', fetch_format: 'auto' }],
            },
          );
          newUrl = result.secure_url;
        } catch (err: any) {
          console.warn(`[CLEANUP] Cloudinary upload failed for "${row.name}", using compressed base64:`, err?.message);
          newUrl = `data:image/jpeg;base64,${compressed.toString('base64')}`;
        }
      } else {
        newUrl = `data:image/jpeg;base64,${compressed.toString('base64')}`;
      }

      const oldSizeKB = Math.round(dataUrl.length / 1024);
      const newSizeKB = Math.round(newUrl.length / 1024);
      const reduction = Math.round((1 - newSizeKB / oldSizeKB) * 100);

      await db
        .update(products)
        .set({ imageUrl: newUrl, updatedAt: new Date() })
        .where(eq(products.id, row.id));

      processed++;
      console.log(`[CLEANUP] ${processed}/${rows.length} "${row.name}" — ${oldSizeKB}KB → ${newSizeKB}KB (${reduction}% smaller)`);
    } catch (err: any) {
      failed++;
      console.error(`[CLEANUP] Failed for "${row.name}":`, err?.message);
    }
  }

  console.log(`\n[CLEANUP] Done! Processed: ${processed}, Skipped: ${skipped}, Failed: ${failed}`);
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('[CLEANUP] Fatal error:', err);
  process.exit(1);
});
