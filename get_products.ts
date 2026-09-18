import { db } from './src/db';
import { products } from './src/db/schema';
import { ilike } from 'drizzle-orm';

async function main() {
  const p1 = await db.select().from(products).where(ilike(products.name, '%Fish Oil%')).limit(1);
  const p2 = await db.select().from(products).where(ilike(products.name, '%Ogx%')).limit(1);
  console.log('Fish Oil:', p1[0]?.id, p1[0]?.name);
  console.log('Ogx:', p2[0]?.id, p2[0]?.name);
}
main().catch(console.error);
