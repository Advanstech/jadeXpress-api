import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function main() {
  console.log('Fetching all categories...');
  const categories = await sql`SELECT id, name, slug FROM category`;
  const catMap = new Map(categories.map((c) => [c.slug, c]));

  console.log('Categories loaded:', Array.from(catMap.keys()));

  const products = await sql`
    SELECT id, name, brand, category_id, description, generic_name, dosage_form, strength
    FROM product
    ORDER BY name
  `;

  console.log(`Auditing ${products.length} products...`);

  function detectCategorySlug(name, brand) {
    const n = name.toUpperCase();

    // 1. Omega & Fish Oils
    if (n.includes('OMEGA') || n.includes('DHA') || n.includes('FISH OIL') || n.includes('SALMON OIL')) {
      return 'omega-fish-oils';
    }

    // 2. Protein & Sports
    if (
      n.includes('WHEY') ||
      n.includes('CREATINE') ||
      n.includes('NITRIC OXIDE') ||
      n.includes('FULLFUEL') ||
      n.includes('L-ARGININE') ||
      n.includes('L-GLUTAMINE') ||
      n.includes('TAURINE') ||
      n.includes('PROTEIN')
    ) {
      return 'protein-sports';
    }

    // 3. Digestive Health
    if (
      n.includes('PROBIOTIC') ||
      n.includes('SUPER ENZYME') ||
      n.includes('PSYLLIUM') ||
      n.includes('BETAINE') ||
      n.includes('GASTRO COMFORT') ||
      n.includes('SLIPPERY ELM') ||
      n.includes('CRANBERRY PLUS PROBIOTIC')
    ) {
      return 'digestive-health';
    }

    // 4. Weight Management
    if (
      n.includes('SLIMMING') ||
      n.includes('SLIM') ||
      n.includes('WEIGHT') ||
      n.includes('THERMOGENIC') ||
      n.includes('APPETITE')
    ) {
      return 'weight-management';
    }

    // 5. Herbal & Botanicals
    if (
      n.includes('ASHWAGANDHA') ||
      n.includes('MILK THISTLE') ||
      n.includes('SILYMARIN') ||
      n.includes('DANDELION') ||
      n.includes('CHAMOMILE') ||
      n.includes('SPEARMINT') ||
      n.includes('RASPBERRY LEAF') ||
      n.includes('BEETROOT') ||
      n.includes('FENUGREEK') ||
      n.includes('GINKGO') ||
      n.includes('SAW PALMETTO') ||
      n.includes('MACA') ||
      n.includes('PUMPKIN SEED') ||
      n.includes('CHLOROPHYLL') ||
      n.includes('TM ORGANIC') ||
      n.includes('TEABAG')
    ) {
      return 'herbal-botanicals';
    }

    // 6. Immune Support
    if (
      n.includes('ODORLESS GARLIC') ||
      n.includes('ELDERBERRY') ||
      n.includes('ECHINACEA') ||
      n.includes('IMMUNE') ||
      n.includes('ASTRAGALUS')
    ) {
      return 'immune-support';
    }

    // 7. Beauty & Skin (oral beauty & oral care)
    if (
      n.includes('TOOTH PASTE') ||
      n.includes('CREST') ||
      n.includes('GLUTATHIONE') ||
      n.includes('SKIN BRIGHTENER')
    ) {
      return 'beauty-skin';
    }

    // 8. Skincare & Lotions (topical creams, oils, washes)
    if (
      n.includes('LOTION') ||
      n.includes('MOISTURIZER') ||
      n.includes('BODY WASH') ||
      n.includes('VASELINE OIL') ||
      n.includes('BABY WASH') ||
      n.includes('CREAM') ||
      n.includes('SHEA')
    ) {
      return 'skincare-lotions';
    }

    // 9. Hair Care
    if (
      n.includes('SHAMPOO') ||
      n.includes('CONDITIONER') ||
      n.includes('SCALP') ||
      n.includes('HAIR')
    ) {
      return 'hair-care';
    }

    // 10. Vitamins & Minerals
    if (
      n.includes('VIT ') ||
      n.includes('VITAMIN') ||
      n.includes('B-1 ') ||
      n.includes('B-6') ||
      n.includes('B-12') ||
      n.includes('B COMPLEX') ||
      n.includes('BIOTIN') ||
      n.includes('FOLIC ACID') ||
      n.includes('METHYL FOLATE') ||
      n.includes('METHYL B-12') ||
      n.includes('C-1000') ||
      n.includes('ZINC') ||
      n.includes('SELENIUM') ||
      n.includes('CHROMIUM') ||
      n.includes('MAGNESIUM') ||
      n.includes('ADAM ') ||
      n.includes('EVE ') ||
      n.includes('PRENATAL') ||
      n.includes('CALCIUM') ||
      n.includes('IRON')
    ) {
      return 'vitamins-minerals';
    }

    // Default to Supplements & Wellness
    return 'supplements-wellness';
  }

  function generateWelcomingDescription(p, categoryName) {
    const brand = p.brand ? `${p.brand} ` : '';
    const cleanName = p.name.replace(/:+/g, ' ').replace(/\s+/g, ' ').trim();

    return `${cleanName} by ${brand || 'JadeXpress'} delivers premium-grade, clinically tested nutritional excellence to support your daily wellness regimen. Expertly formulated within our ${categoryName} collection, each dose provides targeted physiological support, superior bioavailability, and pure botanical integrity. Guaranteed authentic, fresh, and temperature-controlled for delivery across Ghana and worldwide.`;
  }

  let updatedCount = 0;

  for (const p of products) {
    let needsUpdate = false;
    let targetCatId = p.category_id;
    let targetDesc = p.description;

    if (!targetCatId) {
      const slug = detectCategorySlug(p.name, p.brand);
      const cat = catMap.get(slug) || catMap.get('supplements-wellness');
      if (cat) {
        targetCatId = cat.id;
        needsUpdate = true;
      }
    }

    if (!targetDesc || targetDesc.trim() === '') {
      let catName = 'Supplements & Wellness';
      for (const [s, c] of catMap.entries()) {
        if (c.id === targetCatId) {
          catName = c.name;
          break;
        }
      }
      targetDesc = generateWelcomingDescription(p, catName);
      needsUpdate = true;
    }

    if (needsUpdate) {
      await sql`
        UPDATE product
        SET category_id = ${targetCatId},
            description = ${targetDesc},
            updated_at = NOW()
        WHERE id = ${p.id}
      `;
      updatedCount++;
      if (updatedCount % 20 === 0 || updatedCount === 1) {
        console.log(`[${updatedCount}] Updated ${p.name}`);
      }
    }
  }

  console.log(`\nSuccessfully updated ${updatedCount} products with complete categories and welcoming descriptions.`);

  // Verify
  const [nullCats] = await sql`SELECT count(*) FROM product WHERE category_id IS NULL`;
  const [emptyDesc] = await sql`SELECT count(*) FROM product WHERE description IS NULL OR description = ''`;
  console.log('Post-run check:');
  console.log('Products with NULL category_id:', nullCats.count);
  console.log('Products with NULL/empty description:', emptyDesc.count);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
