import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { DRIZZLE } from './src/database/database.module';
import { stockBatches } from './src/database/schema';
import { eq } from 'drizzle-orm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const db = app.get(DRIZZLE);
  
  try {
    const batches = await db.select().from(stockBatches).where(eq(stockBatches.productId, 'a433c66c-eca3-403f-a872-677ae1840037'));
    console.log("BATCHES:", batches);
  } catch (e) {
    console.error("DB ERROR:", e);
  }
  await app.close();
}
bootstrap();
