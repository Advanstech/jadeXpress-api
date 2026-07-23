import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as bcrypt from 'bcrypt';
import { staffProfile } from './src/database/schema';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

async function run() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);
  const staff = await db.select().from(staffProfile).limit(5);
  for (const s of staff) {
    const isMatch = await bcrypt.compare('1234', s.pinHash);
    console.log(`Staff ${s.email}: PIN '1234' matches? ${isMatch}, Hash: ${s.pinHash.substring(0, 15)}...`);
  }
}
run();
