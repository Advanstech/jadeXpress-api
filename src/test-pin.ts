import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as bcrypt from 'bcrypt';
import { staffProfile } from './database/schema';

async function testPin() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  const staff = await db.select().from(staffProfile);
  console.log('Staff members:', staff.length);

  for (const s of staff) {
    console.log(`Testing PIN for ${s.firstName} ${s.lastName} (Role: ${s.role}):`);
    console.log(`pinHash: ${s.pinHash}`);
    const valid = await bcrypt.compare('1234', s.pinHash || '');
    console.log(`Compare '1234' with pinHash: ${valid}`);
  }
}

testPin().catch(console.error);
