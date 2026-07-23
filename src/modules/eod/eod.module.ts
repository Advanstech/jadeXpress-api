import { Module } from '@nestjs/common';
import { EodController } from './eod.controller';
import { EodService } from './eod.service';

@Module({
  controllers: [EodController],
  providers: [EodService],
  exports: [EodService],
})
export class EodModule {}
