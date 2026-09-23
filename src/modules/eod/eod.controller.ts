import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EodService } from './eod.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationSchema } from '../../common/dto/pagination.dto';
import { InitEodSchema, InitEodDto, CloseEodSchema, CloseEodDto, RejectEodSchema, RejectEodDto, CloseShiftSchema, CloseShiftDto, ListShiftsSchema, ListShiftsDto } from './dto/eod.dto';

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

  // ── Per-staff shifts ──────────────────────────────────────────────────────

  @Post('shift/activate')
  @Roles('manager', 'supervisor', 'owner', 'cashier', 'pharmacist', 'root', 'super_admin', 'head_pharmacist', 'stock_officer')
  @ApiOperation({ summary: 'Activate today\'s shift for the logged-in user (called on login)' })
  activateShift(@CurrentUser() user: JwtPayload) {
    return this.eodService.activateShift(user.storeId, user.sub);
  }

  @Get('shift/today')
  @Roles('manager', 'supervisor', 'owner', 'cashier', 'pharmacist', 'root', 'super_admin', 'head_pharmacist', 'stock_officer')
  @ApiOperation({ summary: 'My shift for today with live totals' })
  getMyShift(@CurrentUser() user: JwtPayload) {
    return this.eodService.getMyShift(user.storeId, user.sub);
  }

  @Post('shift/close')
  @Roles('manager', 'supervisor', 'owner', 'cashier', 'pharmacist', 'root', 'super_admin', 'head_pharmacist', 'stock_officer')
  @ApiOperation({ summary: 'Close my shift — submits for manager approval' })
  closeShift(
    @Body(new ZodValidationPipe(CloseShiftSchema)) dto: CloseShiftDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.eodService.closeShift(user.storeId, user.sub, dto, user.role);
  }

  @Get('shifts')
  @Roles('manager', 'supervisor', 'owner', 'cashier', 'pharmacist', 'root', 'super_admin', 'head_pharmacist', 'stock_officer')
  @ApiOperation({ summary: 'List shifts — managers see all staff, floor staff see only their own' })
  listShifts(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(ListShiftsSchema)) query: ListShiftsDto,
  ) {
    return this.eodService.listShifts(user.storeId, user.sub, user.role, query);
  }

  @Get('shifts/:id')
  @Roles('manager', 'supervisor', 'owner', 'cashier', 'pharmacist', 'root', 'super_admin', 'head_pharmacist', 'stock_officer')
  @ApiOperation({ summary: 'Shift detail with staff/closer/approver metadata' })
  getShift(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.eodService.getShift(id, user.storeId);
  }

  @Post('shifts/:id/approve')
  @Roles('manager', 'supervisor', 'owner', 'root', 'super_admin')
  @ApiOperation({ summary: 'Approve a pending shift' })
  approveShift(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.eodService.approveShift(id, user.sub, user.storeId);
  }

  @Post('shifts/:id/reject')
  @Roles('manager', 'supervisor', 'owner', 'root', 'super_admin')
  @ApiOperation({ summary: 'Reject a pending shift' })
  rejectShift(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RejectEodSchema)) dto: RejectEodDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.eodService.rejectShift(id, user.sub, user.storeId, dto.reason);
  }

  @Post(':id/approve')
  @Roles('manager', 'supervisor', 'owner')
  @ApiOperation({ summary: 'Approve a pending or discrepancy EOD' })
  approveEod(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.eodService.approveEod(id, user.sub, user.storeId);
  }

  @Post(':id/reject')
  @Roles('manager', 'supervisor', 'owner')
  @ApiOperation({ summary: 'Reject a pending or discrepancy EOD' })
  rejectEod(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RejectEodSchema)) dto: RejectEodDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.eodService.rejectEod(id, user.sub, user.storeId, dto.reason);
  }
}
