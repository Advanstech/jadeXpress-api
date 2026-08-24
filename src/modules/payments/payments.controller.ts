import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import { InitializePaystackDto } from './dto/initialize-paystack.dto';
import { RequestMomoDto } from './dto/request-momo.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('paystack/initialize')
  async initializePaystack(@Body() dto: InitializePaystackDto) {
    return this.paymentsService.initializePaystack(dto);
  }

  @Public()
  @Get('paystack/verify/:reference')
  async verifyPaystack(@Param('reference') reference: string) {
    return this.paymentsService.verifyPaystack(reference);
  }

  @Public()
  @Post('momo/request')
  async requestMomo(@Body() dto: RequestMomoDto) {
    return this.paymentsService.requestMomo(dto);
  }

  @Public()
  @Get('paystack/key')
  getPaystackPublicKey() {
    return { publicKey: this.config.get('payments.paystackPublicKey') };
  }
}
