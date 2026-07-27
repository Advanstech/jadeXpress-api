import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AccountingService } from './accounting.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationSchema } from '../../common/dto/pagination.dto';
import { z } from 'zod';

const LedgerQuerySchema = PaginationSchema.extend({
  from: z.string().optional(),
  to: z.string().optional(),
  category: z.string().optional(),
});

@ApiTags('accounting')
@ApiBearerAuth()
@Roles('manager', 'owner')
@Controller('accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('pl')
  @ApiOperation({ summary: 'P&L aggregated (daily/weekly/monthly)' })
  getPL(
    @CurrentUser() user: JwtPayload,
    @Query('period') period?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const dates = this.calculateDates(period, from, to);
    return this.accountingService.getAggregatedPL(user.storeId, dates.from, dates.to);
  }

  @Get('cash-flow')
  @ApiOperation({ summary: 'Daily cash flow (inflows vs outflows from ledger)' })
  getCashFlow(
    @CurrentUser() user: JwtPayload,
    @Query('period') period?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const dates = this.calculateDates(period, from, to);
    return this.accountingService.getCashFlow(user.storeId, dates.from, dates.to);
  }

  @Get('tax')
  @ApiOperation({ summary: 'Ghana VAT/NHIL/GETFund summary for a period' })
  getTaxSummary(
    @CurrentUser() user: JwtPayload,
    @Query('period') period?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const dates = this.calculateDates(period, from, to);
    return this.accountingService.getTaxSummary(user.storeId, dates.from, dates.to);
  }

  private calculateDates(period?: string, from?: string, to?: string) {
    if (from && to) return { from, to };
    
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case 'today':
      case 'day':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'month':
      default:
        startDate.setDate(now.getDate() - 30);
        break;
    }
    
    return { 
      from: from || startDate.toISOString(), 
      to: to || now.toISOString() 
    };
  }

  @Get('ledger')
  @ApiOperation({ summary: 'Double-entry ledger entries (paginated)' })
  getLedger(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(LedgerQuerySchema)) query: any,
  ) {
    return this.accountingService.getLedger(user.storeId, query);
  }

  @Post('snapshot')
  @ApiOperation({ summary: 'Compute/refresh daily P&L snapshot for a given date' })
  computeSnapshot(
    @CurrentUser() user: JwtPayload,
    @Body() body: { date: string },
  ) {
    return this.accountingService.computeDailySnapshot(user.storeId, body.date);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export P&L data (JSON or CSV)' })
  export(
    @CurrentUser() user: JwtPayload,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('format') format: 'json' | 'csv' = 'json',
  ) {
    return this.accountingService.exportPL(user.storeId, from, to, format);
  }
}
