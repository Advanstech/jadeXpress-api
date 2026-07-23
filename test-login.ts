import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { staffProfile } from './src/database/schema';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

async function run() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);
  const [staff] = await db.select().from(staffProfile).limit(1);
  
  console.log(`Testing with staff: ${staff.email}, ID: ${staff.id}, Store: ${staff.storeId}`);
  
  const res = await fetch('http://localhost:3001/api/v1/auth/pin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      staffId: staff.id,
      storeId: staff.storeId,
      pin: '1234'
    })
  });
  const data = await res.json();
  console.log(data);
}
run();
