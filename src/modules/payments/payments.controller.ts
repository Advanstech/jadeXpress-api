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
    const result = await this.paymentsService.initializePaystack(dto);
    return { success: true, data: result };
  }

  @Public()
  @Get('paystack/verify/:reference')
  async verifyPaystack(@Param('reference') reference: string) {
    const result = await this.paymentsService.verifyPaystack(reference);
    return { success: true, data: result };
  }

  @Public()
  @Post('momo/request')
  async requestMomo(@Body() dto: RequestMomoDto) {
    const result = await this.paymentsService.requestMomo(dto);
    return { success: true, data: result };
  }

  @Public()
  @Get('paystack/key')
  getPaystackPublicKey() {
    return {
      success: true,
      data: { publicKey: this.config.get('payments.paystackPublicKey') },
    };
  }
}
