import { neon } from '@neondatabase/serverless';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '../.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

const sql = neon(process.env.DATABASE_URL);

async function runQuery(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`⚠️ Query attempt ${i + 1} failed, retrying in 1s...`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

console.log('🌱 Seeding Extracted Products Set 18 (5 Items)...');

const stores = await runQuery(() => sql`SELECT id FROM store WHERE code = 'ISR' LIMIT 1`);
if (!stores.length) {
    console.error('No store found.');
    process.exit(1);
}
const storeId = stores[0].id;

// Suppliers
const [sup21C] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-21C', '21st Century HealthCare Inc', 'Customer Care', 'support@21stcenturyvitamins.com', '+1 800 123 4567', '2119 S Wilson St', 'Tempe', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplier21CId = sup21C.id;

const [supNBT] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-NBT', 'Nature''s Bounty LLC', 'Sales Care', 'orders@naturesbounty.com', '+1 800 433 2990', '110 Orville Dr', 'Bohemia', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierNBTId = supNBT.id;

const [supACW] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-ACW', 'Acwell Korea', 'Export Sales', 'info@acwell.co.kr', '+82 2 1234 5678', 'Gangnam-gu', 'Seoul', 'South Korea')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierACWId = supACW.id;

const [supADC] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-ADC', 'Advanced Clinicals LLC', 'B2B Sales', 'orders@advancedclinicals.com', '+1 800 456 7890', '730 W Lake St', 'Chicago', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierADCId = supADC.id;

const [supAML] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-AML', 'AmLactin Health USA', 'Sarah Jenkins', 'orders@amlactin.com', '+1 800 315 8762', '400 Plaza Drive', 'Secaucus', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierAMLId = supAML.id;

const [supANU] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-ANU', 'Anua Skincare Korea', 'Global Distribution', 'contact@anua.kr', '+82 2 9876 5432', 'Seongdong-gu', 'Seoul', 'South Korea')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierANUId = supANU.id;

const [supAVE] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-AVE', 'Johnson & Johnson (Aveeno)', 'Supply Chain', 'orders@jnj.com', '+1 800 222 1222', '1 Johnson & Johnson Plaza', 'New Brunswick', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierAVEId = supAVE.id;

const [supBAL] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-BAL', 'Balance Active Formula UK', 'Export Manager', 'orders@balanceactive.co.uk', '+44 20 7946 0912', '100 Thames St', 'London', 'UK')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierBALId = supBAL.id;

const [supSUN] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-SUN', 'Sunny Isle Hair Care USA', 'Sales Desk', 'orders@sunnyisle.com', '+1 800 786 6947', '500 International Pkwy', 'Sunrise', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierSUNId = supSUN.id;

const [supSK1] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-SK1', 'Skin1004 Korea', 'Global Distribution', 'contact@skin1004.com', '+82 2 555 0199', 'Mapo-gu', 'Seoul', 'South Korea')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierSK1Id = supSK1.id;

const [supCER] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-CER', 'L''Oréal USA (CeraVe)', 'B2B Sales', 'orders@cerave.com', '+1 888 768 2915', '10 Hudson Yards', 'New York', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierCERId = supCER.id;

const [supCLG] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-CLG', 'Cliganic Organic Beauty USA', 'Sales Desk', 'support@cliganic.com', '+1 833 254 4264', '980 N Federal Hwy', 'Boca Raton', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierCLGId = supCLG.id;

const [supCET] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-CET', 'Galderma Laboratories (Cetaphil)', 'Michael Chang', 'supply@galderma.com', '+1 817 961 5000', '14501 North Freeway', 'Fort Worth', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierCETId = supCET.id;

const [supCYS] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-CYS', 'Bridges Consumer Healthcare (Cystex)', 'Orders Dept', 'support@cystex.com', '+1 800 214 2379', '100 Heritage Pkwy', 'Chattanooga', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierCYSId = supCYS.id;

const [supTRM] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-TRM', 'Traditional Medicinals Inc', 'Sales & Distribution', 'orders@traditionalmedicinals.com', '+1 800 543 4372', '1400 Sebastopol Rd', 'Sebastopol', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierTRMId = supTRM.id;

const [supDIF] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-DIF', 'Galderma Laboratories (Differin)', 'Rx & OTC Sales', 'info@differin.com', '+1 866 735 4137', '14501 North Freeway', 'Fort Worth', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierDIFId = supDIF.id;

const [supDRB] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-DRB', 'Dr. Berg Nutritionals USA', 'Support Desk', 'orders@drberg.com', '+1 703 354 7336', '4580 Auto Bank Rd', 'Alexandria', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierDRBId = supDRB.id;

const [supDRA] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-DRA', 'Dr. Althea Skincare Korea', 'Global Desk', 'contact@althea.kr', '+82 2 334 0912', 'Mapo-gu', 'Seoul', 'South Korea')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierDRAId = supDRA.id;

const [supEOS] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-EOS', 'eos Products LLC USA', 'Sales Desk', 'orders@evolutionofsmooth.com', '+1 866 547 4367', '19 W 44th St', 'New York', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierEOSId = supEOS.id;

const [supFFC] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-FFC', 'Face Facts UK Beauty', 'Export Desk', 'sales@facefacts.co.uk', '+44 161 832 9900', '100 Albert St', 'Manchester', 'UK')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierFFCId = supFFC.id;

const [supFNL] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-FNL', 'Fit&Lean Sports Nutrition (MHP)', 'Sales Dept', 'orders@fitandlean.com', '+1 888 783 8823', '210 Lackawanna Ave', 'West Paterson', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierFNLId = supFNL.id;

const [supINR] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-INR', 'Intimate Rose Health USA', 'Dr. Amanda Olson', 'support@intimaterose.com', '+1 888 231 4050', '100 Main St', 'Kansas City', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierINRId = supINR.id;

const [supGAR] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-GAR', 'L''Oréal USA (Garnier)', 'B2B Sales', 'orders@garnier.com', '+1 800 370 1925', '10 Hudson Yards', 'New York', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierGARId = supGAR.id;

const [supGOL] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-GOL', 'Goli Nutrition Inc USA', 'Sales Desk', 'orders@goli.com', '+1 888 345 4654', '8430 West Sunset Blvd', 'West Hollywood', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierGOLId = supGOL.id;

const [supVIT] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-VIT', 'Vitabiotics Ltd UK', 'Export Desk', 'orders@vitabiotics.com', '+44 20 8955 2600', '1 Keswick Rd', 'London', 'UK')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierVITId = supVIT.id;

const [supGDM] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-GDM', 'Good Molecules USA', 'Customer Desk', 'support@goodmolecules.com', '+1 833 369 4663', '350 5th Ave', 'New York', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierGDMId = supGDM.id;

const [supGRN] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-GRN', 'GuruNanda LLC USA', 'Sales Desk', 'contact@gurunanda.com', '+1 866 421 6800', '560 S Walnut Ave', 'La Habra', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierGRNId = supGRN.id;

const [supHUM] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-HUM', 'HUM Nutrition Inc USA', 'Sales Desk', 'orders@humnutrition.com', '+1 888 647 8880', '8383 Wilshire Blvd', 'Beverly Hills', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierHUMId = supHUM.id;

const [supLRP] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-LRP', 'La Roche-Posay France', 'Export Sales', 'info@laroche-posay.com', '+33 1 47 59 80 00', '30 Rue d''Anjou', 'Paris', 'France')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierLRPId = supLRP.id;

const [supNTR] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-NTR', 'Naturium Skincare USA', 'Sales Desk', 'orders@naturium.com', '+1 888 447 9811', '100 Wilshire Blvd', 'Santa Monica', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierNTRId = supNTR.id;

const [supSMN] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-SMN', 'Smooth & Natural Personal Care', 'Export Desk', 'sales@smoothandnatural.com', '+1 800 782 9912', '500 Commerce Way', 'Dallas', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierSMNId = supSMN.id;

const [supNTM] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-NTM', 'Nature Made (Pharmavite LLC)', 'Customer Care', 'orders@naturemade.com', '+1 800 276 2878', '8550 Balboa Blvd', 'Northridge', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierNTMId = supNTM.id;

const [supMTD] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-MTD', 'Method Products PBC USA', 'Sales Desk', 'orders@methodhome.com', '+1 866 963 8463', '637 Commercial St', 'San Francisco', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierMTDId = supMTD.id;

const [supNWY] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-NWY', 'Nature''s Way Brands LLC USA', 'Sales Desk', 'orders@naturesway.com', '+1 800 964 8373', '825 Challenger Dr', 'Green Bay', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierNWYId = supNWY.id;

const [supNOW] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-NOW', 'NOW Health Group Inc USA', 'Customer Care', 'sales@nowfoods.com', '+1 888 669 3663', '395 S Glen Ellyn Rd', 'Bloomingdale', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierNOWId = supNOW.id;

const [supNTG] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-NTG', 'Johnson & Johnson (Neutrogena)', 'Sales Desk', 'orders@neutrogena.com', '+1 800 582 4048', '5701 Buckingham Pkwy', 'Los Angeles', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierNTGId = supNTG.id;

const [supPNX] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-PNX', 'Crown Laboratories (PanOxyl USA)', 'Customer Care', 'support@panoxyl.com', '+1 800 334 1228', '349 S Main St', 'Johnson City', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierPNXId = supPNX.id;

// Categories
let suppCategories = await runQuery(() => sql`SELECT id FROM category WHERE slug = 'supplements-wellness'`);
let suppCategoryId = suppCategories.length ? suppCategories[0].id : null;
if (!suppCategoryId) {
  const [cat] = await runQuery(() => sql`
    INSERT INTO category (name, slug, description)
    VALUES ('Supplements & Wellness', 'supplements-wellness', 'Vitamins, minerals, probiotics and dietary supplements')
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `);
  suppCategoryId = cat.id;
}

let skinCategories = await runQuery(() => sql`SELECT id FROM category WHERE slug = 'skincare-lotions'`);
let skinCategoryId = skinCategories.length ? skinCategories[0].id : null;
if (!skinCategoryId) {
  const [cat] = await runQuery(() => sql`
    INSERT INTO category (name, slug, description)
    VALUES ('Skincare & Lotions', 'skincare-lotions', 'Dermatologist tested toners, serums, lotions and cleansing foams')
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `);
  skinCategoryId = cat.id;
}

const extractedProducts = [
  // Set 18 Products
  {
    sku: 'TRM-ODLR-16TB',
    barcode: '032917999018',
    name: 'Traditional Medicinals Organic Dandelion Leaf & Root Tea (16 Tea Bags)',
    genericName: 'Organic Dandelion Leaf & Root Herbal Tea',
    description: 'Daily herbal tea for detox + kidney health. Balanced & earthy flavor. USDA Organic & Caffeine free. 16 Wrapped Tea Bags.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierTRMId,
    type: 'supplement',
    costPricePesewas: 8000,
    sellingPricePesewas: 12000,
    unit: 'box',
    packSize: 16,
    dosageForm: 'Tea Bags',
    strength: 'Organic Dandelion Leaf & Root',
    manufacturer: 'Traditional Medicinals',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-TRM-2026-DLR',
    imageUrl: '/products/traditional-medicinals-organic-dandelion-leaf-root-tea-16tb.png',
  },
  {
    sku: 'PNX-AFW10-156G',
    barcode: '310742010588',
    name: 'PanOxyl Acne Foaming Wash 10% Benzoyl Peroxide (156 g)',
    genericName: '10% Benzoyl Peroxide Maximum Strength Acne Wash',
    description: 'Maximum strength 10% Benzoyl Peroxide acne treatment wash for face & body. Clears existing acne and prevents new breakouts. 5.5 oz (156 g).',
    categoryId: skinCategoryId,
    primarySupplierId: supplierPNXId,
    type: 'beauty',
    costPricePesewas: 14000,
    sellingPricePesewas: 20000,
    unit: 'box',
    packSize: 1,
    dosageForm: 'Foaming Wash',
    strength: '10% Benzoyl Peroxide',
    manufacturer: 'Crown Laboratories (PanOxyl)',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 25,
    batchNumber: 'LOT-PNX-2026-FW10',
    imageUrl: '/products/panoxyl-acne-foaming-wash-10-156g.png',
  },
  {
    sku: 'PNX-ACW4-170G',
    barcode: '310742004088',
    name: 'PanOxyl Acne Creamy Wash 4% Benzoyl Peroxide (170 g)',
    genericName: '4% Benzoyl Peroxide Daily Control Acne Wash',
    description: 'Daily control 4% Benzoyl Peroxide acne treatment wash for face & body. Formulated to be gentle on skin. 6 oz (170 g).',
    categoryId: skinCategoryId,
    primarySupplierId: supplierPNXId,
    type: 'beauty',
    costPricePesewas: 14000,
    sellingPricePesewas: 20000,
    unit: 'box',
    packSize: 1,
    dosageForm: 'Creamy Wash',
    strength: '4% Benzoyl Peroxide',
    manufacturer: 'Crown Laboratories (PanOxyl)',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 25,
    batchNumber: 'LOT-PNX-2026-CW4',
    imageUrl: '/products/panoxyl-acne-creamy-wash-4-170g.png',
  },
  {
    sku: 'NOW-VD3-120S',
    barcode: '733739003788',
    name: 'NOW Foods High Potency Vitamin D3 10,000 IU (120 Softgels)',
    genericName: 'High Potency Vitamin D3 10,000 IU Softgels',
    description: 'Bone & immune health support, healthy teeth & muscle health. High potency 10,000 IU. 120 Softgels.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierNOWId,
    type: 'supplement',
    costPricePesewas: 15000,
    sellingPricePesewas: 22000,
    unit: 'bottle',
    packSize: 120,
    dosageForm: 'Softgel',
    strength: '10,000 IU Vitamin D3',
    manufacturer: 'NOW Foods',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 25,
    batchNumber: 'LOT-NOW-2026-VD3',
    imageUrl: '/products/now-foods-high-potency-vitamin-d3-10000iu-120s.png',
  },
  {
    sku: 'VIT-PMAX-84T',
    barcode: '5021265225888',
    name: 'Vitabiotics Perfectil MAX Maximum Support (84 Dual Pack)',
    genericName: 'Perfectil MAX Biotin, Zinc & Selenium Triple Support',
    description: 'UK\'s No. 1 Beauty Supplement Brand. Maximum support for skin, hair & nails with Biotin, Zinc, Selenium & Omega 3-6. 84 Dual Pack.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierVITId,
    type: 'supplement',
    costPricePesewas: 32000,
    sellingPricePesewas: 46000,
    unit: 'box',
    packSize: 84,
    dosageForm: 'Tablet/Capsule',
    strength: 'Biotin + Zinc + Selenium + Omega 3-6',
    manufacturer: 'Vitabiotics',
    countryOfOrigin: 'UK',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 18,
    batchNumber: 'LOT-VIT-2026-PMAX',
    imageUrl: '/products/vitabiotics-perfectil-max-maximum-support-84t.png',
  },
];

for (const p of extractedProducts) {
  let prodRows = await runQuery(() => sql`SELECT id FROM product WHERE sku = ${p.sku}`);
  let productId;
  if (!prodRows.length) {
    const [prod] = await runQuery(() => sql`
      INSERT INTO product (
        sku, barcode, name, generic_name, description, category_id, primary_supplier_id,
        type, cost_price_pesewas, selling_price_pesewas, unit, pack_size, dosage_form,
        strength, manufacturer, country_of_origin, reorder_point, reorder_qty, image_url
      )
      VALUES (
        ${p.sku}, ${p.barcode}, ${p.name}, ${p.genericName}, ${p.description}, ${p.categoryId}, ${p.primarySupplierId},
        ${p.type}, ${p.costPricePesewas}, ${p.sellingPricePesewas}, ${p.unit}, ${p.packSize}, ${p.dosageForm},
        ${p.strength}, ${p.manufacturer}, ${p.countryOfOrigin}, ${p.reorderPoint}, ${p.reorderQty}, ${p.imageUrl}
      )
      RETURNING id
    `);
    productId = prod.id;
  } else {
    productId = prodRows[0].id;
    await runQuery(() => sql`
      UPDATE product SET
        name = ${p.name},
        generic_name = ${p.genericName},
        description = ${p.description},
        cost_price_pesewas = ${p.costPricePesewas},
        selling_price_pesewas = ${p.sellingPricePesewas},
        image_url = ${p.imageUrl},
        dosage_form = ${p.dosageForm},
        strength = ${p.strength},
        manufacturer = ${p.manufacturer}
      WHERE id = ${productId}
    `);
  }

  // Upsert Stock Item
  const stockRows = await runQuery(() => sql`SELECT id FROM stock_item WHERE product_id = ${productId} AND store_id = ${storeId}`);
  if (!stockRows.length) {
    await runQuery(() => sql`
      INSERT INTO stock_item (product_id, store_id, quantity_on_hand)
      VALUES (${productId}, ${storeId}, ${p.initialQty})
    `);
  } else {
    await runQuery(() => sql`
      UPDATE stock_item SET quantity_on_hand = ${p.initialQty} WHERE id = ${stockRows[0].id}
    `);
  }

  // Stock Batch
  const batchRows = await runQuery(() => sql`SELECT id FROM stock_batch WHERE batch_number = ${p.batchNumber}`);
  if (!batchRows.length) {
    await runQuery(() => sql`
      INSERT INTO stock_batch (
        product_id, store_id, supplier_id, batch_number, quantity_received, quantity_remaining, cost_price_pesewas, received_at, expiry_date
      )
      VALUES (
        ${productId}, ${storeId}, ${p.primarySupplierId}, ${p.batchNumber}, ${p.initialQty}, ${p.initialQty}, ${p.costPricePesewas}, NOW(), '2027-12-31'
      )
    `);
  }

  console.log(`✅ Product seeded/updated: ${p.name} (SKU: ${p.sku})`);
}

console.log('\n🎉 Successfully seeded Set 18 extracted inventory products!');
