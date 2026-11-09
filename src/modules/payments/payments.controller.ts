import { Body, Controller, Get, Headers, Param, Post, Query, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { InitializePaystackDto } from './dto/initialize-paystack.dto';
import { RequestMomoDto } from './dto/request-momo.dto';
import { InitializeStanbicDto } from './dto/initialize-stanbic.dto';
import { InitializeNgeniusDto, InitializeNgeniusSchema } from './dto/initialize-ngenius.dto';
import { PaymentsService } from './payments.service';
import { NgeniusService } from './ngenius.service';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly ngeniusService: NgeniusService,
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

  // ── N-Genius (Network International) Hosted Payment Page ─────────────────
  @Public()
  @Post('ngenius/initialize')
  async initializeNgenius(
    @Body(new ZodValidationPipe(InitializeNgeniusSchema)) dto: InitializeNgeniusDto,
  ) {
    return this.ngeniusService.initializePayment(dto);
  }

  @Public()
  @Get('ngenius/status')
  async ngeniusStatus(@Query('order') order: string) {
    return this.ngeniusService.getOrderStatus(order);
  }

  @Public()
  @Post('ngenius/webhook')
  async ngeniusWebhook(@Body() payload: any) {
    return this.ngeniusService.handleWebhook(payload);
  }
}
