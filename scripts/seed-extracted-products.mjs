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

console.log('🌱 Seeding Extracted Products Set 30 (NOW Foods Batch)...');

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

const [supNUT] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-NUT', 'Nutricost USA LLC', 'Wholesale Operations', 'wholesale@nutricost.com', '+1 866 438 3694', '351 E 1750 N', 'Vineyard', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierNUTId = supNUT.id;

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

const [supPRT] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-PRT', 'Quest Personal Care (Pretty UK)', 'Export Desk', 'sales@questpersonalcare.co.uk', '+44 161 789 2200', '100 Regent Rd', 'Manchester', 'UK')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierPRTId = supPRT.id;

const [supIMF] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-IMF', 'Wishcompany Inc (I''m from Korea)', 'Global Desk', 'contact@wishcompany.net', '+82 2 3446 8040', 'Gangnam-gu', 'Seoul', 'South Korea')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierIMFId = supIMF.id;

const [supCRT] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-CRT', 'Creightons PLC UK', 'Sales Care', 'orders@creightons.com', '+44 1733 372900', 'Waterloo Road', 'Peterborough', 'UK')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierCRTId = supCRT.id;

const [supKSC] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-KSC', 'K-Secret Skincare Korea', 'Global Sales', 'info@k-secret.com', '+82 2 888 9910', 'Gangnam-gu', 'Seoul', 'South Korea')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierKSCId = supKSC.id;

const [supOGX] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-OGX', 'Vogue International (OGX USA)', 'Sales Desk', 'orders@ogxbeauty.com', '+1 800 252 4765', '405 Clearwater Tower', 'Clearwater', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierOGXId = supOGX.id;

const [supSNS] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-SNS', 'Haleon Healthcare (Sensodyne)', 'Customer Care', 'orders@haleon.com', '+1 800 245 1040', '184 Liberty Corner Rd', 'Warren', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierSNSId = supSNS.id;

const [supSMP] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-SMP', 'Unilever UK (Simple Skincare)', 'Export Sales', 'orders@simple.co.uk', '+44 800 028 0020', '100 Victoria Embankment', 'London', 'UK')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierSMPId = supSMP.id;

const [supSLG] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-SLG', 'Solgar Inc USA', 'Customer Care', 'support@solgar.com', '+1 800 645 2246', '500 Willow Tree Rd', 'Leonia', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierSLGId = supSLG.id;

const [supTAM] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-TAM', 'TIA''M Skincare Korea', 'Global Desk', 'contact@tiam.co.kr', '+82 2 543 9012', 'Secho-gu', 'Seoul', 'South Korea')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierTAMId = supTAM.id;

const [supVET] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-VET', 'Reckitt Benckiser (Veet)', 'Customer Care', 'orders@veet.com', '+1 800 228 4722', '103 Jackson Rd', 'Parsippany', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierVETId = supVET.id;

const [supWDR] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-WDR', 'Weider Health & Fitness USA', 'Customer Care', 'support@weider.com', '+1 800 423 5700', '2000 M-73', 'Salt Lake City', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierWDRId = supWDR.id;

const [supTMH] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-TMH', 'Time Health UK Ltd', 'Customer Care Desk', 'info@timehealth.co.uk', '+44 1904 500010', 'Unit 3 York Business Park', 'York', 'UK')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierTMHId = supTMH.id;

const [supOPT] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-OPT', 'Glanbia Performance Nutrition (Optimum Nutrition)', 'B2B Sales', 'orders@optimumnutrition.com', '+1 800 705 5226', '3500 Lacey Rd', 'Downers Grove', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierOPTId = supOPT.id;

const [supYOU] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-YOU', 'Youtheory Health (Nutrawise USA)', 'Customer Care', 'orders@youtheory.com', '+1 888 271 8700', '1030 Main St', 'Irvine', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierYOUId = supYOU.id;

const [supZAP] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-ZAP', 'Waltman Pharmaceuticals (ZAPZYT USA)', 'Sales Desk', 'support@zapzyt.com', '+1 800 241 2361', '100 Main St', 'Atlanta', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierZAPId = supZAP.id;

const [supZAZ] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-ZAZ', 'Zazzee Naturals USA', 'Customer Care', 'orders@zazzee.com', '+1 888 550 9299', '1200 N Federal Hwy', 'Boca Raton', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierZAZId = supZAZ.id;

const [supANC] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-ANC', 'Ancient Nutrition LLC USA', 'Sales Care', 'orders@ancientnutrition.com', '+1 855 803 1626', '2000 Mallory Ln', 'Franklin', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierANCId = supANC.id;

const [supAMZ] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-AMZ', 'Amazing Herbs Inc USA', 'Customer Support', 'info@amazingherbs.com', '+1 800 241 9138', '554 Big Shanty Rd', 'Marietta', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierAMZId = supAMZ.id;

const [supLGC] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-LGC', 'Uncle Lee''s Tea (Legends of China)', 'Sales Desk', 'orders@unclelee.com', '+1 800 455 3353', '1241 Red Gum St', 'Anaheim', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierLGCId = supLGC.id;

const [supCOS] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-COS', 'COSRX Inc Korea', 'Global Distribution', 'contact@cosrx.co.kr', '+82 2 6358 6000', 'Gangnam-gu', 'Seoul', 'South Korea')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierCOSId = supCOS.id;

const [supDOW] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-DOW', 'Double Wood Supplements USA', 'Customer Care', 'orders@doublewoodsupplements.com', '+1 888 767 5860', '3510 Horizon Dr', 'Treasure Island', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierDOWId = supDOW.id;

const [supGLF] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-GLF', 'Garden of Life LLC USA', 'Customer Care', 'support@gardenoflife.com', '+1 866 465 8051', '4200 Northcorp Pkwy', 'Palm Beach Gardens', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierGLFId = supGLF.id;

const [supPRP] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-PRP', 'Puritan''s Pride Inc USA', 'Orders Desk', 'custserv@puritan.com', '+1 800 645 1030', '2100 Smithtown Ave', 'Holbrook', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierPRPId = supPRP.id;

const [supWLD] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-WLD', 'Wild Growth Co USA', 'Customer Service', 'info@wildgrowth.com', '+1 888 945 3476', 'PO Box 14840', 'Scottsdale', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierWLDId = supWLD.id;

const [supKRL] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-KRL', 'Costco Wholesale Corp (Kirkland Signature USA)', 'Customer Care', 'support@costco.com', '+1 800 774 2678', '999 Lake Drive', 'Issaquah', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierKRLId = supKRL.id;

const [supJRG] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-JRG', 'Kao USA Inc (Jergens)', 'Customer Care', 'consumer.care@kao.com', '+1 800 742 8798', '2539 Spring Grove Ave', 'Cincinnati', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierJRGId = supJRG.id;

const [supHER] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-HER', 'Nutraceutical Corp (Heritage Store USA)', 'Support Desk', 'info@heritagestore.com', '+1 800 669 8877', '1400 Kearns Blvd', 'Park City', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierHERId = supHER.id;

const [supMRO] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-MRO', 'MaryRuth Organics LLC USA', 'Customer Care', 'support@maryruthorganics.com', '+1 866 852 4478', '1171 S Robertson Blvd', 'Los Angeles', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierMROId = supMRO.id;

const [supNOB] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-NOB', 'Nobi Nutrition LLC USA', 'Support Desk', 'info@nobinutrition.com', '+1 800 393 1845', '701 5th Ave', 'Seattle', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierNOBId = supNOB.id;

const [supNIV] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-NIV', 'Kao Nivea Co Ltd Japan', 'Global Service', 'support@nivea.co.jp', '+81 3 3660 7111', '1-14-10 Nihonbashi Kayabacho', 'Tokyo', 'Japan')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierNIVId = supNIV.id;

const [supPAL] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-PAL', 'E.T. Browne Drug Co. (Palmer''s USA)', 'Sales Desk', 'orders@palmers.com', '+1 800 378 6146', '440 Sylvan Avenue', 'Englewood Cliffs', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierPALId = supPAL.id;

const [supTBR] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-TBR', 'Church & Dwight Co. (TheraBreath USA)', 'Sales Care', 'orders@therabreath.com', '+1 800 983 6725', '500 Charles Ewing Blvd', 'Ewing', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierTBRId = supTBR.id;

const [supTLG] = await runQuery(() => sql`
  INSERT INTO supplier (code, name, contact_person, email, phone, address, city, country)
  VALUES ('SUP-TLG', 'Theralogix LLC USA', 'Customer Service', 'orders@theralogix.com', '+1 800 449 4447', '3 Twin Dolphin Dr', 'Redwood City', 'USA')
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
`);
const supplierTLGId = supTLG.id;

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

let digestCategories = await runQuery(() => sql`SELECT id FROM category WHERE slug = 'digestive-health'`);
let digestCategoryId = digestCategories.length ? digestCategories[0].id : suppCategoryId;

let herbalCategories = await runQuery(() => sql`SELECT id FROM category WHERE slug = 'herbal-botanicals'`);
let herbalCategoryId = herbalCategories.length ? herbalCategories[0].id : suppCategoryId;

