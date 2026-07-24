import { Module } from '@nestjs/common';
import { EodController } from './eod.controller';
import { EodService } from './eod.service';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [RealtimeModule],
  controllers: [EodController],
  providers: [EodService],
  exports: [EodService],
})
export class EodModule {}
