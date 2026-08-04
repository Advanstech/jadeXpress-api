import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eodRecords } from './schema';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  console.log('Truncating eod_record table to allow schema push...');
  await db.delete(eodRecords);
  console.log('Truncated.');
}

main().catch(console.error);
