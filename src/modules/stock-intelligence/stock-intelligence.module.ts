import { Module } from '@nestjs/common';
import { StockIntelligenceController } from './stock-intelligence.controller';
import { StockIntelligenceService } from './stock-intelligence.service';

@Module({
  controllers: [StockIntelligenceController],
  providers: [StockIntelligenceService],
  exports: [StockIntelligenceService],
})
export class StockIntelligenceModule {}
