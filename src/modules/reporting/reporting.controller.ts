import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportingService } from './reporting.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('reporting')
@ApiBearerAuth()
@Roles('manager', 'supervisor', 'owner')
@Controller('reporting')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Sales KPI summary for period' })
  getSummary(@CurrentUser() u: JwtPayload, @Query('from') from: string, @Query('to') to: string) {
    return this.reportingService.getSalesSummary(u.storeId, from, to);
  }

  @Get('by-day')
  @ApiOperation({ summary: 'Daily revenue chart data' })
  getByDay(@CurrentUser() u: JwtPayload, @Query('from') from: string, @Query('to') to: string) {
    return this.reportingService.getSalesByDay(u.storeId, from, to);
  }

  @Get('top-products')
  @ApiOperation({ summary: 'Top-selling products by revenue' })
  getTopProducts(
    @CurrentUser() u: JwtPayload,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('limit') limit?: string,
  ) {
    return this.reportingService.getTopProducts(u.storeId, from, to, limit ? parseInt(limit) : 10);
  }

  @Get('by-cashier')
  @ApiOperation({ summary: 'Per-cashier performance' })
  getByCashier(@CurrentUser() u: JwtPayload, @Query('from') from: string, @Query('to') to: string) {
    return this.reportingService.getPerCashierPerformance(u.storeId, from, to);
  }

  @Get('by-category')
  @ApiOperation({ summary: 'Per-category revenue performance' })
  getByCategory(@CurrentUser() u: JwtPayload, @Query('from') from: string, @Query('to') to: string) {
    return this.reportingService.getPerCategoryPerformance(u.storeId, from, to);
  }

  @Get('heatmap')
  @ApiOperation({ summary: 'Hourly/day-of-week transaction heatmap' })
  getHeatmap(@CurrentUser() u: JwtPayload, @Query('from') from: string, @Query('to') to: string) {
    return this.reportingService.getHourlyHeatmap(u.storeId, from, to);
  }
}
