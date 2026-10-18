import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PaymentAuthorizationsService } from './payment-authorizations.service';
import {
  createPaymentAuthorizationSchema,
  approvePaymentAuthorizationSchema,
  rejectPaymentAuthorizationSchema,
  disbursePaymentAuthorizationSchema,
  CreatePaymentAuthorizationDto,
  ApprovePaymentAuthorizationDto,
  RejectPaymentAuthorizationDto,
  DisbursePaymentAuthorizationDto,
} from './dto/payment-authorizations.dto';

@ApiTags('Payment Authorizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payment-authorizations')
export class PaymentAuthorizationsController {
  constructor(
    private readonly paymentAuthorizationsService: PaymentAuthorizationsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List payment authorizations with status, category, branch, and date filters',
  })
  async list(
    @Query('storeId') storeId?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.paymentAuthorizationsService.list({
      storeId,
      status,
      category,
      search,
      from,
      to,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get summary metrics and KPIs for payment authorizations' })
  async getStats(@Query('storeId') storeId?: string) {
    return this.paymentAuthorizationsService.getStats(storeId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a payment authorization including OCR receipt data' })
  async getById(@Param('id') id: string) {
    return this.paymentAuthorizationsService.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Submit a new payment authorization request (manual or AI scanned)' })
  async create(
    @Body(new ZodValidationPipe(createPaymentAuthorizationSchema))
    dto: CreatePaymentAuthorizationDto,
    @Req() req: any,
  ) {
    return this.paymentAuthorizationsService.create(dto, req.user?.id);
  }

  @Post('ai-scan')
  @ApiOperation({ summary: 'Scan receipt with Gemini Vision OCR and extract payment details' })
  async scanReceipt(
    @Body() body: { imageUrl?: string; base64Image?: string },
  ) {
    return this.paymentAuthorizationsService.scanReceipt(body);
  }

  @Put(':id/approve')
  @Roles('owner', 'root', 'super_admin', 'manager', 'supervisor')
  @ApiOperation({ summary: 'Authorize / approve a payment request' })
  async approve(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(approvePaymentAuthorizationSchema))
    dto: ApprovePaymentAuthorizationDto,
    @Req() req: any,
  ) {
    return this.paymentAuthorizationsService.approve(id, req.user?.id, dto);
  }

  @Put(':id/reject')
  @Roles('owner', 'root', 'super_admin', 'manager', 'supervisor')
  @ApiOperation({ summary: 'Reject a payment authorization request' })
  async reject(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rejectPaymentAuthorizationSchema))
    dto: RejectPaymentAuthorizationDto,
    @Req() req: any,
  ) {
    return this.paymentAuthorizationsService.reject(id, req.user?.id, dto);
  }

  @Put(':id/disburse')
  @Roles('owner', 'root', 'super_admin', 'manager')
  @ApiOperation({
    summary: 'Record payment disbursement, sync with ledger double-entry and invoice balances',
  })
  async disburse(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(disbursePaymentAuthorizationSchema))
    dto: DisbursePaymentAuthorizationDto,
    @Req() req: any,
  ) {
    return this.paymentAuthorizationsService.disburse(id, req.user?.id, dto);
  }
}
