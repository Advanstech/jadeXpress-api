import { eq } from 'drizzle-orm';
import { stockBatches } from './src/database/schema';

try {
  eq(stockBatches.storeId, undefined as any);
} catch (e) {
  console.log("Error caught:", e.message);
}
