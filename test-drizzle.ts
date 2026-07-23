import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { InventoryService } from './src/modules/inventory/inventory.service';
import { stores } from './src/database/schema';
import { DRIZZLE } from './src/database/database.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const db = app.get(DRIZZLE);
  const store = await db.select().from(stores).limit(1);
  const storeId = store[0].id;
  
  const inventoryService = app.get(InventoryService);
  try {
    const batches = await inventoryService.getBatches('a433c66c-eca3-403f-a872-677ae1840037', storeId);
    console.log(batches);
  } catch (e) {
    console.error("ERROR:", e);
  }
  await app.close();
}
bootstrap();
