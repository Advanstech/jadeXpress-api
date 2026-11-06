import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StaffService } from './staff.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationSchema } from '../../common/dto/pagination.dto';
import {
  CreateStaffSchema, CreateStaffDto,
  UpdateStaffSchema, UpdateStaffDto,
  ChangePinSchema, ChangePinDto,
  ClockInSchema, ClockInDto,
  ClockOutSchema, ClockOutDto,
  BranchSwitchSchema, BranchSwitchDto,
} from './dto/staff.dto';
import { isCrossBranchRole } from '../../common/utils/branch-scope';

/**
 * Owner / manager / root see and manage staff network-wide (no branch filter);
 * every other role is confined to their own assigned branch.
 */
const staffScope = (user: JwtPayload): string | undefined =>
  isCrossBranchRole(user.role) ? undefined : user.storeId;

@ApiTags('staff')
@ApiBearerAuth()
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @Roles('manager', 'owner', 'supervisor', 'pharmacist', 'stock_officer')
  @ApiOperation({ summary: 'List staff — all branches for owner/manager/root, own branch for other roles' })
  list(@CurrentUser() user: JwtPayload, @Query(new ZodValidationPipe(PaginationSchema)) query: any) {
    return this.staffService.list(staffScope(user), query);
  }

  @Get('approvers')
  @ApiOperation({ summary: 'List all owners and managers eligible to approve purchase orders and invoices' })
  async getApprovers() {
    return this.staffService.getApprovers();
  }

  @Get('roster')
  @Public()
  @ApiOperation({ summary: 'Public endpoint to get staff roster for a store' })
  async getRoster(@Query('storeId') storeId?: string) {
    return this.staffService.getRoster(storeId);
  }

  @Get('lookup')
  @Public()
  @ApiOperation({ summary: 'Resolve one staff record by email (stealth login entry)' })
  async lookupByEmail(@Query('email') email?: string) {
    if (!email) return null;
    return this.staffService.lookupByEmail(email);
  }

  @Get('shift/active')
  @ApiOperation({ summary: 'Get current open shift for logged-in staff' })
  getActiveShift(@CurrentUser() user: JwtPayload) {
    return this.staffService.getActiveShift(user.sub, user.storeId);
  }

  @Get(':id')
  @Roles('manager', 'supervisor', 'owner')
  getById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.staffService.getById(id, staffScope(user));
  }

  @Get(':id/shifts')
  @Roles('manager', 'supervisor', 'owner')
  @ApiOperation({ summary: 'Shift history for a staff member' })
  getShiftHistory(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.staffService.getShiftHistory(id, 20, staffScope(user));
  }

  @Post()
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Onboard new staff member' })
  async create(
    @Body(new ZodValidationPipe(CreateStaffSchema)) dto: CreateStaffDto,
    @CurrentUser() user: JwtPayload,
  ) {
    // Branch assignment: owner / manager / root may onboard staff into any
    // active branch; every other role can only onboard into their own branch.
    if (!isCrossBranchRole(user.role) || !dto.storeId) {
      dto.storeId = user.storeId;
    } else {
      await this.staffService.assertActiveStore(dto.storeId);
    }
    return this.staffService.create(dto);
  }

  @Put(':id')
  @Roles('manager', 'owner')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateStaffSchema)) dto: UpdateStaffDto,
    @CurrentUser() user: JwtPayload,
  ) {
    // Only owner / manager / root may re-assign a staff member to another branch.
    if (dto.storeId) {
      if (isCrossBranchRole(user.role)) {
        await this.staffService.assertActiveStore(dto.storeId);
      } else {
        delete dto.storeId;
      }
    }
    return this.staffService.update(id, dto, staffScope(user));
  }

  @Patch(':id/deactivate')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Deactivate staff account' })
  deactivate(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.staffService.deactivate(id, staffScope(user));
  }

  @Delete(':id')
  @Roles('owner')
  @ApiOperation({ summary: 'Delete staff account' })
  delete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.staffService.delete(id, user.sub, staffScope(user));
  }

  @Put(':id/temporary-pin')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Generate a temporary PIN for a staff member' })
  generateTemporaryPin(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.staffService.generateTemporaryPin(id, staffScope(user));
  }

  @Post(':id/resend-credentials')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Resend login credentials (new temp PIN) to staff email' })
  resendCredentials(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.staffService.resendCredentials(id, staffScope(user));
  }

  @Get('audit/stats')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Get aggregate audit stats for the store' })
  getAuditStats(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.staffService.getAuditStats(user.storeId, { from, to });
  }

  @Get('audit/all')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Get all staff audit logs for the store' })
  getAllAuditLogs(@CurrentUser() user: JwtPayload, @Query(new ZodValidationPipe(PaginationSchema)) query: any) {
    return this.staffService.getAllAuditLogs(user.storeId, query);
  }

  @Post('audit/branch-switch')
  @ApiOperation({ summary: 'Record a branch switch — target store comes from X-Store-Id (validated by StoreScopeGuard)' })
  recordBranchSwitch(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(BranchSwitchSchema)) dto: BranchSwitchDto,
  ) {
    return this.staffService.recordBranchSwitch(user, dto);
  }

  @Get(':id/activities')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Get staff activity history (audit logs + shift events)' })
  getActivities(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.staffService.getActivities(id, staffScope(user));
  }

  @Post('clock-in')
  @ApiOperation({ summary: 'Clock in — start shift' })
  clockIn(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(ClockInSchema)) dto: ClockInDto,
  ) {
    // Security: always clock in to the authenticated user's store
    dto.storeId = user.storeId;
    return this.staffService.clockIn(user.sub, dto);
  }

  @Post('clock-out')
  @ApiOperation({ summary: 'Clock out — end shift' })
  clockOut(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(ClockOutSchema)) dto: ClockOutDto,
  ) {
    return this.staffService.clockOut(user.sub, dto);
  }
}
