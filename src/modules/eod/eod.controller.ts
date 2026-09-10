import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EodService } from './eod.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationSchema } from '../../common/dto/pagination.dto';
import { InitEodSchema, InitEodDto, CloseEodSchema, CloseEodDto } from './dto/eod.dto';

@ApiTags('eod')
@ApiBearerAuth()
@Controller('eod')
export class EodController {
  constructor(private readonly eodService: EodService) {}

  @Get()
  @Roles('manager', 'supervisor', 'owner', 'cashier', 'pharmacist')
  @ApiOperation({ summary: 'List EOD records for current store' })
  list(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(PaginationSchema)) query: any,
  ) {
    return this.eodService.list(user.storeId, query);
  }

  @Get(':date')
  @Roles('manager', 'supervisor', 'owner', 'cashier', 'pharmacist')
  @ApiOperation({ summary: 'Get EOD record by date (YYYY-MM-DD)' })
  getByDate(@Param('date') date: string, @CurrentUser() user: JwtPayload) {
    return this.eodService.getByDate(user.storeId, date);
  }

  @Post('init')
  @Roles('manager', 'supervisor', 'owner', 'cashier', 'pharmacist')
  @ApiOperation({ summary: 'Initialise EOD — activates the day for this store' })
  initEod(
    @Body(new ZodValidationPipe(InitEodSchema)) dto: InitEodDto,
    @CurrentUser() user: JwtPayload,
  ) {
    dto.storeId = user.storeId;
    return this.eodService.initEod(dto, user.sub);
  }

  @Post('close')
  @Roles('manager', 'supervisor', 'owner', 'cashier', 'pharmacist')
  @ApiOperation({ summary: 'Close EOD with physical cash count — pending approval for floor staff' })
  closeEod(
    @Body(new ZodValidationPipe(CloseEodSchema)) dto: CloseEodDto,
    @CurrentUser() user: JwtPayload,
  ) {
    dto.storeId = user.storeId;
    return this.eodService.closeEod(dto, user.sub, user.role);
  }

  @Post(':id/approve')
  @Roles('manager', 'supervisor', 'owner')
  @ApiOperation({ summary: 'Approve a pending or discrepancy EOD' })
  approveEod(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.eodService.approveEod(id, user.sub);
  }

  @Post(':id/reject')
  @Roles('manager', 'supervisor', 'owner')
  @ApiOperation({ summary: 'Reject a pending or discrepancy EOD' })
  rejectEod(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.eodService.rejectEod(id, user.sub);
  }
}
