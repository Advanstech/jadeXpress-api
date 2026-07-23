import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { InventoryService } from './src/modules/inventory/inventory.service';
import { DRIZZLE } from './src/database/database.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const inventoryService = app.get(InventoryService);
  try {
    const batches = await inventoryService.getBatches('a433c66c-eca3-403f-a872-677ae1840037', undefined as any);
    console.log("SUCCESS:", batches);
  } catch (e) {
    console.error("QUERY ERROR:", e.message);
  }
  await app.close();
}
bootstrap();
