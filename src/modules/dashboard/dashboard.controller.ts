import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('dashboard')
@ApiBearerAuth()
@Roles('manager', 'supervisor', 'owner')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'Aggregated KPI cards — today + month + inventory alerts' })
  getKpis(@CurrentUser() user: JwtPayload) {
    return this.dashboardService.getKpis(user.storeId);
  }

  @Get('live-feed')
  @ApiOperation({ summary: 'Recent sales live feed (last N transactions)' })
  getLiveFeed(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    return this.dashboardService.getLiveFeed(user.storeId, limit ? parseInt(limit) : 10);
  }

  @Get('sparkline')
  @ApiOperation({ summary: 'Revenue sparkline for last N days (default 14)' })
  getSparkline(@CurrentUser() user: JwtPayload, @Query('days') days?: string) {
    return this.dashboardService.getRevenueSparkline(user.storeId, days ? parseInt(days) : 14);
  }
}
