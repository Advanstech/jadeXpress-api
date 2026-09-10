import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { StorefrontController } from './storefront.controller';
import { TransferController } from './transfer.controller';
import { InventoryService } from './inventory.service';
import { TransferService } from './transfer.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [RealtimeModule, AiModule],
  controllers: [InventoryController, StorefrontController, TransferController],
  providers: [InventoryService, TransferService],
  exports: [InventoryService, TransferService],
})
export class InventoryModule {}
