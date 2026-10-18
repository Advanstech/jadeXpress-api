import { Module } from '@nestjs/common';
import { PaymentAuthorizationsController } from './payment-authorizations.controller';
import { PaymentAuthorizationsService } from './payment-authorizations.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [RealtimeModule, AiModule],
  controllers: [PaymentAuthorizationsController],
  providers: [PaymentAuthorizationsService],
  exports: [PaymentAuthorizationsService],
})
export class PaymentAuthorizationsModule {}
