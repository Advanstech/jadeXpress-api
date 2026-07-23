import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StockIntelligenceService } from './stock-intelligence.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

const ForecastQuerySchema = z.object({
  productId: z.string().uuid(),
  horizonDays: z.coerce.number().int().min(7).max(365).default(30),
});

const UpsellSchema = z.object({
  productIds: z.array(z.string().uuid()).min(1),
});

@ApiTags('stock-intelligence')
@ApiBearerAuth()
@Controller('stock-intelligence')
export class StockIntelligenceController {
  constructor(private readonly service: StockIntelligenceService) {}

  @Get('forecast')
  @ApiOperation({ summary: 'Demand forecast for a product [MOCKED_PENDING_MODEL_INTEGRATION]' })
  getForecast(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(ForecastQuerySchema)) query: any,
  ) {
    return this.service.getDemandForecast(query.productId, user.storeId, query.horizonDays);
  }

  @Get('reorder')
  @ApiOperation({ summary: 'Reorder suggestions for current store [MOCKED_PENDING_MODEL_INTEGRATION]' })
  getReorder(@CurrentUser() user: JwtPayload) {
    return this.service.getReorderSuggestions(user.storeId);
  }

  @Get('expiry-risk')
  @ApiOperation({ summary: 'Expiry risk report — batches expiring within 90 days' })
  getExpiryRisk(@CurrentUser() user: JwtPayload) {
    return this.service.getExpiryRiskReport(user.storeId);
  }

  @Post('upsell')
  @ApiOperation({ summary: 'Upsell/cross-sell suggestions for cart items [MOCKED_PENDING_MODEL_INTEGRATION]' })
  getUpsell(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(UpsellSchema)) body: { productIds: string[] },
  ) {
    return this.service.getUpsellSuggestions(body.productIds, user.storeId);
  }

  @Post('refresh')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Trigger forecast refresh for all products in store [MOCKED_PENDING_MODEL_INTEGRATION]' })
  triggerRefresh(@CurrentUser() user: JwtPayload) {
    return this.service.triggerForecastRefresh(user.storeId);
  }
}