const extractedProducts = [
  // Set 24 New Products
  {
    sku: 'TMH-BENF-120C',
    barcode: '5060714760124',
    name: 'Time Health Benfotiamine 300 mg (120 Vegan Capsules)',
    genericName: 'Benfotiamine (Fat-Soluble Vitamin B1) 300 mg Capsules',
    description: '300 mg optimal dose fat-soluble Vitamin B1. Supports glucose metabolism and healthy nerve function with maximum bioavailability. 120 Vegan Capsules. Made in UK.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierTMHId,
    type: 'supplement',
    costPricePesewas: 18000,
    sellingPricePesewas: 26000,
    unit: 'bottle',
    packSize: 120,
    dosageForm: 'Capsule',
    strength: '300 mg Benfotiamine',
    manufacturer: 'Time Health UK',
    countryOfOrigin: 'UK',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 25,
    batchNumber: 'LOT-TMH-2026-BENF',
    imageUrl: '/products/time-health-benfotiamine-300mg-120c.png',
  },
  {
    sku: 'NTG-ACST-236ML',
    barcode: '070501054238',
    name: 'Neutrogena Oil-Free Acne Stress Control Triple-Action Toner (236 ml)',
    genericName: 'Salicylic Acid 2% MicroClear Acne Facial Toner',
    description: 'Triple-Action toner with MicroClear technology. Treats acne even before it emerges, reduces oil & shine, refreshes and smoothes. 8 FL. OZ. (236 mL).',
    categoryId: skinCategoryId,
    primarySupplierId: supplierNTGId,
    type: 'beauty',
    costPricePesewas: 14000,
    sellingPricePesewas: 21000,
    unit: 'bottle',
    packSize: 236,
    dosageForm: 'Toner',
    strength: '2% Salicylic Acid (MicroClear)',
    manufacturer: 'Neutrogena',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-NTG-2026-ACST',
    imageUrl: '/products/neutrogena-acne-stress-control-toner-236ml.png',
  },
  // Set 25 New Products (21st Century & NOW Foods Ingestion)
  {
    sku: '21ST-ADV-PRO-60S',
    barcode: '074098527845',
    name: '21st Century Advanced Probiotic 20 Billion (60 Capsules)',
    genericName: 'Probiotic 6 Strains 20 Billion Live Cultures Supplement',
    description: 'Ultra potency formula with 6 probiotic strains and 20 billion live probiotic cultures per capsule. Supports digestive and immune health. Gluten free. 60 capsules.',
    categoryId: suppCategoryId,
    primarySupplierId: supplier21CId,
    type: 'supplement',
    costPricePesewas: 12000,
    sellingPricePesewas: 17500,
    unit: 'bottle',
    packSize: 60,
    dosageForm: 'Capsule',
    strength: '20 Billion CFU / 6 Strains',
    manufacturer: '21st Century HealthCare',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-21C-2026-PROB',
    imageUrl: '/products/21st-century-advanced-probiotic-60s.png',
  },
  {
    sku: '21ST-CAL-MAG-ZNC-90T',
    barcode: '074098516085',
    name: '21st Century Calcium Magnesium Zinc + D3 (90 Tablets)',
    genericName: 'Calcium, Magnesium, Zinc with Vitamin D3 Mineral Supplement',
    description: 'Important trio of minerals plus Vitamin D3 for bone health and immune system support. Gluten free, non-GMO. 90 tablets.',
    categoryId: suppCategoryId,
    primarySupplierId: supplier21CId,
    type: 'supplement',
    costPricePesewas: 9500,
    sellingPricePesewas: 14000,
    unit: 'bottle',
    packSize: 90,
    dosageForm: 'Tablet',
    strength: 'Calcium + Magnesium + Zinc + Vitamin D3',
    manufacturer: '21st Century HealthCare',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 25,
    batchNumber: 'LOT-21C-2026-CMZD',
    imageUrl: '/products/21st-century-calcium-magnesium-zinc-90t.png',
  },
  {
    sku: '21ST-POT-GLU-110T',
    barcode: '074098513183',
    name: '21st Century Potassium Gluconate 595 mg (110 Tablets)',
    genericName: 'Potassium Gluconate 595 mg Mineral Supplement',
    description: 'Essential electrolyte mineral supplement for electrolyte and fluid balance support. Non-GMO, gluten free. 110 tablets.',
    categoryId: suppCategoryId,
    primarySupplierId: supplier21CId,
    type: 'supplement',
    costPricePesewas: 8500,
    sellingPricePesewas: 12500,
    unit: 'bottle',
    packSize: 110,
    dosageForm: 'Tablet',
    strength: '595 mg Potassium Gluconate',
    manufacturer: '21st Century HealthCare',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-21C-2026-POTG',
    imageUrl: '/products/21st-century-potassium-gluconate-110t.png',
  },
  {
    sku: '21ST-K2-MK7-110S',
    barcode: '074098528996',
    name: '21st Century Vitamin K2 MK-7 100 mcg (110 Veg Capsules)',
    genericName: 'Menaquinone-7 (Vitamin K2) 100 mcg Capsules',
    description: 'Natural Vitamin K2 as MK-7 (Menaquinone-7) 100 mcg. Supports bone health and cardiovascular system. Non-GMO, gluten free. 110 vegetarian capsules.',
    categoryId: suppCategoryId,
    primarySupplierId: supplier21CId,
    type: 'supplement',
    costPricePesewas: 11000,
    sellingPricePesewas: 16000,
    unit: 'bottle',
    packSize: 110,
    dosageForm: 'Capsule',
    strength: '100 mcg Vitamin K2 (MK-7)',
    manufacturer: '21st Century HealthCare',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 15,
    batchNumber: 'LOT-21C-2026-K2MK7',
    imageUrl: '/products/21st-century-k2-mk7-110s.png',
  },
  {
    sku: 'NOW-ROS-118ML',
    barcode: '733739076048',
    name: 'NOW Essential Oils 100% Pure Rosemary Oil (118 ml)',
    genericName: 'Rosmarinus Officinalis Pure Essential Oil 4 fl oz',
    description: '100% pure steam-distilled Rosemary essential oil. Clarifying, uplifting aroma, supports scalp health, hair growth & aromatherapy. 4 fl. oz. (118 mL).',
    categoryId: suppCategoryId,
    primarySupplierId: supplierNOWId,
    type: 'beauty',
    costPricePesewas: 11000,
    sellingPricePesewas: 16000,
    unit: 'bottle',
    packSize: 118,
    dosageForm: 'Oil',
    strength: '100% Pure Rosmarinus Officinalis',
    manufacturer: 'NOW Health Group Inc USA',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 15,
    batchNumber: 'LOT-NOW-2026-ROS118',
    imageUrl: '/products/now-essential-oils-rosemary-118ml.png',
  },
  {
    sku: 'NOW-ROS-30ML',
    barcode: '733739076031',
    name: 'NOW Essential Oils 100% Pure Rosemary Oil (30 ml)',
    genericName: 'Rosmarinus Officinalis Pure Essential Oil 1 fl oz',
    description: '100% pure steam-distilled Rosemary oil. Purifying and energizing aroma, ideal for hair scalp oiling and aromatherapy. 1 fl. oz. (30 mL).',
    categoryId: suppCategoryId,
    primarySupplierId: supplierNOWId,
    type: 'beauty',
    costPricePesewas: 6500,
    sellingPricePesewas: 9500,
    unit: 'bottle',
    packSize: 30,
    dosageForm: 'Oil',
    strength: '100% Pure Rosmarinus Officinalis',
    manufacturer: 'NOW Health Group Inc USA',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 25,
    batchNumber: 'LOT-NOW-2026-ROS30',
    imageUrl: '/products/now-essential-oils-rosemary-30ml.png',
  },
  {
    sku: 'NOW-B12-5000',
    barcode: '733739004970',
    name: 'NOW Methyl B-12 5,000 mcg (90 Veg Capsules)',
    genericName: 'Methylcobalamin (Vitamin B-12) 5,000 mcg Veg Capsules',
    description: 'High potency Methylcobalamin B-12 for cellular energy production and nervous system health. Hypoallergenic vegetarian/vegan formula. 90 Veg Capsules.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierNOWId,
    type: 'supplement',
    costPricePesewas: 13500,
    sellingPricePesewas: 19500,
    unit: 'bottle',
    packSize: 90,
    dosageForm: 'Capsule',
    strength: '5,000 mcg Methylcobalamin',
    manufacturer: 'NOW Health Group Inc USA',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-NOW-2026-MB12',
    imageUrl: '/products/now-methyl-b12-5000mcg-90s.png',
  },
  {
    sku: 'NOW-CDG-90C',
    barcode: '733739006097',
    name: 'NOW Foods Calcium D-Glucarate 500 mg (90 Veg Capsules)',
    genericName: 'Calcium D-Glucarate 500 mg Detoxification & Hormone Support',
    description: 'Supports liver glucuronidation detoxification pathway, breast and prostate health. Non-GMO vegetarian capsules. 90 Veg Capsules.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierNOWId,
    type: 'supplement',
    costPricePesewas: 16000,
    sellingPricePesewas: 23000,
    unit: 'bottle',
    packSize: 90,
    dosageForm: 'Capsule',
    strength: '500 mg Calcium D-Glucarate',
    manufacturer: 'NOW Health Group Inc USA',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-NOW-2026-CDG',
    imageUrl: '/products/now-foods-calcium-d-glucarate-500mg-90c.png',
  },
  {
    sku: 'NOW-BER-GLU-90S',
    barcode: '733739046642',
    name: 'NOW Berberine Glucose Support (90 Softgels)',
    genericName: 'Berberine HCl 400 mg with MCT Oil Softgels',
    description: 'Supports glucose metabolism and healthy lipid levels already within normal range. Formulated with Capric Acid (MCT Oil) for optimal berberine absorption. 90 Softgels.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierNOWId,
    type: 'supplement',
    costPricePesewas: 18000,
    sellingPricePesewas: 26000,
    unit: 'bottle',
    packSize: 90,
    dosageForm: 'Softgel',
    strength: 'Berberine HCl + MCT Oil',
    manufacturer: 'NOW Health Group Inc USA',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 15,
    batchNumber: 'LOT-NOW-2026-BERGLU',
    imageUrl: '/products/now-berberine-glucose-support-90s.png',
  },
  // Set 26 New Products
  {
    sku: 'OPT-WHE-VIC-899G',
    barcode: '074892702877',
    name: 'Optimum Nutrition Gold Standard 100% Whey Vanilla Ice Cream (899g)',
    genericName: 'Whey Protein Isolate 24g Protein Vanilla Powder 899g',
    description: '100% Whey Protein Isolate primary source with 24g protein and 5.5g BCAAs per serving. Vanilla Ice Cream flavor. Supports muscle recovery & growth. 29 Servings (899 g / 1.98 lb).',
    categoryId: suppCategoryId,
    primarySupplierId: supplierOPTId,
    type: 'supplement',
    costPricePesewas: 32000,
    sellingPricePesewas: 45000,
    unit: 'tub',
    packSize: 899,
    dosageForm: 'Powder',
    strength: '24g Protein / 5.5g BCAA',
    manufacturer: 'Optimum Nutrition',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 15,
    batchNumber: 'LOT-OPT-2026-VIC899',
    imageUrl: '/products/optimum-nutrition-gold-standard-whey-vanilla-ice-cream.png',
  },
  {
    sku: 'YOU-ASH-180C',
    barcode: '850502000539',
    name: 'Youtheory Ashwagandha 1,000 mg (180 Veg Capsules)',
    genericName: 'Ashwagandha Root Extract 1,000 mg Stress Response Formula',
    description: 'Daily adaptogen formula providing 1,000 mg Ashwagandha per serving. Supports a healthy stress response and mood balance. 180 vegetarian capsules.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierYOUId,
    type: 'supplement',
    costPricePesewas: 15000,
    sellingPricePesewas: 22000,
    unit: 'bottle',
    packSize: 180,
    dosageForm: 'Capsule',
    strength: '1,000 mg Ashwagandha',
    manufacturer: 'Youtheory',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-YOU-2026-ASH180',
    imageUrl: '/products/youtheory-ashwagandha-1000mg-180c.png',
  },
  {
    sku: 'YOU-COL-BIO-390T',
    barcode: '850502000416',
    name: 'Youtheory Collagen + Biotin 6,000 mg (390 Tablets)',
    genericName: 'Hydrolyzed Collagen Types 1, 2 & 3 with Biotin 390 Tablets',
    description: '6,000 mg hydrolyzed collagen peptides plus Biotin per serving. Revitalizes skin, hair, nails, tendons and ligaments. Enhanced formula. 390 tablets.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierYOUId,
    type: 'supplement',
    costPricePesewas: 21000,
    sellingPricePesewas: 31000,
    unit: 'bottle',
    packSize: 390,
    dosageForm: 'Tablet',
    strength: '6,000 mg Hydrolyzed Collagen + Biotin',
    manufacturer: 'Youtheory',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 35,
    batchNumber: 'LOT-YOU-2026-COL390',
    imageUrl: '/products/youtheory-collagen-biotin-6000mg-390t.png',
  },
  {
    sku: 'ZAP-ACN-GEL-1OZ',
    barcode: '041648000401',
    name: 'ZAPZYT Maximum Strength Acne Treatment Gel 10% Benzoyl Peroxide (28.35 g)',
    genericName: '10% Benzoyl Peroxide Acne Spot Treatment Gel',
    description: 'Dermatologist recommended non-irritating 10% Benzoyl Peroxide gel. Kills 99% of acne-causing bacteria. Vanishes instantly as it clears acne pimples & blackheads. 1 FL OZ (28.35 g).',
    categoryId: skinCategoryId,
    primarySupplierId: supplierZAPId,
    type: 'beauty',
    costPricePesewas: 6500,
    sellingPricePesewas: 9800,
    unit: 'box',
    packSize: 28,
    dosageForm: 'Gel',
    strength: '10% Benzoyl Peroxide',
    manufacturer: 'ZAPZYT USA',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-ZAP-2026-ACNGEL',
    imageUrl: '/products/zapzyt-acne-treatment-gel-10-1oz.png',
  },
  {
    sku: 'ZAZ-PREG-PWD-392G',
    barcode: '856230006451',
    name: 'Zazzee Naturals Pregnositol Powder 40:1 Inositol Blend (392 g)',
    genericName: 'Myo-Inositol & D-Chiro Inositol 40:1 Powder 183 Servings',
    description: 'Optimal 40:1 Myo-Inositol & D-Chiro Inositol unflavored powder. Supports female fertility, reproductive health, and ovarian function. 6 Month Supply (183 Servings / 392 g).',
    categoryId: suppCategoryId,
    primarySupplierId: supplierZAZId,
    type: 'supplement',
    costPricePesewas: 22000,
    sellingPricePesewas: 32000,
    unit: 'tub',
    packSize: 392,
    dosageForm: 'Powder',
    strength: '40:1 Myo-Inositol & D-Chiro Inositol',
    manufacturer: 'Zazzee Naturals',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 15,
    batchNumber: 'LOT-ZAZ-2026-PREG',
    imageUrl: '/products/zazzee-pregnositol-powder-392g.png',
  },
  // Set 27 New Products (OGX Scrub & Wash Variants)
  {
    sku: 'OGX-COC-COF-577ML',
    barcode: '022796575519',
    name: 'OGX Smoothing + Coconut Coffee Body Scrub & Wash (577 ml)',
    genericName: 'Exotic Arabica Coffee & Coconut Oil Body Scrub & Wash 19.5 fl oz',
    description: 'Invigorating and moisturizing blend infused with exotic arabica coffee and coconut oil. Boosts hydration while promoting supple skin. Sulfate free surfactants. 19.5 FL. OZ. (577 mL).',
    categoryId: skinCategoryId,
    primarySupplierId: supplierOGXId,
    type: 'beauty',
    costPricePesewas: 12000,
    sellingPricePesewas: 17500,
    unit: 'bottle',
    packSize: 577,
    dosageForm: 'Body Wash',
    strength: 'Arabica Coffee & Coconut Oil',
    manufacturer: 'Vogue International (OGX)',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-OGX-2026-COCCOF',
    imageUrl: '/products/ogx-smoothing-coconut-coffee-scrub-wash-577ml.png',
  },
  {
    sku: 'OGX-ROS-SALT-577ML',
    barcode: '022796575526',
    name: 'OGX Sensitive + Rose Water & Pink Sea Salt Body Scrub & Wash (577 ml)',
    genericName: 'Calming Rose Water, Rose Quartz & Pink Sea Salt Body Scrub & Wash 19.5 fl oz',
    description: 'Gently cleanses with a restorative blend infused with calming rose water, rose quartz, and pink sea salt. Softens skin and lightly exfoliates while providing lightweight hydration. Sulfate free surfactants. 19.5 FL. OZ. (577 mL).',
    categoryId: skinCategoryId,
    primarySupplierId: supplierOGXId,
    type: 'beauty',
    costPricePesewas: 12000,
    sellingPricePesewas: 17500,
    unit: 'bottle',
    packSize: 577,
    dosageForm: 'Body Wash',
    strength: 'Rose Water & Pink Sea Salt',
    manufacturer: 'Vogue International (OGX)',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-OGX-2026-ROSSALT',
    imageUrl: '/products/ogx-sensitive-rose-water-pink-sea-salt-scrub-wash-577ml.png',
  },
  // Set 28 New Products (Super Greens, Black Seed, Dieters Tea, COSRX, Double Wood)
  {
    sku: 'ANC-SUP-GRN-200G',
    barcode: '816401026048',
    name: 'Ancient Nutrition Organic Super Greens Powder (200g)',
    genericName: 'Spirulina, Matcha, Chlorella & Reishi Superfood Powder 7.05 oz',
    description: 'USDA Organic whole food dietary supplement featuring 25+ superfoods including Spirulina, Matcha, Chlorella, Reishi and Probiotics. Detox, digest & energize. 7.05 OZ (200 g).',
    categoryId: suppCategoryId,
    primarySupplierId: supplierANCId,
    type: 'supplement',
    costPricePesewas: 22000,
    sellingPricePesewas: 32000,
    unit: 'tub',
    packSize: 200,
    dosageForm: 'Powder',
    strength: 'Spirulina + Matcha + Chlorella + Reishi',
    manufacturer: 'Ancient Nutrition',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 15,
    batchNumber: 'LOT-ANC-2026-GRN200',
    imageUrl: '/products/ancient-nutrition-organic-super-greens-200g.png',
  },
  {
    sku: 'AMZ-BLK-OIL-120ML',
    barcode: '665288000408',
    name: 'Amazing Herbs Premium Cold-Pressed Black Seed Oil (120 ml)',
    genericName: '100% Pure Cold-Pressed Black Cumin Seed Oil 4 fl oz',
    description: '100% pure cold-pressed Black Cumin Seed Oil containing minimum 1.2% Thymoquinone (5X-TQ). Non-GMO Project Verified. 4 fl. oz. (120 mL).',
    categoryId: suppCategoryId,
    primarySupplierId: supplierAMZId,
    type: 'supplement',
    costPricePesewas: 13000,
    sellingPricePesewas: 19000,
    unit: 'bottle',
    packSize: 120,
    dosageForm: 'Oil',
    strength: 'Min 1.2% Thymoquinone (5X-TQ)',
    manufacturer: 'Amazing Herbs',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 25,
    batchNumber: 'LOT-AMZ-2026-BLK120',
    imageUrl: '/products/amazing-herbs-black-seed-oil-120ml.png',
  },
  {
    sku: 'LGC-DIE-DRK-30S',
    barcode: '049871000105',
    name: 'Legends of China Green Dieter Brand Dieters\' Drink (30 Tea Bags)',
    genericName: '100% Natural Herbal Caffeine Free Dieters Tea',
    description: '100% natural herbal tea formulation for men & women. Caffeine free, natural cleansing & weight management support. 30 Tea Bags (60 g).',
    categoryId: suppCategoryId,
    primarySupplierId: supplierLGCId,
    type: 'supplement',
    costPricePesewas: 5500,
    sellingPricePesewas: 8500,
    unit: 'box',
    packSize: 30,
    dosageForm: 'Tea Bag',
    strength: 'Natural Herbal Formula (Caffeine Free)',
    manufacturer: 'Uncle Lee\'s Tea',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 25,
    batchNumber: 'LOT-LGC-2026-DIEDRK',
    imageUrl: '/products/legends-of-china-dieters-drink-30s.png',
  },
  {
    sku: 'COS-SNL-96ESS-100ML',
    barcode: '8809416470009',
    name: 'COSRX Advanced Snail 96 Mucin Power Essence (100 ml)',
    genericName: '96% Snail Secretion Filtrate Hydrating Facial Essence',
    description: 'Formulated with 96% Snail Secretion Filtrate (Mucin). Helps skin lose less moisture while keeping skin smooth, healthy & radiant. 100 mL (3.38 fl. oz.).',
    categoryId: skinCategoryId,
    primarySupplierId: supplierCOSId,
    type: 'beauty',
    costPricePesewas: 14000,
    sellingPricePesewas: 21000,
    unit: 'box',
    packSize: 100,
    dosageForm: 'Essence',
    strength: '96% Snail Secretion Filtrate',
    manufacturer: 'COSRX',
    countryOfOrigin: 'South Korea',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-COS-2026-SNL96',
    imageUrl: '/products/cosrx-advanced-snail-96-mucin-power-essence-100ml.png',
  },
  {
    sku: 'COS-SNL-92CRM-100G',
    barcode: '8809416470016',
    name: 'COSRX Advanced Snail 92 All in one Cream (100 g)',
    genericName: '92% Snail Secretion Filtrate All In One Facial Cream',
    description: 'Formulated with 92% Snail Secretion Filtrate (Mucin). Helps naturally create the appealing glow of healthy, plump skin. 100 g (3.52 oz.).',
    categoryId: skinCategoryId,
    primarySupplierId: supplierCOSId,
    type: 'beauty',
    costPricePesewas: 14500,
    sellingPricePesewas: 22000,
    unit: 'box',
    packSize: 100,
    dosageForm: 'Cream',
    strength: '92% Snail Secretion Filtrate',
    manufacturer: 'COSRX',
    countryOfOrigin: 'South Korea',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-COS-2026-SNL92',
    imageUrl: '/products/cosrx-advanced-snail-92-all-in-one-cream-100g.png',
  },
  {
    sku: 'DOW-MAG-GLY-180C',
    barcode: '850001235069',
    name: 'Double Wood Supplements Magnesium Glycinate 400 mg (180 Veggie Capsules)',
    genericName: 'Magnesium Glycinate 400 mg Sleep & Nerve Support',
    description: '400 mg Magnesium Glycinate per capsule. Promotes healthy sleep quality, nerve function, and muscle relaxation. 180 Veggie Capsules.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierDOWId,
    type: 'supplement',
    costPricePesewas: 16000,
    sellingPricePesewas: 23500,
    unit: 'bottle',
    packSize: 180,
    dosageForm: 'Capsule',
    strength: '400 mg Magnesium Glycinate',
    manufacturer: 'Double Wood Supplements',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 25,
    batchNumber: 'LOT-DOW-2026-MAGGLY',
    imageUrl: '/products/double-wood-magnesium-glycinate-400mg-180c.png',
  },
  // Set 29 New Products (21st Century Batch)
  {
    sku: '21ST-DIG-ENZ-60S',
    barcode: '074098527589',
    name: '21st Century Digestive Enzymes (60 Capsules)',
    genericName: 'Proprietary Digestive Enzyme Blend Capsules 60s',
    description: 'Proprietary digestive enzyme blend supports natural breakdown of proteins, fats & carbohydrates to aid healthy digestion. Gluten free & Non-GMO. 60 Capsules.',
    categoryId: suppCategoryId,
    primarySupplierId: supplier21CId,
    type: 'supplement',
    costPricePesewas: 7500,
    sellingPricePesewas: 11500,
    unit: 'bottle',
    packSize: 60,
    dosageForm: 'Capsule',
    strength: 'Proprietary Enzyme Blend',
    manufacturer: '21st Century HealthCare Inc USA',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-21C-2026-DIGENZ',
    imageUrl: '/products/21st-century-digestive-enzymes-60s.png',
  },
  {
    sku: '21ST-MAG-GLY-90C',
    barcode: '074098530343',
    name: '21st Century Chelated Magnesium Glycinate 200 mg (90 Capsules)',
    genericName: 'High Absorption Magnesium Glycinate 200 mg Mineral Supplement',
    description: 'Chelated Magnesium Glycinate provides 200 mg per serving with high absorption. Supports bone, muscle, heart & nerve health. Gluten free & Non-GMO. 90 Capsules.',
    categoryId: suppCategoryId,
    primarySupplierId: supplier21CId,
    type: 'supplement',
    costPricePesewas: 11000,
    sellingPricePesewas: 16500,
    unit: 'bottle',
    packSize: 90,
    dosageForm: 'Capsule',
    strength: '200 mg Chelated Magnesium Glycinate',
    manufacturer: '21st Century HealthCare Inc USA',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-21C-2026-MAGGLY',
    imageUrl: '/products/21st-century-chelated-magnesium-glycinate-90c.png',
  },
  {
    sku: '21ST-PRO-HLT-60S',
    barcode: '074098522331',
    name: '21st Century Men\'s Formula Prostate Health (60 Softgels)',
    genericName: 'Beta-Sitosterol 125 mg Herbal Prostate Function Support',
    description: 'Men\'s formula containing 125 mg Beta-Sitosterol per serving plus Saw Palmetto & Pygeum. Promotes healthy urinary flow and prostate function support. 60 Softgels.',
    categoryId: suppCategoryId,
    primarySupplierId: supplier21CId,
    type: 'supplement',
    costPricePesewas: 12500,
    sellingPricePesewas: 18500,
    unit: 'box',
    packSize: 60,
    dosageForm: 'Softgel',
    strength: '125 mg Beta-Sitosterol',
    manufacturer: '21st Century HealthCare Inc USA',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-21C-2026-PROHLT',
    imageUrl: '/products/21st-century-prostate-health-60s.png',
  },
  {
    sku: '21ST-SUP-COL-180T',
    barcode: '074098527718',
    name: '21st Century Super Collagen Plus Vitamin C 6,000 mg (180 Tablets)',
    genericName: 'Hydrolyzed Super Collagen Peptides with Vitamin C 180 Tablets',
    description: 'Healthy renewal formula providing 6,000 mg Collagen Peptides with Vitamin C per serving. Comprehensive hair, skin, nails, bone & joint support. 180 Tablets.',
    categoryId: suppCategoryId,
    primarySupplierId: supplier21CId,
    type: 'supplement',
    costPricePesewas: 16000,
    sellingPricePesewas: 23500,
    unit: 'bottle',
    packSize: 180,
    dosageForm: 'Tablet',
    strength: '6,000 mg Collagen + Vitamin C',
    manufacturer: '21st Century HealthCare Inc USA',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-21C-2026-SUPCOL',
    imageUrl: '/products/21st-century-super-collagen-plus-vitamin-c-180t.png',
  },
  {
    sku: '21ST-CRN-PRO-60T',
    barcode: '074098527268',
    name: '21st Century Cranberry Plus Probiotic (60 Tablets)',
    genericName: 'Cranberry Extract with Probiotic & Vitamin C 60 Tablets',
    description: 'Urinary tract health support formula comparing to AZO Cranberry. Infused with Probiotics and Vitamin C for flushing support and urinary cleanliness. 60 Tablets.',
    categoryId: suppCategoryId,
    primarySupplierId: supplier21CId,
    type: 'supplement',
    costPricePesewas: 8000,
    sellingPricePesewas: 12000,
    unit: 'box',
    packSize: 60,
    dosageForm: 'Tablet',
    strength: 'Cranberry Extract + Probiotic + Vitamin C',
    manufacturer: '21st Century HealthCare Inc USA',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-21C-2026-CRNPRO',
    imageUrl: '/products/21st-century-cranberry-plus-probiotic-60t.png',
  },
  {
    sku: 'DRB-DIM-200MG-60C',
    name: 'Dr. Berg DIM Supplement Estrogen Balance 200 mg (60 Capsules)',
    genericName: 'Diindolylmethane (DIM) 200 mg Supplement',
    description: 'Supports estrogen balance and healthy hormone metabolism. Formulated with 200 mg Diindolylmethane plus vitamin E and natural phytonutrients.',
    costPricePesewas: 22000,
    sellingPricePesewas: 35000,
    categoryId: suppCategoryId,
    primarySupplierId: supplierDRBId,
    type: 'supplement',
    unit: 'bottle',
    packSize: 60,
    reorderPoint: 5,
    reorderQty: 10,
    barcode: '850000000031',
    imageUrl: '/products/dr-berg-dim-supplement-60s.png',
    dosageForm: 'Capsule',
    strength: '200 mg',
    manufacturer: 'Dr. Berg Health Products',
    countryOfOrigin: 'USA',
    initialQty: 25,
    batchNumber: 'LOT-DRB-2026-DIM'
  },
  {
    sku: 'DRB-ELD-1000MG-90C',
    name: 'Dr. Berg Advanced Immune Support 1000 mg Elderberry (90 Capsules)',
    genericName: 'Elderberry 1000 mg Immune Formula',
    description: 'Advanced immune support featuring 1000 mg Elderberry extract with Vitamin C, Vitamin D3, and Zinc for potent seasonal wellness support.',
    costPricePesewas: 20000,
    sellingPricePesewas: 32000,
    categoryId: suppCategoryId,
    primarySupplierId: supplierDRBId,
    type: 'supplement',
    unit: 'bottle',
    packSize: 90,
    reorderPoint: 5,
    reorderQty: 10,
    barcode: '850000000032',
    imageUrl: '/products/dr-berg-elderberry-1000mg-90s.png',
    dosageForm: 'Capsule',
    strength: '1000 mg',
    manufacturer: 'Dr. Berg Health Products',
    countryOfOrigin: 'USA',
    initialQty: 25,
    batchNumber: 'LOT-DRB-2026-ELD'
  },
  {
    sku: 'DRB-B12-CMP-60C',
    name: 'Dr. Berg Natural Vitamin B12 Methylcobalamin with B Complex Blend (60 Capsules)',
    genericName: 'Vitamin B12 Methylcobalamin + B Complex',
    description: 'Bioactive Vitamin B12 as Methylcobalamin with full-spectrum B-complex cofactors for cellular energy, nerve health, and brain focus.',
    costPricePesewas: 19000,
    sellingPricePesewas: 30000,
    categoryId: suppCategoryId,
    primarySupplierId: supplierDRBId,
    type: 'supplement',
    unit: 'bottle',
    packSize: 60,
    reorderPoint: 5,
    reorderQty: 10,
    barcode: '850000000033',
    imageUrl: '/products/dr-berg-b12-b-complex-60s.png',
    dosageForm: 'Capsule',
    strength: 'B12 + B Complex',
    manufacturer: 'Dr. Berg Health Products',
    countryOfOrigin: 'USA',
    initialQty: 25,
    batchNumber: 'LOT-DRB-2026-B12'
  },
  {
    sku: 'DRB-MAG-GLY-150C',
    name: 'Dr. Berg Magnesium Glycinate Chelated 120 mg (150 Veggie Capsules)',
    genericName: 'Magnesium Glycinate Chelated 120 mg',
    description: 'Chelated Magnesium Glycinate enhanced with Vitamin B6 and Vitamin D for maximum bio-absorption. Helps ease stress and promote restful sleep.',
    costPricePesewas: 24000,
    sellingPricePesewas: 38000,
    categoryId: suppCategoryId,
    primarySupplierId: supplierDRBId,
    type: 'supplement',
    unit: 'bottle',
    packSize: 150,
    reorderPoint: 5,
    reorderQty: 10,
    barcode: '850000000034',
    imageUrl: '/products/dr-berg-magnesium-glycinate-150s.png',
    dosageForm: 'Veggie Capsule',
    strength: '120 mg',
    manufacturer: 'Dr. Berg Health Products',
    countryOfOrigin: 'USA',
    initialQty: 25,
    batchNumber: 'LOT-DRB-2026-MAG'
  },
  {
    sku: 'DRB-GLU-CHO-120C',
    name: 'Dr. Berg Glucosamine Chondroitin Advanced Joint Support (120 Capsules)',
    genericName: 'Glucosamine Chondroitin + Turmeric & MSM',
    description: 'Advanced joint support formula with Glucosamine, Chondroitin, Turmeric root extract, and MSM for cartilage flexibility, joint mobility, and comfort.',
    costPricePesewas: 26000,
    sellingPricePesewas: 42000,
    categoryId: suppCategoryId,
    primarySupplierId: supplierDRBId,
    type: 'supplement',
    unit: 'bottle',
    packSize: 120,
    reorderPoint: 5,
    reorderQty: 10,
    barcode: '850000000035',
    imageUrl: '/products/dr-berg-glucosamine-chondroitin-120s.png',
    dosageForm: 'Capsule',
    strength: 'Glucosamine + Chondroitin',
    manufacturer: 'Dr. Berg Health Products',
    countryOfOrigin: 'USA',
    initialQty: 25,
    batchNumber: 'LOT-DRB-2026-GLU'
  },
  {
    sku: 'DRB-SP-ELE-30P',
    name: 'Dr. Berg Sports Hydration Electrolytes Raspberry & Lemon (30 Stick Packs)',
    genericName: 'Pink Himalayan Salt & Potassium Electrolytes',
    description: 'Powered by Pink Himalayan Sea Salt and Potassium (1000 mg Potassium, 500 mg Sodium). Replenishing electrolytes & trace minerals. Keto-friendly & sweetened with Stevia.',
    costPricePesewas: 22000,
    sellingPricePesewas: 35000,
    categoryId: suppCategoryId,
    primarySupplierId: supplierDRBId,
    type: 'supplement',
    unit: 'box',
    packSize: 30,
    reorderPoint: 5,
    reorderQty: 10,
    barcode: '850000000036',
    imageUrl: '/products/dr-berg-sports-hydration-electrolytes-30s.png',
    dosageForm: 'Stick Pack',
    strength: '1000 mg Potassium + 500 mg Sodium',
    manufacturer: 'Dr. Berg Health Products',
    countryOfOrigin: 'USA',
    initialQty: 25,
    batchNumber: 'LOT-DRB-2026-ELE'
  },
  {
    sku: 'DRB-B1-ALL-60C',
    name: 'Dr. Berg Natural Vitamin B1+ Allithiamine with B Complex Blend (60 Capsules)',
    genericName: 'Allithiamine Fat-Soluble Vitamin B1 + B Complex',
    description: 'High-absorption fat-soluble Vitamin B1 (Allithiamine) enhanced with a synergistic B-complex blend for nerve system support and energy production.',
    costPricePesewas: 19000,
    sellingPricePesewas: 30000,
    categoryId: suppCategoryId,
    primarySupplierId: supplierDRBId,
    type: 'supplement',
    unit: 'bottle',
    packSize: 60,
    reorderPoint: 5,
    reorderQty: 10,
    barcode: '850000000037',
    imageUrl: '/products/dr-berg-vitamin-b1-allithiamine-60s.png',
    dosageForm: 'Capsule',
    strength: 'Allithiamine B1 + B Complex',
    manufacturer: 'Dr. Berg Health Products',
    countryOfOrigin: 'USA',
    initialQty: 25,
    batchNumber: 'LOT-DRB-2026-B1'
  },
  {
    sku: 'GLF-PRO-WOM-30C',
    name: 'Garden of Life Dr. Formulated Probiotics Once Daily Women\'s (30 Veg Capsules)',
    genericName: '50 Billion 16 Probiotic Strains Women\'s Formula',
    description: 'Once Daily Women\'s probiotic support for vaginal, digestive & immune health. 50 Billion Guaranteed with 16 raw probiotic strains. No refrigeration required.',
    costPricePesewas: 26000,
    sellingPricePesewas: 40000,
    categoryId: suppCategoryId,
    primarySupplierId: supplierGLFId,
    type: 'supplement',
    unit: 'box',
    packSize: 30,
    reorderPoint: 5,
    reorderQty: 10,
    barcode: '658010118316',
    imageUrl: '/products/garden-of-life-probiotics-once-daily-womens-30s.png',
    dosageForm: 'Vegetarian Capsule',
    strength: '50 Billion CFU / 16 Strains',
    manufacturer: 'Garden of Life',
    countryOfOrigin: 'USA',
    initialQty: 25,
    batchNumber: 'LOT-GLF-2026-PROW'
  },
  {
    sku: 'PRP-EST-C-D3-60T',
    name: 'Puritan\'s Pride Ester-C Plus D3 1000 mg (60 Tablets)',
    genericName: '1000 mg Non-Acidic Ester-C + 5000 IU Vitamin D3',
    description: '24-Hour immune support formula. Non-acidic 1000 mg Ester-C Vitamin C gentle on the stomach plus 125 mcg (5000 IU) Vitamin D3. 60 Tablets.',
    costPricePesewas: 15000,
    sellingPricePesewas: 24000,
    categoryId: suppCategoryId,
    primarySupplierId: supplierPRPId,
    type: 'supplement',
    unit: 'bottle',
    packSize: 60,
    reorderPoint: 5,
    reorderQty: 10,
    barcode: '025077180123',
    imageUrl: '/products/puritans-pride-ester-c-plus-d3-1000mg-60t.png',
    dosageForm: 'Tablet',
    strength: '1000 mg Ester-C + 5000 IU D3',
    manufacturer: 'Puritan\'s Pride',
    countryOfOrigin: 'USA',
    initialQty: 25,
    batchNumber: 'LOT-PRP-2026-ESTC'
  },
  {
    sku: 'WLD-GRO-OIL-4OZ',
    name: 'Wild Growth Hair Oil (4 fl. oz / 118.3 ml)',
    genericName: 'Concentrated Natural Hair & Scalp Growth Oil',
    description: 'Original concentrated hair growth formula for hair softening, re-texturizing, and fly-away control. Suitable for hair, eyebrows, eyelashes, and nails. 4 fl. oz (118.3 ml).',
    costPricePesewas: 12000,
    sellingPricePesewas: 19000,
    categoryId: skinCategoryId,
    primarySupplierId: supplierWLDId,
    type: 'beauty',
    unit: 'bottle',
    packSize: 1,
    reorderPoint: 5,
    reorderQty: 10,
    barcode: '081793000101',
    imageUrl: '/products/wild-growth-hair-oil-4oz.png',
    dosageForm: 'Hair Oil',
    strength: 'Concentrated Hair Growth Blend',
    manufacturer: 'Wild Growth Co.',
    countryOfOrigin: 'USA',
    initialQty: 30,
    batchNumber: 'LOT-WLD-2026-HRO'
  },
  {
    sku: 'KRL-VITE-400IU-500S',
    name: 'Kirkland Signature Vitamin E 180 mg 400 IU (500 Softgels)',
    genericName: 'dl-Alpha Tocopheryl Acetate Vitamin E 180 mg',
    description: 'USP Verified. Helps support the immune system and antioxidant activity. Essential nutrient for heart muscle cells. 500 Softgels.',
    costPricePesewas: 26000,
    sellingPricePesewas: 40000,
    categoryId: suppCategoryId,
    primarySupplierId: supplierKRLId,
    type: 'supplement',
    unit: 'bottle',
    packSize: 500,
    reorderPoint: 5,
    reorderQty: 10,
    barcode: '096619123456',
    imageUrl: '/products/kirkland-vitamin-e-180mg-500s.png',
    dosageForm: 'Softgel',
    strength: '180 mg (400 IU) Vitamin E',
    manufacturer: 'Costco Wholesale Corp (Kirkland Signature)',
    countryOfOrigin: 'USA',
    initialQty: 25,
    batchNumber: 'LOT-KRL-2026-VITE'
  },
  {
    sku: 'INR-MYO-DCHI-120C',
    name: 'Intimate Rose Myo and D-Chiro Inositol (120 Vegetarian Capsules)',
    genericName: 'Myo & D-Chiro Inositol (40:1 Ratio) + Ashwagandha & Vitamin D',
    description: 'Hormonal, ovarian & reproductive support. Daily stress support with 40:1 optimal ratio of Myo & D-Chiro Inositol, Ashwagandha, and Vitamin D. 120 Veg Capsules.',
    costPricePesewas: 24000,
    sellingPricePesewas: 38000,
    categoryId: suppCategoryId,
    primarySupplierId: supplierINRId,
    type: 'supplement',
    unit: 'bottle',
    packSize: 120,
    reorderPoint: 5,
    reorderQty: 10,
    barcode: '850005470154',
    imageUrl: '/products/intimate-rose-myo-d-chiro-inositol-120c.png',
    dosageForm: 'Vegetarian Capsule',
    strength: '40:1 Myo & D-Chiro Inositol + Ashwagandha',
    manufacturer: 'Intimate Rose',
    countryOfOrigin: 'USA',
    initialQty: 30,
    batchNumber: 'LOT-INR-2026-INOS'
  },
  {
    sku: 'JRG-ULT-HEA-783ML',
    name: 'Jergens Ultra Healing Extra Dry Skin Moisturizer (26.5 fl. oz / 783 ml)',
    genericName: 'Repairs & Heals Extra Dry Skin Moisturizer with Vitamins C, E & B5',
    description: '48 Hour Moisturizer. Repairs & heals extra dry skin with Vitamins C, E & B5. 25% More Free bonus size. 26.5 FL OZ (783 mL).',
    costPricePesewas: 14000,
    sellingPricePesewas: 22000,
    categoryId: skinCategoryId,
    primarySupplierId: supplierJRGId,
    type: 'beauty',
    unit: 'bottle',
    packSize: 1,
    reorderPoint: 5,
    reorderQty: 10,
    barcode: '019100110123',
    imageUrl: '/products/jergens-ultra-healing-moisturizer-783ml.png',
    dosageForm: 'Lotion',
    strength: 'Vitamins C, E & B5',
    manufacturer: 'Kao USA Inc (Jergens)',
    countryOfOrigin: 'USA',
    initialQty: 25,
    batchNumber: 'LOT-JRG-2026-ULT'
  },
  {
    sku: 'HER-ORG-CAS-473ML',
    name: 'Heritage Store Organic Castor Oil Nourishing Treatment (16 fl. oz / 473 ml)',
    genericName: 'USDA Organic 100% Cold-Pressed Hexane-Free Castor Oil',
    description: 'USDA Organic nourishing treatment. 100% Cold-Pressed, Vegan & Cruelty-Free, Hexane-Free. Ideal for wellness packs, hair & skin care. 16 FL OZ (473 mL).',
    costPricePesewas: 18000,
    sellingPricePesewas: 28000,
    categoryId: skinCategoryId,
    primarySupplierId: supplierHERId,
    type: 'beauty',
    unit: 'bottle',
    packSize: 1,
    reorderPoint: 5,
    reorderQty: 10,
    barcode: '076970123456',
    imageUrl: '/products/heritage-store-organic-castor-oil-473ml.png',
    dosageForm: 'Oil',
    strength: '100% Cold-Pressed Organic Castor Oil',
    manufacturer: 'Nutraceutical Corp (Heritage Store)',
    countryOfOrigin: 'USA',
    initialQty: 25,
    batchNumber: 'LOT-HER-2026-CAS'
  },
  {
    sku: 'LRP-UVM-ADS-50ML',
    name: 'La Roche-Posay Anthelios UVMune 400 Anti-Dark Spots Fluid SPF 50+ (50 ml)',
    genericName: 'Invisible Protection Ultra-Long UVA + HEVL Anti-Dark Spots Fluid',
    description: 'Very high protection SPF 50+ PA++++. Prevents HEVL induced pigmentation with Melasyl™. Non-perfumed, invisible finish for sensitive skin. 50 ml.',
    costPricePesewas: 22000,
    sellingPricePesewas: 35000,
    categoryId: skinCategoryId,
    primarySupplierId: supplierLRPId,
    type: 'beauty',
    unit: 'box',
    packSize: 1,
    reorderPoint: 5,
    reorderQty: 10,
    barcode: '3337875797239',
    imageUrl: '/products/la-roche-posay-anthelios-anti-dark-spots-fluid-50ml.png',
    dosageForm: 'Fluid Sunscreen',
    strength: 'SPF 50+ PA++++ + Melasyl',
    manufacturer: 'La Roche-Posay',
    countryOfOrigin: 'France',
    initialQty: 25,
    batchNumber: 'LOT-LRP-2026-ADS'
  },
  {
    sku: 'MRO-LQM-RAS-946ML',
    name: 'MaryRuth\'s Liquid Morning Multivitamin Raspberry (32 fl. oz / 946 ml)',
    genericName: 'Vegan Natural Raspberry Flavored Liquid Multivitamin',
    description: 'Vegan, Dairy Free, Gluten Free, Sugar Free & Family Friendly liquid morning multivitamin. Formulated to support energy, beauty, and immunity. 32 fl oz (1 Quart / 946 mL).',
    costPricePesewas: 32000,
    sellingPricePesewas: 50000,
    categoryId: suppCategoryId,
    primarySupplierId: supplierMROId,
    type: 'supplement',
    unit: 'bottle',
    packSize: 1,
    reorderPoint: 5,
    reorderQty: 10,
    barcode: '856524007012',
    imageUrl: '/products/maryruths-liquid-morning-multivitamin-raspberry-946ml.png',
    dosageForm: 'Liquid',
    strength: 'Liquid Multivitamin Blend',
    manufacturer: 'MaryRuth Organics',
    countryOfOrigin: 'USA',
    initialQty: 20,
    batchNumber: 'LOT-MRO-2026-LQMR'
  },
  {
    sku: 'NWY-CHL-MNT-480ML',
    name: 'Nature\'s Way Chlorofresh Liquid Chlorophyll Mint Flavored (16 fl. oz / 480 ml)',
    genericName: 'Liquid Chlorophyll 132 mg per Serving Mint Flavored',
    description: 'Plant-powered liquid chlorophyll (132 mg per 1 oz serving). Supports healthy skin & body detox. Refreshing mint flavor. 16 fl oz (480 mL).',
    costPricePesewas: 19000,
    sellingPricePesewas: 30000,
    categoryId: suppCategoryId,
    primarySupplierId: supplierNWYId,
    type: 'supplement',
    unit: 'bottle',
    packSize: 1,
    reorderPoint: 5,
    reorderQty: 10,
    barcode: '033674158104',
    imageUrl: '/products/natures-way-chlorofresh-liquid-chlorophyll-mint-480ml.png',
    dosageForm: 'Liquid',
    strength: '132 mg Chlorophyll / 1 oz',
    manufacturer: 'Nature\'s Way',
    countryOfOrigin: 'USA',
    initialQty: 25,
    batchNumber: 'LOT-NWY-2026-CHLM'
  },
  {
    sku: 'LRP-UVM-FOC-50ML',
    name: 'La Roche-Posay Anthelios UVMune 400 Fluide Oil Control SPF 50+ (50 ml)',
    genericName: 'UVA Ultra-Longs Matte Finish 12h Oil Control Sunscreen Fluid',
    description: 'Protection UVA Ultra-Longs. Dry-touch matte finish with 12h oil control. Anti-eye stinging formula for oily and sensitive skin. 50 ml.',
    costPricePesewas: 22000,
    sellingPricePesewas: 35000,
    categoryId: skinCategoryId,
    primarySupplierId: supplierLRPId,
    type: 'beauty',
    unit: 'box',
    packSize: 1,
    reorderPoint: 5,
    reorderQty: 10,
    barcode: '3337875797246',
    imageUrl: '/products/la-roche-posay-anthelios-fluide-oil-control-50ml.png',
    dosageForm: 'Fluid Sunscreen',
    strength: 'SPF 50+ PA++++ 12h Mattifying',
    manufacturer: 'La Roche-Posay',
    countryOfOrigin: 'France',
    initialQty: 25,
    batchNumber: 'LOT-LRP-2026-FOC'
  },
  {
    sku: 'SK1-TBB-TON-210ML',
    name: 'Skin1004 Madagascar Centella Tone Brightening Boosting Toner (210 ml)',
    genericName: 'Pure Madagascar Centella Tone Brightening Boosting Toner',
    description: 'Made with pure Centella Asiatica from Madagascar. Exfoliates gently, clarifies tone, and boosts skin radiance. 210 mL / 7.10 FL. OZ.',
    costPricePesewas: 16000,
    sellingPricePesewas: 25000,
    categoryId: skinCategoryId,
    primarySupplierId: supplierSK1Id,
    type: 'beauty',
    unit: 'bottle',
    packSize: 1,
    reorderPoint: 5,
    reorderQty: 10,
    barcode: '8809576260824',
    imageUrl: '/products/skin1004-madagascar-centella-tone-brightening-boosting-toner-210ml.png',
    dosageForm: 'Toner',
    strength: 'Madagascar Centella + Tone Brightening',
    manufacturer: 'Skin1004',
    countryOfOrigin: 'South Korea',
    initialQty: 25,
    batchNumber: 'LOT-SK1-2026-TBBT'
  },
  {
    sku: 'NOB-MAG-GLY-120C',
    name: 'Nobi Nutrition Maximum Absorption Magnesium Glycinate Chelated 500 mg (120 Capsules)',
    genericName: 'Chelated Magnesium Glycinate 500 mg Maximum Absorption',
    description: 'Maximum absorption chelated magnesium glycinate 500 mg. Promotes relaxation and muscle health. Non-GMO, dietary supplement. 120 Capsules.',
    costPricePesewas: 22000,
    sellingPricePesewas: 35000,
    categoryId: suppCategoryId,
    primarySupplierId: supplierNOBId,
    type: 'supplement',
    unit: 'bottle',
    packSize: 120,
    reorderPoint: 5,
    reorderQty: 10,
    barcode: '850000000045',
    imageUrl: '/products/nobi-nutrition-magnesium-glycinate-120c.png',
    dosageForm: 'Capsule',
    strength: '500 mg Magnesium Glycinate',
    manufacturer: 'Nobi Nutrition',
    countryOfOrigin: 'USA',
    initialQty: 25,
    batchNumber: 'LOT-NOB-2026-MAG'
  },
  {
    sku: 'NIV-SUN-SWG-140G',
    name: 'Nivea Sun Super Water Gel SPF 50 PA+++ Pump (140g)',
    genericName: 'Super Water Gel Hydrating Sunscreen SPF 50 PA+++',
    description: 'Lightweight lotion-feel water gel sunscreen. Protects skin from daily UV rays with SPF 50 PA+++. 75% watery base formula, easily washes off with soap. 140g Pump Bottle.',
    costPricePesewas: 18000,
    sellingPricePesewas: 28000,
    categoryId: skinCategoryId,
    primarySupplierId: supplierNIVId,
    type: 'beauty',
    unit: 'bottle',
    packSize: 1,
    reorderPoint: 5,
    reorderQty: 10,
    barcode: '4901301298690',
    imageUrl: '/products/nivea-sun-super-water-gel-spf50-140g.png',
    dosageForm: 'Water Gel Sunscreen',
    strength: 'SPF 50 PA+++',
    manufacturer: 'Kao Nivea Japan',
    countryOfOrigin: 'Japan',
    initialQty: 25,
    batchNumber: 'LOT-NIV-2026-SWG'
  },
  // Set 30 New Products (NOW Foods Shelf Photo Batch)
  {
    sku: 'NOW-ACIBIF-60C',
    barcode: '733739029300',
    name: 'NOW Foods 8 Billion Acidophilus & Bifidus (60 Veg Capsules)',
    genericName: 'Lactobacillus acidophilus & Bifidobacterium Probiotic Blend',
    description: 'Designed to provide a high potency and balanced blend of prominent resident intestinal flora. Supports positive probiotic balance and digestive health. Non-GMO, dairy-free, soy-free, gluten-free. 60 Veg Capsules.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierNOWId,
    type: 'supplement',
    costPricePesewas: 14000,
    sellingPricePesewas: 22000,
    unit: 'bottle',
    packSize: 60,
    dosageForm: 'Capsule',
    strength: '8 Billion Organisms',
    manufacturer: 'NOW Foods',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-NOW-2026-ACIBIF',
    imageUrl: '/products/now-foods-8-billion-acidophilus-bifidus-60c.png',
  },
  {
    sku: 'NOW-ADAM-60T',
    barcode: '733739038753',
    name: 'NOW Foods ADAM Superior Men\'s Multi (60 Tablets)',
    genericName: 'Advanced Men\'s Multivitamin & Mineral Formula with Saw Palmetto',
    description: 'Superior men\'s multi-nutrient formula specially designed for men\'s wellness. Features Saw Palmetto, Lycopene, Alpha Lipoic Acid & CoQ10, plus Resveratrol and Grape Seed Extract. Supports energy, vitality, prostate health, and cardiovascular wellness. Vegetarian/Vegan. 60 Tablets.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierNOWId,
    type: 'supplement',
    costPricePesewas: 18000,
    sellingPricePesewas: 26000,
    unit: 'bottle',
    packSize: 60,
    dosageForm: 'Tablet',
    strength: 'Men\'s Multi + Saw Palmetto + CoQ10',
    manufacturer: 'NOW Foods',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-NOW-2026-ADAM',
    imageUrl: '/products/now-foods-adam-superior-mens-multi-60t.png',
  },
  {
    sku: 'NOW-ACV-180C',
    barcode: '733739033178',
    name: 'NOW Foods Apple Cider Vinegar 450 mg (180 Veg Capsules)',
    genericName: 'Apple Cider Vinegar Powder Dietary Supplement',
    description: 'Pure apple cider vinegar formulated into convenient vegetarian capsules without the harsh acidic taste of liquid vinegar. Promotes metabolic health, digestive comfort, and positive fluid balance. Non-GMO. 180 Veg Capsules.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierNOWId,
    type: 'supplement',
    costPricePesewas: 16000,
    sellingPricePesewas: 24000,
    unit: 'bottle',
    packSize: 180,
    dosageForm: 'Capsule',
    strength: '450 mg',
    manufacturer: 'NOW Foods',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 25,
    batchNumber: 'LOT-NOW-2026-ACV',
    imageUrl: '/products/now-foods-apple-cider-vinegar-450mg-180c.png',
  },
  {
    sku: 'NOW-CC-100T',
    barcode: '733739006035',
    name: 'NOW Foods Calcium Citrate (100 Tablets)',
    genericName: 'Calcium Citrate Bone Metabolism Formula with Minerals & Vitamin D-2',
    description: 'Highly bioavailable bone metabolism formula combining calcium citrate with vitamin D-2, magnesium, zinc, copper, and manganese to support strong bones and teeth. Vegetarian/Vegan, Non-GMO. 100 Tablets.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierNOWId,
    type: 'supplement',
    costPricePesewas: 15000,
    sellingPricePesewas: 22000,
    unit: 'bottle',
    packSize: 100,
    dosageForm: 'Tablet',
    strength: 'Calcium Citrate + Vitamin D-2 + Minerals',
    manufacturer: 'NOW Foods',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-NOW-2026-CC',
    imageUrl: '/products/now-foods-calcium-citrate-100t.png',
  },
  {
    sku: 'NOW-SPT-CRM-120C',
    barcode: '733739020352',
    name: 'NOW Sports Creatine Monohydrate 750 mg (120 Veg Capsules)',
    genericName: 'Creatine Monohydrate 750 mg Mass Building Capsules',
    description: 'NOW Sports Creatine Monohydrate helps build lean mass and fuels muscle energy production. Each serving delivers 750 mg of pure creatine monohydrate to maximize exercise performance and muscle endurance. Non-GMO, Informed-Sport certified. 120 Veg Capsules.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierNOWId,
    type: 'supplement',
    costPricePesewas: 16000,
    sellingPricePesewas: 24000,
    unit: 'bottle',
    packSize: 120,
    dosageForm: 'Capsule',
    strength: '750 mg Creatine Monohydrate',
    manufacturer: 'NOW Foods',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-NOW-2026-CREAT',
    imageUrl: '/products/now-sports-creatine-monohydrate-750mg-120c.png',
  },
  {
    sku: 'NOW-KID-DHA-60S',
    barcode: '733739016072',
    name: 'NOW Kids DHA Fish Oil Chewables (60 Softgels)',
    genericName: 'Bioavailable DHA Fish Oil Chewable Softgels for Kids',
    description: 'Delicious fruit-flavored, fish-shaped chewable softgels designed for children. Supports healthy brain function, cognitive development, and eye health with 100 mg of DHA per serving. GOED Omega-3 proud member, Non-GMO. 60 Softgels.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierNOWId,
    type: 'supplement',
    costPricePesewas: 13000,
    sellingPricePesewas: 19000,
    unit: 'bottle',
    packSize: 60,
    dosageForm: 'Softgel',
    strength: '100 mg DHA',
    manufacturer: 'NOW Foods',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 25,
    batchNumber: 'LOT-NOW-2026-KDHA',
    imageUrl: '/products/now-kids-dha-fish-oil-chewables-60s.png',
  },
  {
    sku: 'NOW-FA-250T',
    barcode: '733739004758',
    name: 'NOW Foods Folic Acid 800 mcg with Vitamin B-12 (250 Tablets)',
    genericName: 'Folic Acid 800 mcg with Vitamin B-12 25 mcg B-Complex',
    description: 'B-complex vitamin that supports healthy homocysteine metabolism and nervous system health. Formulated with 800 mcg of Folic Acid and 25 mcg of Vitamin B-12. Non-GMO, vegetarian/vegan. 250 Tablets.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierNOWId,
    type: 'supplement',
    costPricePesewas: 13000,
    sellingPricePesewas: 19000,
    unit: 'bottle',
    packSize: 250,
    dosageForm: 'Tablet',
    strength: '800 mcg Folic Acid + 25 mcg B-12',
    manufacturer: 'NOW Foods',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 25,
    batchNumber: 'LOT-NOW-2026-FA250',
    imageUrl: '/products/now-foods-folic-acid-800mcg-250t.png',
  },
  {
    sku: 'NOW-MC-100T',
    barcode: '733739012906',
    name: 'NOW Foods Magnesium Citrate 200 mg (100 Tablets)',
    genericName: 'Magnesium Citrate 200 mg Tablets',
    description: 'Highly bioavailable magnesium for nervous system support, muscle function, energy production, and critical enzyme activation. Non-GMO, vegetarian/vegan. 100 Tablets.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierNOWId,
    type: 'supplement',
    costPricePesewas: 15000,
    sellingPricePesewas: 22000,
    unit: 'bottle',
    packSize: 100,
    dosageForm: 'Tablet',
    strength: '200 mg Magnesium',
    manufacturer: 'NOW Foods',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-NOW-2026-MC100',
    imageUrl: '/products/now-foods-magnesium-citrate-200mg-100t.png',
  },
  {
    sku: 'NOW-LC-473ML',
    barcode: '733739026453',
    name: 'NOW Foods Liquid Chlorophyll (16 fl. oz. / 473 ml)',
    genericName: 'Sodium Copper Chlorophyllin Internal Deodorizer Liquid',
    description: 'Super concentrated liquid chlorophyll with over 90 servings. Functions as an internal deodorizer, promotes body cleansing, and freshens breath. Mint flavor. 16 fl. oz. (473 mL).',
    categoryId: suppCategoryId,
    primarySupplierId: supplierNOWId,
    type: 'supplement',
    costPricePesewas: 18000,
    sellingPricePesewas: 26000,
    unit: 'bottle',
    packSize: 473,
    dosageForm: 'Liquid',
    strength: '100 mg Chlorophyllin per 5 mL',
    manufacturer: 'NOW Foods',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-NOW-2026-LC473',
    imageUrl: '/products/now-foods-liquid-chlorophyll-473ml.png',
  },
  {
    sku: 'NOW-B12-5000',
    barcode: '733739004970',
    name: 'NOW Methyl B-12 5,000 mcg (90 Veg Capsules)',
    genericName: 'Methylcobalamin (Vitamin B-12) 5,000 mcg Veg Capsules',
    description: 'High potency Methylcobalamin B-12 for cellular energy production and nervous system health. Hypoallergenic vegetarian/vegan formula. 90 Veg Capsules.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierNOWId,
    type: 'supplement',
    costPricePesewas: 13500,
    sellingPricePesewas: 19500,
    unit: 'bottle',
    packSize: 90,
    dosageForm: 'Capsule',
    strength: '5,000 mcg Methylcobalamin',
    manufacturer: 'NOW Foods',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-NOW-2026-MB12',
    imageUrl: '/products/now-foods-methyl-b-12-5000mcg-90c.png',
  },
  {
    sku: 'NOW-PA-500MG-100C',
    barcode: '733739004857',
    name: 'NOW Foods Pantothenic Acid 500 mg (100 Veg Capsules)',
    genericName: 'Pantothenic Acid (Vitamin B-5) 500 mg Veg Capsules',
    description: 'B-complex vitamin that supports cellular energy production and adrenal function. Formulated with 500 mg of Vitamin B-5 per capsule. Non-GMO, vegetarian/vegan. 100 Veg Capsules.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierNOWId,
    type: 'supplement',
    costPricePesewas: 13000,
    sellingPricePesewas: 19000,
    unit: 'bottle',
    packSize: 100,
    dosageForm: 'Capsule',
    strength: '500 mg Vitamin B-5',
    manufacturer: 'NOW Foods',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 25,
    batchNumber: 'LOT-NOW-2026-PA100',
    imageUrl: '/products/now-foods-pantothenic-acid-500mg-100c.png',
  },
  {
    sku: 'NOW-WPR-20B-50C',
    barcode: '733739029287',
    name: 'NOW Foods Women\'s Probiotic 20 Billion (50 Veg Capsules)',
    genericName: 'Women\'s Probiotic 20 Billion CFU Feminine Flora Support',
    description: 'Specially formulated with 3 clinically tested probiotic strains to support feminine vaginal health and reduce occasional bloating. 20 Billion CFU per serving. 50 Veg Capsules.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierNOWId,
    type: 'supplement',
    costPricePesewas: 16000,
    sellingPricePesewas: 24000,
    unit: 'bottle',
    packSize: 50,
    dosageForm: 'Capsule',
    strength: '20 Billion CFU (3 Strains)',
    manufacturer: 'NOW Foods',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-NOW-2026-WPR50',
    imageUrl: '/products/now-foods-womens-probiotic-20-billion-50c.png',
  },
  {
    sku: 'NOW-KID-BD-60T',
    barcode: '733739029126',
    name: 'NOW Kids Berry Dophilus Chewables (60 Chewables)',
    genericName: 'Kids Berry Dophilus 2 Billion CFU 10 Strains Chewables',
    description: 'Delicious berry-flavored chewable probiotics for children providing 2 Billion CFU from 10 probiotic strains. Supports gastrointestinal health and immune function. 60 Chewables.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierNOWId,
    type: 'supplement',
    costPricePesewas: 13000,
    sellingPricePesewas: 19000,
    unit: 'bottle',
    packSize: 60,
    dosageForm: 'Chewable',
    strength: '2 Billion CFU (10 Strains)',
    manufacturer: 'NOW Foods',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 25,
    batchNumber: 'LOT-NOW-2026-KBD60',
    imageUrl: '/products/now-kids-berry-dophilus-chewables-60s.png',
  },
  {
    sku: 'NOW-THE-90C',
    barcode: '733739033635',
    name: 'NOW Foods Thyroid Energy (90 Veg Capsules)',
    genericName: 'Thyroid Energy Support with Iodine, Tyrosine, Guggul & Ashwagandha',
    description: 'Comprehensive nutritional supplement for the support of a healthy thyroid gland and normal metabolism. Features Iodine, Tyrosine, Zinc, Selenium, Guggul, and Ashwagandha. 90 Veg Capsules.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierNOWId,
    type: 'supplement',
    costPricePesewas: 16000,
    sellingPricePesewas: 24000,
    unit: 'bottle',
    packSize: 90,
    dosageForm: 'Capsule',
    strength: 'Thyroid Support Complex',
    manufacturer: 'NOW Foods',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-NOW-2026-THE90',
    imageUrl: '/products/now-foods-thyroid-energy-90c.png',
  },
  {
    sku: 'NOW-OMG3-1000-100S',
    barcode: '733739016508',
    name: 'NOW Foods Molecularly Distilled Omega-3 Fish Oil 1,000 mg (100 Softgels)',
    genericName: 'Molecularly Distilled Omega-3 Fish Oil 1000 mg Softgels',
    description: 'Cardiovascular support formula providing 1,000 mg of molecularly distilled fish oil (180 EPA / 120 DHA per softgel). Odor-controlled, GOED Omega-3 proud member. 100 Softgels.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierNOWId,
    type: 'supplement',
    costPricePesewas: 14000,
    sellingPricePesewas: 21000,
    unit: 'bottle',
    packSize: 100,
    dosageForm: 'Softgel',
    strength: '1,000 mg Fish Oil (180 EPA / 120 DHA)',
    manufacturer: 'NOW Foods',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 25,
    batchNumber: 'LOT-NOW-2026-OMG100',
    imageUrl: '/products/now-foods-omega-3-fish-oil-1000mg-100s.png',
  },
  {
    sku: 'NOW-BER-GLU-90S',
    barcode: '733739046642',
    name: 'NOW Berberine Glucose Support (90 Softgels)',
    genericName: 'Berberine HCl 400 mg with MCT Oil Glucose Support',
    description: 'Advanced glucose metabolism and lipid support formula combining Berberine HCl (400 mg) with Capric Acid (MCT Oil) for optimal bioavailability. 90 Softgels.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierNOWId,
    type: 'supplement',
    costPricePesewas: 18000,
    sellingPricePesewas: 26000,
    unit: 'bottle',
    packSize: 90,
    dosageForm: 'Softgel',
    strength: '400 mg Berberine HCl + MCT Oil',
    manufacturer: 'NOW Foods',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-NOW-2026-BERB90',
    imageUrl: '/products/now-berberine-glucose-support-90s.png',
  },
  {
    sku: 'NOW-HA-50MG-60C',
    barcode: '733739031556',
    name: 'NOW Foods Hyaluronic Acid 50 mg with MSM (60 Veg Capsules)',
    genericName: 'Hyaluronic Acid 50 mg with MSM 450 mg Joint Support',
    description: 'Important joint lubricant and structural component of skin and connective tissues. Features 50 mg of Hyaluronic Acid and 450 mg of MSM per serving. Non-GMO, vegetarian/vegan. 60 Veg Capsules.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierNOWId,
    type: 'supplement',
    costPricePesewas: 14000,
    sellingPricePesewas: 21000,
    unit: 'bottle',
    packSize: 60,
    dosageForm: 'Capsule',
    strength: '50 mg Hyaluronic Acid + 450 mg MSM',
    manufacturer: 'NOW Foods',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-NOW-2026-HA60',
    imageUrl: '/products/now-foods-hyaluronic-acid-50mg-60c.png',
  },
  {
    sku: 'NUT-SHI-1000-120C',
    barcode: '810014674780',
    name: 'Nutricost Shilajit 1,000 mg (120 Capsules / 60 Servings)',
    genericName: 'Pure Himalayan Shilajit Extract with Fulvic Acid 1000 mg',
    description: 'Potent Shilajit extract standardized with naturally occurring Fulvic Acid. Delivers 1,000 mg of Shilajit extract per serving to support vitality, energy production, and cognitive endurance. Non-GMO, gluten-free. 120 Capsules (60 Servings).',
    categoryId: suppCategoryId,
    primarySupplierId: supplierNUTId,
    type: 'supplement',
    costPricePesewas: 15000,
    sellingPricePesewas: 22000,
    unit: 'bottle',
    packSize: 120,
    dosageForm: 'Capsule',
    strength: '1,000 mg Shilajit Extract (Fulvic Acid)',
    manufacturer: 'Nutricost USA LLC',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 25,
    batchNumber: 'LOT-NUT-2026-SHI120',
    imageUrl: '/products/nutricost-shilajit-1000mg-120c.png',
  },
  {
    sku: 'PAL-AST-250ML',
    barcode: '010181072505',
    name: "Palmer's Skin Success Anti-Dark Spot Deep Cleansing Facial Astringent (250 ml)",
    genericName: 'Deep Cleansing Facial Astringent with Lactic Acid, Eucalyptus & Menthol',
    description: 'Palmer\'s Skin Success Deep Cleansing Facial Astringent unclogs pores, removes dirt and excess oil, and leaves skin clear and refreshed. Formulated with Lactic Acid, Eucalyptus, and Menthol. 250 ml / 8.5 fl. oz.',
    categoryId: skinCategoryId,
    primarySupplierId: supplierPALId,
    type: 'beauty',
    costPricePesewas: 8500,
    sellingPricePesewas: 13000,
    unit: 'bottle',
    packSize: 1,
    dosageForm: 'Astringent Toner',
    strength: 'Lactic Acid, Eucalyptus & Menthol',
    manufacturer: "E.T. Browne Drug Co. (Palmer's)",
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 25,
    batchNumber: 'LOT-PAL-2026-AST',
    imageUrl: '/products/palmers-skin-success-facial-astringent-250ml.png',
  },
  {
    sku: 'TBR-WHT-473ML',
    barcode: '697029500010',
    name: 'TheraBreath Whitening Fresh Breath Oral Rinse Dazzling Mint (473 ml)',
    genericName: 'Dentist Formulated Whitening Oral Rinse with Active Stain-Defense',
    description: 'Dentist formulated oral rinse designed to remove stains and prevent future staining while fighting bad breath for 24 hours. Gentle dazzling mint formula without peroxide or burning sensation. 16 fl. oz. (473 ml).',
    categoryId: skinCategoryId,
    primarySupplierId: supplierTBRId,
    type: 'beauty',
    costPricePesewas: 9500,
    sellingPricePesewas: 14500,
    unit: 'bottle',
    packSize: 1,
    dosageForm: 'Oral Rinse',
    strength: 'Stain-Defense Whitening + 24H Fresh Breath',
    manufacturer: 'Church & Dwight Co. (TheraBreath)',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-TBR-2026-WHT',
    imageUrl: '/products/therabreath-whitening-fresh-breath-oral-rinse-dazzling-mint-473ml.png',
  },
  {
    sku: 'TBR-GUM-473ML',
    barcode: '697029400013',
    name: 'TheraBreath Healthy Gums Oral Rinse Clean Mint (473 ml)',
    genericName: 'Dentist Formulated Antigingivitis / Antiplaque Oral Rinse with CPC',
    description: 'Helps fight gingivitis and reduces plaque buildup that leads to gum disease for 24 hours. Formulated with Cetylpyridinium Chloride (CPC) to reduce bleeding gums. Non-burning clean mint. 16 fl. oz. (473 ml).',
    categoryId: skinCategoryId,
    primarySupplierId: supplierTBRId,
    type: 'beauty',
    costPricePesewas: 9500,
    sellingPricePesewas: 14500,
    unit: 'bottle',
    packSize: 1,
    dosageForm: 'Oral Rinse',
    strength: '0.05% CPC Antiplaque & Antigingivitis',
    manufacturer: 'Church & Dwight Co. (TheraBreath)',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-TBR-2026-GUM',
    imageUrl: '/products/therabreath-healthy-gums-oral-rinse-clean-mint-473ml.png',
  },
  {
    sku: 'TBR-ACV-473ML',
    barcode: '697029600017',
    name: 'TheraBreath Anticavity Oral Rinse Sparkle Mint (473 ml)',
    genericName: 'Dentist Formulated Anticavity Fluoride Mouthrinse',
    description: 'Helps rebuild weakened tooth enamel and protects against cavities for 24 hours. Powered with sodium fluoride to strengthen teeth and freshen breath with a delightful sparkle mint flavor. 16 fl. oz. (473 ml).',
    categoryId: skinCategoryId,
    primarySupplierId: supplierTBRId,
    type: 'beauty',
    costPricePesewas: 9500,
    sellingPricePesewas: 14500,
    unit: 'bottle',
    packSize: 1,
    dosageForm: 'Oral Rinse',
    strength: 'Sodium Fluoride 0.05% Anticavity',
    manufacturer: 'Church & Dwight Co. (TheraBreath)',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-TBR-2026-ACV',
    imageUrl: '/products/therabreath-anticavity-oral-rinse-sparkle-mint-473ml.png',
  },
  {
    sku: 'TBR-MLD-473ML',
    barcode: '697029100012',
    name: 'TheraBreath Fresh Breath Oral Rinse Mild Mint (473 ml)',
    genericName: 'Dentist Formulated Powered by Oxygen Fresh Breath Oral Rinse',
    description: 'Clinical-strength oral rinse powered by oxygenating compounds to eliminate odor-causing bacteria instantly and maintain fresh breath for 24 hours. Alcohol-free, non-burning mild mint flavor. 16 fl. oz. (473 ml).',
    categoryId: skinCategoryId,
    primarySupplierId: supplierTBRId,
    type: 'beauty',
    costPricePesewas: 9500,
    sellingPricePesewas: 14500,
    unit: 'bottle',
    packSize: 1,
    dosageForm: 'Oral Rinse',
    strength: 'OXYD-8 Oxygenating Fresh Breath Formula',
    manufacturer: 'Church & Dwight Co. (TheraBreath)',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 25,
    batchNumber: 'LOT-TBR-2026-MLD',
    imageUrl: '/products/therabreath-fresh-breath-oral-rinse-mild-mint-473ml.png',
  },
  {
    sku: 'TBR-ICY-473ML',
    barcode: '697029200019',
    name: 'TheraBreath Fresh Breath Oral Rinse Invigorating Icy Mint (473 ml)',
    genericName: 'Dentist Formulated Powered by Oxygen Icy Mint Oral Rinse',
    description: 'Powered by active oxygen to target sulfur-producing bacteria for 24-hour fresh breath protection. Delivers an invigorating, crisp icy mint burst without alcohol burn. 16 fl. oz. (473 ml).',
    categoryId: skinCategoryId,
    primarySupplierId: supplierTBRId,
    type: 'beauty',
    costPricePesewas: 9500,
    sellingPricePesewas: 14500,
    unit: 'bottle',
    packSize: 1,
    dosageForm: 'Oral Rinse',
    strength: 'OXYD-8 Oxygenating + Icy Mint',
    manufacturer: 'Church & Dwight Co. (TheraBreath)',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 25,
    batchNumber: 'LOT-TBR-2026-ICY',
    imageUrl: '/products/therabreath-fresh-breath-oral-rinse-icy-mint-473ml.png',
  },
  {
    sku: 'TRM-RDR-16TB',
    barcode: '032917000195',
    name: 'Traditional Medicinals Organic Roasted Dandelion Root Tea (16 Tea Bags)',
    genericName: 'Organic Roasted Dandelion Root Herbal Detox & Digestion Tea',
    description: 'Rich and robust herbal tea traditionally used to stimulate liver function and support healthy digestion. USDA Organic, Non-GMO Project Verified, caffeine-free. 16 Wrapped Tea Bags (24g).',
    categoryId: digestCategoryId,
    primarySupplierId: supplierTRMId,
    type: 'supplement',
    costPricePesewas: 6500,
    sellingPricePesewas: 10000,
    unit: 'box',
    packSize: 16,
    dosageForm: 'Tea Bag',
    strength: '1,500 mg Organic Roasted Dandelion Root per Bag',
    manufacturer: 'Traditional Medicinals Inc.',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-TRM-2026-RDR',
    imageUrl: '/products/traditional-medicinals-organic-roasted-dandelion-root-tea-16tb.png',
  },
  {
    sku: 'TRM-RSP-16TB',
    barcode: '032917000301',
    name: 'Traditional Medicinals Organic Raspberry Leaf Tea (16 Tea Bags)',
    genericName: 'Organic Raspberry Leaf Herbal Tea for Menstrual & Uterine Support',
    description: 'Pleasantly mild and tannic herbal tea used for centuries to tone the uterus and soothe menstrual cramps. USDA Certified Organic, caffeine-free, herbal wellness support. 16 Wrapped Tea Bags (24g).',
    categoryId: herbalCategoryId,
    primarySupplierId: supplierTRMId,
    type: 'supplement',
    costPricePesewas: 6500,
    sellingPricePesewas: 10000,
    unit: 'box',
    packSize: 16,
    dosageForm: 'Tea Bag',
    strength: '1,500 mg Organic Raspberry Leaf per Bag',
    manufacturer: 'Traditional Medicinals Inc.',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-TRM-2026-RSP',
    imageUrl: '/products/traditional-medicinals-organic-raspberry-leaf-tea-16tb.png',
  },
  {
    sku: 'TLG-OVA-400G',
    barcode: '853381005001',
    name: 'Theralogix Ovasitol Inositol Powder Supplement (400 g)',
    genericName: 'Myo-Inositol & D-Chiro Inositol 40:1 Ratio Ovarian & Metabolic Support Powder',
    description: 'Evidence-based 40:1 inositol blend (2,000 mg Myo-Inositol + 50 mg D-Chiro-Inositol per dose) designed to promote healthy ovarian function, menstrual regularity, and metabolic balance. NSF Certified, unflavored powder. 400 g Canister (90-Day Supply).',
    categoryId: suppCategoryId,
    primarySupplierId: supplierTLGId,
    type: 'supplement',
    costPricePesewas: 48000,
    sellingPricePesewas: 69000,
    unit: 'canister',
    packSize: 400,
    dosageForm: 'Powder',
    strength: '40:1 Inositol Blend (2000mg Myo + 50mg D-Chiro per dose)',
    manufacturer: 'Theralogix LLC',
    countryOfOrigin: 'USA',
    reorderPoint: 3,
    reorderQty: 6,
    initialQty: 12,
    batchNumber: 'LOT-TLG-2026-OVA',
    imageUrl: '/products/theralogix-ovasitol-inositol-powder-400g.png',
  },
  {
    sku: 'TRM-GTP-16TB',
    barcode: '032917000782',
    name: 'Traditional Medicinals Organic Green Tea Peppermint (16 Tea Bags)',
    genericName: 'Organic Green Tea with Peppermint Herbal Blend',
    description: 'Refreshing organic green tea blended with cool, invigorating peppermint. Gently uplifting and antioxidant-rich daily herbal tea. USDA Organic, Non-GMO Project Verified. 16 Wrapped Tea Bags (24g).',
    categoryId: herbalCategoryId,
    primarySupplierId: supplierTRMId,
    type: 'supplement',
    costPricePesewas: 6500,
    sellingPricePesewas: 10000,
    unit: 'box',
    packSize: 16,
    dosageForm: 'Tea Bag',
    strength: 'Organic Green Tea Leaf + Peppermint Leaf',
    manufacturer: 'Traditional Medicinals Inc.',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-TRM-2026-GTP',
    imageUrl: '/products/traditional-medicinals-organic-green-tea-peppermint-16tb.png',
  },
  {
    sku: 'TRM-SMP-16TB',
    barcode: '032917000171',
    name: 'Traditional Medicinals Organic Smooth Move Senna Peppermint Tea (16 Tea Bags)',
    genericName: 'Organic Senna Leaf Herbal Stimulant Laxative Tea with Peppermint',
    description: 'America\'s #1 laxative tea. Formulated with organic senna leaf and soothing peppermint to provide gentle overnight relief from occasional constipation. USDA Organic, Non-GMO Verified. 16 Wrapped Tea Bags (32g).',
    categoryId: digestCategoryId,
    primarySupplierId: supplierTRMId,
    type: 'supplement',
    costPricePesewas: 6500,
    sellingPricePesewas: 10000,
    unit: 'box',
    packSize: 16,
    dosageForm: 'Tea Bag',
    strength: '1,080 mg Organic Senna Leaf per Bag',
    manufacturer: 'Traditional Medicinals Inc.',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-TRM-2026-SMP',
    imageUrl: '/products/traditional-medicinals-organic-smooth-move-senna-peppermint-16tb.png',
  },
  {
    sku: 'TRM-SMC-50C',
    barcode: '032917004018',
    name: 'Traditional Medicinals Smooth Move Herbal Laxative Senna Extract (50 Capsules)',
    genericName: 'Medicinal-Grade Organic Senna Extract Herbal Laxative Capsules',
    description: 'From the makers of America\'s #1 laxative tea. Convenient capsule form delivering medicinal-grade organic senna extract for gentle, predictable overnight constipation relief. Non-GMO, Organic Herbs. 50 Capsules.',
    categoryId: digestCategoryId,
    primarySupplierId: supplierTRMId,
    type: 'supplement',
    costPricePesewas: 11000,
    sellingPricePesewas: 16500,
    unit: 'box',
    packSize: 50,
    dosageForm: 'Capsule',
    strength: 'Standardized Sennosides (Medicinal-grade Senna Extract)',
    manufacturer: 'Traditional Medicinals Inc.',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-TRM-2026-SMC',
    imageUrl: '/products/traditional-medicinals-smooth-move-herbal-laxative-50c.png',
  },
  {
    sku: 'VIT-WWM-MAX',
    barcode: '5021265224037',
    name: 'Vitabiotics Wellwoman Max Maximum Support (Triple Pack)',
    genericName: 'Advanced Female Micronutrient Tablets + Omega 3-6-9 Capsules + Calcium & Vitamin D Tablets',
    description: 'Maximum comprehensive nutritional support in the Wellwoman range. Specially designed triple pack providing 33 bio-active nutrients, high purity Omega 3-6-9, and Calcium with Vitamin D to support energy, vitality, immunity, and bone strength. 84 Multi-Pack (3x28).',
    categoryId: suppCategoryId,
    primarySupplierId: supplierVITId,
    type: 'supplement',
    costPricePesewas: 28000,
    sellingPricePesewas: 39000,
    unit: 'box',
    packSize: 84,
    dosageForm: 'Tablet/Capsule',
    strength: '33 Bio-Active Nutrients + Omega 3-6-9 + Calcium D3',
    manufacturer: 'Vitabiotics Ltd UK',
    countryOfOrigin: 'UK',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-VIT-2026-WWM',
    imageUrl: '/products/vitabiotics-wellwoman-max-maximum-support.png',
  },
  {
    sku: 'VIT-WWP-56T',
    barcode: '5021265221059',
    name: 'Vitabiotics Wellwoman Plus Omega 3-6-9 (Dual Pack)',
    genericName: 'Female Comprehensive Multivitamin Tablets + Omega 3-6-9 Capsules with Starflower Oil',
    description: 'Advanced dual pack formulated to maintain health & vitality in women. Combines 26 key micronutrients with high-purity Omega 3-6-9 capsules containing Evening Primrose, Starflower, Fish, and Olive Oils for hormonal and cardiovascular balance. 56 Dual Pack (2x28).',
    categoryId: suppCategoryId,
    primarySupplierId: supplierVITId,
    type: 'supplement',
    costPricePesewas: 22000,
    sellingPricePesewas: 31000,
    unit: 'box',
    packSize: 56,
    dosageForm: 'Tablet/Capsule',
    strength: '26 Nutrients + Omega 3-6-9 (Starflower & EPO)',
    manufacturer: 'Vitabiotics Ltd UK',
    countryOfOrigin: 'UK',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-VIT-2026-WWP',
    imageUrl: '/products/vitabiotics-wellwoman-plus-omega-369.png',
  },
  // Set 31 New Products (Zazzee Naturals Batch)
  {
    sku: 'ZAZ-DIM-300-100C',
    barcode: '856230006314',
    name: 'Zazzee Naturals Extra Strength DIM 300 with 10 mg BioPerine (100 Vegan Capsules)',
    genericName: 'Diindolylmethane 300 mg with BioPerine & Pure Broccoli Powder',
    description: 'Extra strength Diindolylmethane (DIM 300 mg) fortified with pure organic Broccoli powder and 10 mg BioPerine black pepper extract for enhanced bioavailability. Formulated to support healthy estrogen balance, hormone regulation, clear skin, and vitality. 100 Vegan Capsules.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierZAZId,
    type: 'supplement',
    costPricePesewas: 16000,
    sellingPricePesewas: 24000,
    unit: 'bottle',
    packSize: 100,
    dosageForm: 'Vegan Capsule',
    strength: '300 mg DIM + 10 mg BioPerine',
    manufacturer: 'Zazzee Naturals LLC USA',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-ZAZ-2026-DIM',
    imageUrl: '/products/zazzee-naturals-extra-strength-dim-300mg-100c.png',
  },
  {
    sku: 'ZAZ-MLK-THI-120C',
    barcode: '856230006383',
    name: 'Zazzee Naturals Organic Milk Thistle 7,500 mg Strength 30:1 Extract (120 Veggie Caps)',
    genericName: 'Certified Organic Silybum Marianum Seed Extract (80% Silymarin Flavonoids)',
    description: 'USDA Certified Organic Milk Thistle delivering maximum concentration 30:1 extract standardized to 80% Silymarin Flavonoids (equivalent to 7,500 mg raw milk thistle seed per capsule). Potent botanical support for liver cleansing, detoxification, hepatic cellular defense, and antioxidant vitality.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierZAZId,
    type: 'supplement',
    costPricePesewas: 16000,
    sellingPricePesewas: 24000,
    unit: 'bottle',
    packSize: 120,
    dosageForm: 'Veggie Capsule',
    strength: '7,500 mg Strength (250 mg 30:1 Organic Extract, 80% Silymarin)',
    manufacturer: 'Zazzee Naturals LLC USA',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-ZAZ-2026-MLK',
    imageUrl: '/products/zazzee-naturals-organic-milk-thistle-7500mg-120c.png',
  },
  {
    sku: 'ZAZ-SHI-7000-120C',
    barcode: '856230006499',
    name: 'Zazzee Naturals Extra Strength Shilajit 7,000 mg Strength 20:1 Extract (120 Veggie Caps)',
    genericName: 'Purified Himalayan Shilajit Extract Standardized to 50% Fulvic Acid',
    description: 'Extra strength Himalayan Shilajit 20:1 extract delivering 7,000 mg equivalent strength per capsule, standardized to contain a minimum 50% Fulvic Acid plus naturally occurring trace minerals. Enhances cellular energy (ATP production), vitality, memory, stamina, and cognitive performance.',
    categoryId: suppCategoryId,
    primarySupplierId: supplierZAZId,
    type: 'supplement',
    costPricePesewas: 17000,
    sellingPricePesewas: 25000,
    unit: 'bottle',
    packSize: 120,
    dosageForm: 'Veggie Capsule',
    strength: '7,000 mg Strength (350 mg 20:1 Extract, 50% Fulvic Acid)',
    manufacturer: 'Zazzee Naturals LLC USA',
    countryOfOrigin: 'USA',
    reorderPoint: 5,
    reorderQty: 10,
    initialQty: 20,
    batchNumber: 'LOT-ZAZ-2026-SHI',
    imageUrl: '/products/zazzee-naturals-extra-strength-shilajit-7000mg-120c.png',
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

console.log('\n🎉 Successfully seeded Set 23 extracted inventory products!');
