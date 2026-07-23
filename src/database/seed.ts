import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as bcrypt from 'bcrypt';
import { organisation, stores, staffProfile } from './schema';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  console.log('Seeding database...');

  // 1. Create Organisation
  const [org] = await db.insert(organisation).values({
    name: 'JadeXpress Enterprise',
    tradingName: 'The Vitamin Shop',
    currencyCode: 'GHS',
  }).returning();
  console.log('✅ Created Organisation:', org.name);

  // 2. Create Store
  const [store] = await db.insert(stores).values({
    organisationId: org.id,
    code: 'ISR',
    name: 'Accra Main Branch (Israel)',
    city: 'Accra',
  }).returning();
  console.log('✅ Created Store:', store.name);

  // 3. Create Root Admin Staff
  const pinHash = await bcrypt.hash('1234', 12);
  const [staff] = await db.insert(staffProfile).values({
    storeId: store.id,
    firstName: 'Kwame',
    lastName: 'Mensah',
    email: 'kwame@jadexpressgh.com',
    phone: '+233 55 000 0001',
    role: 'owner',
    pinHash,
    isActive: true,
  }).returning();
  
  console.log('✅ Created Root User:', staff.firstName, staff.lastName);
  console.log('📌 Login with PIN: 1234');

  console.log('🎉 Seeding complete!');
}

seed().catch(console.error);
