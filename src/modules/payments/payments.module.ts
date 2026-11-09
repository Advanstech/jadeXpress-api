import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { NgeniusService } from './ngenius.service';

@Module({
  imports: [ConfigModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, NgeniusService],
  exports: [PaymentsService, NgeniusService],
})
export class PaymentsModule {}
