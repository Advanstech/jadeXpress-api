import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

neonConfig.webSocketConstructor = ws;
const dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(dirname, '../.env');
const env = fs.readFileSync(envPath, 'utf8');
const dbUrl = env.split('\n').find((l) => l.startsWith('DATABASE_URL=')).split('=')[1].trim();
const pool = new Pool({ connectionString: dbUrl });

async function run() {
  const commonDescription =
    'Sulfur 8 Medicated Original Formula Anti-Dandruff Hair & Scalp Conditioner is a dermatologist-trusted treatment cream designed to control scalp itching and flaking associated with dandruff. Enriched with active sulfur (2%) to treat dandruff, soften dry hair, and moisturize a dry, flaky scalp. Safe for relaxed, pressed, curled, braided, and natural hair textures.';

  const benefits = [
    'Controls dandruff flaking & itching',
    'Moisturizes dry, flaky scalp',
    'Promotes manageable, healthy hair growth',
    'Safe for natural, chemically treated, or braided hair',
  ];

  const tags = ['hair-care', 'anti-dandruff', 'scalp-treatment', 'medicated', 'sulfur8'];

  console.log('Updating Sulfur 8 Treatment Cream (100ml)...');
  const res100 = await pool.query(
    `UPDATE product SET
      brand = $1,
      barcode = $2,
      image_url = $3,
      images = $4::jsonb,
      description = $5,
      short_description = $6,
      dosage_form = $7,
      strength = $8,
      manufacturer = $9,
      country_of_origin = $10,
      storage_instructions = $11,
      usage_instructions = $12,
      ingredients = $13,
      benefits = $14::jsonb,
      tags = $15::jsonb,
      status = 'active',
      updated_at = NOW()
    WHERE id = $16
    RETURNING id, name, sku, barcode, image_url, brand`,
    [
      'Sulfur 8',
      '075610441103',
      '/products/sulfur-8-treatment-cream-100ml.png',
      JSON.stringify(['/products/sulfur-8-treatment-cream-100ml.png']),
      `${commonDescription} 100ml (4 oz).`,
      'Medicated anti-dandruff hair and scalp conditioner cream to eliminate flakes and relieve itching (100ml).',
      'Treatment Cream',
      '2% Precipitated Sulfur',
      'J. Strickland & Co.',
      'USA',
      'Store in a cool, dry place away from direct sunlight.',
      'Apply to the affected area 1-4 times daily, or as directed by a doctor. Part hair and massage gently into scalp.',
      'Active Ingredient: Precipitated Sulfur 2%. Inactive Ingredients: Petrolatum, Mineral Oil, Lanolin, Fragrance, Yellow 11.',
      JSON.stringify(benefits),
      JSON.stringify(tags),
      '9ede0d8c-1907-40ba-b132-52cbc27ec11e',
    ]
  );
  console.log('✅ Updated 100ml:', res100.rows[0]);

  console.log('Updating Sulfur 8 Treatment Cream (200ml)...');
  const res200 = await pool.query(
    `UPDATE product SET
      brand = $1,
      barcode = $2,
      image_url = $3,
      images = $4::jsonb,
      description = $5,
      short_description = $6,
      dosage_form = $7,
      strength = $8,
      manufacturer = $9,
      country_of_origin = $10,
      storage_instructions = $11,
      usage_instructions = $12,
      ingredients = $13,
      benefits = $14::jsonb,
      tags = $15::jsonb,
      status = 'active',
      updated_at = NOW()
    WHERE id = $16
    RETURNING id, name, sku, barcode, image_url, brand`,
    [
      'Sulfur 8',
      '075610442100',
      '/products/sulfur-8-treatment-cream-200ml.png',
      JSON.stringify(['/products/sulfur-8-treatment-cream-200ml.png']),
      `${commonDescription} 200ml (7.25 oz).`,
      'Medicated anti-dandruff hair and scalp conditioner cream to eliminate flakes and relieve itching (200ml).',
      'Treatment Cream',
      '2% Precipitated Sulfur',
      'J. Strickland & Co.',
      'USA',
      'Store in a cool, dry place away from direct sunlight.',
      'Apply to the affected area 1-4 times daily, or as directed by a doctor. Part hair and massage gently into scalp.',
      'Active Ingredient: Precipitated Sulfur 2%. Inactive Ingredients: Petrolatum, Mineral Oil, Lanolin, Fragrance, Yellow 11.',
      JSON.stringify(benefits),
      JSON.stringify(tags),
      '82d0b2f0-95c5-4433-a8ee-19fe93ccce96',
    ]
  );
  console.log('✅ Updated 200ml:', res200.rows[0]);

  // Update other Sulfur 8 products to have proper brand
  await pool.query(
    `UPDATE product SET brand = 'Sulfur 8', tags = $1::jsonb, updated_at = NOW()
     WHERE name ILIKE '%sulfur 8%' AND (brand IS NULL OR brand = '')`,
    [JSON.stringify(['hair-care', 'sulfur8'])]
  );

  console.log('🎉 Successfully updated Sulfur 8 products in Neon database!');
  await pool.end();
}

run().catch((err) => {
  console.error('Error running script:', err);
  process.exit(1);
});
