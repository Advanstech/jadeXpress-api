import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { StorefrontController } from './storefront.controller';
import { InventoryService } from './inventory.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [RealtimeModule, AiModule],
  controllers: [InventoryController, StorefrontController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
