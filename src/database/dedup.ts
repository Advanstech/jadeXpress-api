import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { products, stockItems, stockBatches, stockMovements } from './schema';
import { eq, desc, inArray } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function dedup() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  console.log('Fetching all products...');
  const allProducts = await db.select().from(products);
  const allStockItems = await db.select().from(stockItems);

  // Group by lowercase name
  const nameGroups: Record<string, typeof allProducts> = {};
  for (const p of allProducts) {
    const key = p.name.trim().toLowerCase();
    if (!nameGroups[key]) nameGroups[key] = [];
    nameGroups[key].push(p);
  }

  let deletedCount = 0;
  let mergedStock = 0;

  for (const [name, group] of Object.entries(nameGroups)) {
    if (group.length > 1) {
      console.log(`\nFound ${group.length} duplicates for: "${name}"`);
      
      // Calculate total stock for each to decide the primary
      const groupWithStock = group.map(p => {
        const pStock = allStockItems.filter(si => si.productId === p.id).reduce((sum, si) => sum + si.quantityOnHand, 0);
        return { ...p, totalStock: pStock };
      });

      // Sort by stock descending, then by creation date ascending (keep oldest)
      groupWithStock.sort((a, b) => b.totalStock - a.totalStock || a.createdAt.getTime() - b.createdAt.getTime());

      const primary = groupWithStock[0];
      const duplicates = groupWithStock.slice(1);

      console.log(`  -> Keeping ID: ${primary.id} (Stock: ${primary.totalStock})`);

      for (const dup of duplicates) {
        console.log(`  -> Merging duplicate ID: ${dup.id} (Stock: ${dup.totalStock})`);
        
        // 1. Move stock batches to primary
        await db.update(stockBatches).set({ productId: primary.id }).where(eq(stockBatches.productId, dup.id));
        
        // 2. Move stock movements to primary
        await db.update(stockMovements).set({ productId: primary.id }).where(eq(stockMovements.productId, dup.id));

        // 3. Merge stock items
        const dupStockItems = allStockItems.filter(si => si.productId === dup.id);
        for (const dsi of dupStockItems) {
          const primaryStockItem = allStockItems.find(si => si.productId === primary.id && si.storeId === dsi.storeId);
          if (primaryStockItem) {
            // Add quantity
            await db.update(stockItems)
              .set({ quantityOnHand: primaryStockItem.quantityOnHand + dsi.quantityOnHand })
              .where(eq(stockItems.id, primaryStockItem.id));
            primaryStockItem.quantityOnHand += dsi.quantityOnHand;
            mergedStock += dsi.quantityOnHand;
            
            // Delete the duplicate stock item
            await db.delete(stockItems).where(eq(stockItems.id, dsi.id));
          } else {
            // Just update productId
            await db.update(stockItems).set({ productId: primary.id }).where(eq(stockItems.id, dsi.id));
          }
        }

        // 4. Update primary supplier if primary doesn't have one but dup does
        if (!primary.primarySupplierId && dup.primarySupplierId) {
          await db.update(products).set({ primarySupplierId: dup.primarySupplierId }).where(eq(products.id, primary.id));
          primary.primarySupplierId = dup.primarySupplierId;
        }

        // 5. Delete duplicate product
        await db.delete(products).where(eq(products.id, dup.id));
        deletedCount++;
      }
    }
  }

  console.log(`\nDeduplication complete! Deleted ${deletedCount} duplicate products. Merged ${mergedStock} stock quantity.`);
}

dedup().catch(console.error);
