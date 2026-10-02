import { Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import { InitializePaystackDto } from './dto/initialize-paystack.dto';
import { RequestMomoDto } from './dto/request-momo.dto';
import { InitializeStanbicDto } from './dto/initialize-stanbic.dto';
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

  // ── Stanbic Bank Ghana / Advansis Gateway Endpoints ──────────────────────
  @Public()
  @Post('stanbic/initialize')
  async initializeStanbic(@Body() dto: InitializeStanbicDto) {
    return this.paymentsService.initializeStanbic(dto);
  }

  @Public()
  @Get('stanbic/status/:reference')
  async getStanbicStatus(@Param('reference') reference: string) {
    return this.paymentsService.verifyStanbic(reference);
  }

  @Public()
  @Post('stanbic/webhook')
  async handleStanbicWebhook(
    @Req() req: any,
    @Body() payload: any,
    @Headers('x-stanbic-signature') signature?: string,
  ) {
    // Cryptographically verify signature if present
    const rawBody = JSON.stringify(payload);
    if (signature) {
      const isValid = this.paymentsService.verifyWebhookSignature(rawBody, signature);
      if (!isValid) {
        return { status: 'rejected', message: 'Invalid cryptographic signature' };
      }
    }
    return { status: 'received', reference: payload?.reference };
  }
}
