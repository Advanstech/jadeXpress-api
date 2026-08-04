import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as bcrypt from 'bcrypt';
import { organisation, stores, staffProfile, categories, suppliers, products, stockItems, stockBatches } from './schema';
import { eq } from 'drizzle-orm';

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  console.log('🌱 Seeding database with fresh inventory data & image URLs...');

  // 1. Get or Create Organisation
  let [org] = await db.select().from(organisation).limit(1);
  if (!org) {
    [org] = await db.insert(organisation).values({
      name: 'JadeXpress Enterprise',
      tradingName: 'The Vitamin Shop',
      currencyCode: 'GHS',
    }).returning();
    console.log('✅ Created Organisation:', org.name);
  }
  const orgId = org.id;

  // 2. Get or Create Store
  let [store] = await db.select().from(stores).limit(1);
  if (!store) {
    [store] = await db.insert(stores).values({
      organisationId: orgId,
      code: 'ISR',
      name: 'Accra Main Branch (Israel)',
      city: 'Accra',
    }).returning();
    console.log('✅ Created Store:', store.name);
  }
  const storeId = store.id;

  // 3. Get or Create Root Admin Staff
  let [staff] = await db.select().from(staffProfile).where(eq(staffProfile.email, 'kwame@jadexpressgh.com')).limit(1);
  if (!staff) {
    const pinHash = await bcrypt.hash('1234', 12);
    [staff] = await db.insert(staffProfile).values({
      storeId,
      firstName: 'Kwame',
      lastName: 'Mensah',
      email: 'kwame@jadexpressgh.com',
      phone: '+233 55 000 0001',
      role: 'owner',
      pinHash,
      isActive: true,
    }).returning();
    console.log('✅ Created Root User: Kwame Mensah (PIN: 1234)');
  }

  // 4. Create Categories
  let [skincareCat] = await db.select().from(categories).where(eq(categories.name, 'Skincare & Lotions')).limit(1);
  if (!skincareCat) {
    [skincareCat] = await db.insert(categories).values({
      name: 'Skincare & Lotions',
      slug: 'skincare-lotions',
      description: 'Dermatologist tested body lotions, creams, and skin barrier treatments',
    }).returning();
  }

  let [wellnessCat] = await db.select().from(categories).where(eq(categories.name, 'Supplements & Wellness')).limit(1);
  if (!wellnessCat) {
    [wellnessCat] = await db.insert(categories).values({
      name: 'Supplements & Wellness',
      slug: 'supplements-wellness',
      description: 'Collagen peptides, vitamins, and dietary protein powders',
    }).returning();
  }

  // 5. Create Suppliers
  let [supAmLactin] = await db.select().from(suppliers).where(eq(suppliers.code, 'SUP-AML')).limit(1);
  if (!supAmLactin) {
    [supAmLactin] = await db.insert(suppliers).values({
      code: 'SUP-AML',
      name: 'AmLactin Health USA',
      contactPerson: 'Sarah Jenkins',
      email: 'orders@amlactin.com',
      phone: '+1 800 315 8762',
      address: '400 Plaza Drive',
      city: 'Secaucus',
      country: 'USA',
    }).returning();
  }

  let [supCetaphil] = await db.select().from(suppliers).where(eq(suppliers.code, 'SUP-CET')).limit(1);
  if (!supCetaphil) {
    [supCetaphil] = await db.insert(suppliers).values({
      code: 'SUP-CET',
      name: 'Galderma Laboratories (Cetaphil)',
      contactPerson: 'Michael Chang',
      email: 'supply@galderma.com',
      phone: '+1 817 961 5000',
      address: '14501 North Freeway',
      city: 'Fort Worth',
      country: 'USA',
    }).returning();
  }

  let [supVital] = await db.select().from(suppliers).where(eq(suppliers.code, 'SUP-VIT')).limit(1);
  if (!supVital) {
    [supVital] = await db.insert(suppliers).values({
      code: 'SUP-VIT',
      name: 'Vital Proteins LLC',
      contactPerson: 'David Ross',
      email: 'b2b@vitalproteins.com',
      phone: '+1 888 314 1690',
      address: '333 N Green St',
      city: 'Chicago',
      country: 'USA',
    }).returning();
  }

  let [supFairhaven] = await db.select().from(suppliers).where(eq(suppliers.code, 'SUP-FHH')).limit(1);
  if (!supFairhaven) {
    [supFairhaven] = await db.insert(suppliers).values({
      code: 'SUP-FHH',
      name: 'Fairhaven Health LLC',
      contactPerson: 'Rebecca Vance',
      email: 'sales@fairhavenhealth.com',
      phone: '+1 888 367 8483',
      address: '1200 Harris Ave',
      city: 'Bellingham',
      country: 'USA',
    }).returning();
  }

  let [supDove] = await db.select().from(suppliers).where(eq(suppliers.code, 'SUP-DOV')).limit(1);
  if (!supDove) {
    [supDove] = await db.insert(suppliers).values({
      code: 'SUP-DOV',
      name: 'Unilever Cosmetics (Dove)',
      contactPerson: 'Claire Bennett',
      email: 'orders@unilever.com',
      phone: '+1 800 598 5005',
      address: '700 Sylvan Ave',
      city: 'Englewood Cliffs',
      country: 'USA',
    }).returning();
  }

  let [supIntimate] = await db.select().from(suppliers).where(eq(suppliers.code, 'SUP-IRO')).limit(1);
  if (!supIntimate) {
    [supIntimate] = await db.insert(suppliers).values({
      code: 'SUP-IRO',
      name: 'Intimate Rose Health',
      contactPerson: 'Dr. Amanda Olson',
      email: 'support@intimaterose.com',
      phone: '+1 888 231 4050',
      address: '100 Main St',
      city: 'Kansas City',
      country: 'USA',
    }).returning();
  }

  // 6. Populate extracted inventory products with image URLs
  const productData = [
    {
      sku: 'AML-DH-20OZ',
      barcode: '307370004206',
      name: 'AmLactin Daily Healing 12% Lactic Acid Lotion',
      genericName: 'Lactic Acid 12% Exfoliating Moisturizer',
      description: 'Dermatologist recommended 12% Lactic Acid Lotion. Softens & smooths dry, rough skin with gentle, no-scrub exfoliation. Fragrance & paraben free.',
      categoryId: skincareCat.id,
      primarySupplierId: supAmLactin.id,
      type: 'beauty' as const,
      costPricePesewas: 18000,
      sellingPricePesewas: 25000,
      unit: 'bottle',
      packSize: 1,
      dosageForm: 'Lotion',
      strength: '12% Lactic Acid',
      manufacturer: 'AmLactin',
      countryOfOrigin: 'USA',
      reorderPoint: 5,
      reorderQty: 10,
      initialQty: 25,
      batchNumber: 'LOT-AML-2026-A',
      imageUrl: '/products/amlactin-lotion.png',
    },
    {
      sku: 'CET-MCU-20OZ',
      barcode: '302993917208',
      name: 'Cetaphil Moisturizing Cream Ultimate Antioxidant',
      genericName: 'Aloe & Vitamin E Barrier Cream',
      description: 'Hydrates for 48 hours and fully restores skin barrier for dry, irritated skin. Formulated with Prebiotic Aloe & Vitamin E. Dermatologist recommended.',
      categoryId: skincareCat.id,
      primarySupplierId: supCetaphil.id,
      type: 'beauty' as const,
      costPricePesewas: 19000,
      sellingPricePesewas: 27000,
      unit: 'tub',
      packSize: 1,
      dosageForm: 'Cream',
      strength: 'Prebiotic Aloe & Vitamin E',
      manufacturer: 'Cetaphil',
      countryOfOrigin: 'USA',
      reorderPoint: 5,
      reorderQty: 10,
      initialQty: 18,
      batchNumber: 'LOT-CET-2026-B',
      imageUrl: '/products/cetaphil-cream.png',
    },
    {
      sku: 'CET-ML-20FL',
      barcode: '302993910209',
      name: 'Cetaphil Moisturizing Lotion (Normal to Dry Skin)',
      genericName: 'Glycerin & Vitamin B3 Lotion',
      description: 'Lightweight lotion hydrates for 48 hours leaving skin soft and smooth. Non-comedogenic, fragrance-free formula with Avocado Oil & Vitamins B3 & B5.',
      categoryId: skincareCat.id,
      primarySupplierId: supCetaphil.id,
      type: 'beauty' as const,
      costPricePesewas: 16000,
      sellingPricePesewas: 23000,
      unit: 'bottle',
      packSize: 1,
      dosageForm: 'Lotion',
      strength: 'Vitamins B3, B5 & E',
      manufacturer: 'Cetaphil',
      countryOfOrigin: 'USA',
      reorderPoint: 5,
      reorderQty: 10,
      initialQty: 30,
      batchNumber: 'LOT-CET-2026-C',
      imageUrl: '/products/cetaphil-lotion.png',
    },
    {
      sku: 'VIT-CP-24OZ',
      barcode: '850502008016',
      name: 'Vital Proteins Collagen Peptides Unflavored',
      genericName: 'Grass-Fed Hydrolyzed Collagen Powder',
      description: 'Grass-fed & pasture-raised unflavored collagen peptides. 20g Collagen Peptides per serving to support hair, skin, nails, joints, and bones.',
      categoryId: wellnessCat.id,
      primarySupplierId: supVital.id,
      type: 'supplement' as const,
      costPricePesewas: 32000,
      sellingPricePesewas: 45000,
      unit: 'canister',
      packSize: 1,
      dosageForm: 'Powder',
      strength: '20g Collagen / serving',
      manufacturer: 'Vital Proteins',
      countryOfOrigin: 'USA',
      reorderPoint: 4,
      reorderQty: 8,
      initialQty: 15,
      batchNumber: 'LOT-VIT-2026-D',
      imageUrl: '/products/vital-collagen.png',
    },
    {
      sku: 'FH-MYO-120CAP',
      barcode: '895749000109',
      name: 'Fairhaven Health Myo-Inositol',
      genericName: 'Myo-Inositol Cycle Health Supplement',
      description: 'Supports cycle regularity and reproductive health. Natural dietary supplement formula for hormone balance and healthy ovulation. 120 capsules.',
      categoryId: wellnessCat.id,
      primarySupplierId: supFairhaven.id,
      type: 'supplement' as const,
      costPricePesewas: 21000,
      sellingPricePesewas: 31000,
      unit: 'bottle',
      packSize: 120,
      dosageForm: 'Capsule',
      strength: 'Myo-Inositol 2000mg',
      manufacturer: 'Fairhaven Health',
      countryOfOrigin: 'USA',
      reorderPoint: 5,
      reorderQty: 10,
      initialQty: 20,
      batchNumber: 'LOT-FHH-2026-E',
      imageUrl: '/products/fairhaven-myo.png',
    },
    {
      sku: 'FH-PQQ-120CAP',
      barcode: '895749000215',
      name: 'Fairhaven Health PQQ+ Myo + D-Chiro Inositol',
      genericName: '40:1 Inositol Blend + PQQ Antioxidants',
      description: 'Advanced support for cycle regularity, healthy ovulation, egg quality, and reproductive health. 40:1 ratio inositol blend plus antioxidants.',
      categoryId: wellnessCat.id,
      primarySupplierId: supFairhaven.id,
      type: 'supplement' as const,
      costPricePesewas: 28000,
      sellingPricePesewas: 40000,
      unit: 'bottle',
      packSize: 120,
      dosageForm: 'Capsule',
      strength: '40:1 Ratio Blend + PQQ',
      manufacturer: 'Fairhaven Health',
      countryOfOrigin: 'USA',
      reorderPoint: 4,
      reorderQty: 8,
      initialQty: 15,
      batchNumber: 'LOT-FHH-2026-F',
      imageUrl: '/products/fairhaven-pqq.png',
    },
    {
      sku: 'DOV-EBS-MAC',
      barcode: '011111002457',
      name: 'Dove Exfoliating Body Scrub Crushed Macadamia',
      genericName: 'Nourishing Exfoliating Body Polish',
      description: 'Exfoliating body scrub with crushed macadamia and rice milk scent. Deeply nourishes for silky smooth skin with whipped texture.',
      categoryId: skincareCat.id,
      primarySupplierId: supDove.id,
      type: 'beauty' as const,
      costPricePesewas: 9000,
      sellingPricePesewas: 14000,
      unit: 'tub',
      packSize: 1,
      dosageForm: 'Scrub',
      strength: 'Macadamia & Rice Milk',
      manufacturer: 'Dove',
      countryOfOrigin: 'USA',
      reorderPoint: 6,
      reorderQty: 12,
      initialQty: 24,
      batchNumber: 'LOT-DOV-2026-G',
      imageUrl: '/products/dove-scrub.png',
    },
    {
      sku: 'IR-FBP-60CAP',
      barcode: '850005470123',
      name: 'Intimate Rose Flora Bloom Probiotics for Women',
      genericName: 'Female Probiotics + Cranberry & D-Mannose',
      description: 'Daily vaginal, digestive, & immune health support. 10 Strains | 15 Billion CFU per serving with Cranberry & D-Mannose for urinary tract wellness.',
      categoryId: wellnessCat.id,
      primarySupplierId: supIntimate.id,
      type: 'supplement' as const,
      costPricePesewas: 24000,
      sellingPricePesewas: 35000,
      unit: 'bottle',
      packSize: 60,
      dosageForm: 'Capsule',
      strength: '15 Billion CFU / 10 Strains',
      manufacturer: 'Intimate Rose',
      countryOfOrigin: 'USA',
      reorderPoint: 5,
      reorderQty: 10,
      initialQty: 20,
      batchNumber: 'LOT-IRO-2026-H',
      imageUrl: '/products/intimate-rose.png',
    },
  ];

  for (const item of productData) {
    let [prod] = await db.select().from(products).where(eq(products.sku, item.sku)).limit(1);
    if (!prod) {
      [prod] = await db.insert(products).values({
        sku: item.sku,
        barcode: item.barcode,
        name: item.name,
        genericName: item.genericName,
        description: item.description,
        categoryId: item.categoryId,
        primarySupplierId: item.primarySupplierId,
        type: item.type,
        costPricePesewas: item.costPricePesewas,
        sellingPricePesewas: item.sellingPricePesewas,
        unit: item.unit,
        packSize: item.packSize,
        dosageForm: item.dosageForm,
        strength: item.strength,
        manufacturer: item.manufacturer,
        countryOfOrigin: item.countryOfOrigin,
        reorderPoint: item.reorderPoint,
        reorderQty: item.reorderQty,
        imageUrl: item.imageUrl,
      }).returning();
    } else {
      [prod] = await db.update(products).set({
        name: item.name,
        costPricePesewas: item.costPricePesewas,
        sellingPricePesewas: item.sellingPricePesewas,
        description: item.description,
        imageUrl: item.imageUrl,
      }).where(eq(products.id, prod.id)).returning();
    }

    if (storeId && prod) {
      // Upsert Stock Item
      const [existingStock] = await db.select().from(stockItems).where(eq(stockItems.productId, prod.id)).limit(1);
      if (!existingStock) {
        await db.insert(stockItems).values({
          productId: prod.id,
          storeId,
          quantityOnHand: item.initialQty,
        });
      } else {
        await db.update(stockItems).set({
          quantityOnHand: item.initialQty,
        }).where(eq(stockItems.id, existingStock.id));
      }

      // Create Stock Batch
      const [existingBatch] = await db.select().from(stockBatches).where(eq(stockBatches.batchNumber, item.batchNumber)).limit(1);
      if (!existingBatch) {
        await db.insert(stockBatches).values({
          productId: prod.id,
          storeId,
          supplierId: item.primarySupplierId,
          batchNumber: item.batchNumber,
          quantityReceived: item.initialQty,
          quantityRemaining: item.initialQty,
          costPricePesewas: item.costPricePesewas,
          receivedAt: new Date(),
          expiryDate: '2027-12-31',
        });
      }

      console.log(`🖼️ Seeded Product with Image (${item.imageUrl}):`, prod.name);
    }
  }

  console.log('🎉 Seeding complete with product image URLs!');
}

seed().catch(console.error);
