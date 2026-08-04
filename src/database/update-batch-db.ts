import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { products } from './schema';
import { ilike, eq } from 'drizzle-orm';

async function updateBatchProducts() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  console.log('🔄 Updating database image URLs for Aveeno, Anua Cleansing Oil, and Aquatabs...');

  const allProducts = await db.select().from(products);

  for (const prod of allProducts) {
    const name = prod.name.toLowerCase();
    let targetUrl: string | null = null;

    if (name.includes('aveeno') && (name.includes('709') || name.includes('24'))) {
      targetUrl = '/products/aveeno-daily-moisturizing-709ml.png';
    } else if (name.includes('aveeno') && (name.includes('532') || name.includes('18'))) {
      targetUrl = '/products/aveeno-daily-moisturizing-532ml.png';
    } else if (name.includes('aveeno') && !name.includes('709') && !name.includes('532')) {
      // Default Aveeno Daily Moisturizing if un-specified
      targetUrl = '/products/aveeno-daily-moisturizing-532ml.png';
    } else if (name.includes('anua') && name.includes('oil')) {
      targetUrl = '/products/anua-cleansing-oil.png';
    } else if (name.includes('aquatabs')) {
      targetUrl = '/products/aquatabs-multipurpose-200.png';
    }

    if (targetUrl) {
      await db.update(products).set({ imageUrl: targetUrl }).where(eq(products.id, prod.id));
      console.log(`✅ Updated ${prod.name} -> ${targetUrl}`);
    }
  }

  console.log('🎉 Batch database update completed!');
}

updateBatchProducts().catch(console.error);
