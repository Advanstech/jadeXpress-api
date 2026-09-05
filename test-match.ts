import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AiService } from './src/modules/ai/ai.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const aiService = app.get(AiService);
  
  const extractedItems = Array.from({length: 30}, (_, i) => `Item ${i}`);
  const catalog = [{ id: "1", name: "Item 1" }];
  
  try {
    const res = await aiService.matchProducts(extractedItems, catalog as any);
    console.log("SUCCESS:", res);
  } catch (e) {
    console.error("ERROR:", e);
  }
  
  await app.close();
}
bootstrap();
