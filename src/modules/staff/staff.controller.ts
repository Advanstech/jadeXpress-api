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
} from './dto/staff.dto';

@ApiTags('staff')
@ApiBearerAuth()
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'List all staff for current store' })
  list(@CurrentUser() user: JwtPayload, @Query(new ZodValidationPipe(PaginationSchema)) query: any) {
    return this.staffService.list(user.storeId, query);
  }

  @Get('roster')
  @Public()
  @ApiOperation({ summary: 'Public endpoint to get staff roster for a store' })
  async getRoster(@Query('storeId') storeId?: string) {
    return this.staffService.getRoster(storeId);
  }

  @Get('shift/active')
  @ApiOperation({ summary: 'Get current open shift for logged-in staff' })
  getActiveShift(@CurrentUser() user: JwtPayload) {
    return this.staffService.getActiveShift(user.sub, user.storeId);
  }

  @Get(':id')
  @Roles('manager', 'supervisor', 'owner')
  getById(@Param('id') id: string) {
    return this.staffService.getById(id);
  }

  @Get(':id/shifts')
  @Roles('manager', 'supervisor', 'owner')
  @ApiOperation({ summary: 'Shift history for a staff member' })
  getShiftHistory(@Param('id') id: string) {
    return this.staffService.getShiftHistory(id);
  }

  @Post()
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Onboard new staff member' })
  create(@Body(new ZodValidationPipe(CreateStaffSchema)) dto: CreateStaffDto) {
    return this.staffService.create(dto);
  }

  @Put(':id')
  @Roles('manager', 'owner')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateStaffSchema)) dto: UpdateStaffDto,
  ) {
    return this.staffService.update(id, dto);
  }

  @Patch(':id/deactivate')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Deactivate staff account' })
  deactivate(@Param('id') id: string) {
    return this.staffService.deactivate(id);
  }

  @Delete(':id')
  @Roles('owner')
  @ApiOperation({ summary: 'Delete staff account' })
  delete(@Param('id') id: string) {
    return this.staffService.delete(id);
  }

  @Put(':id/temporary-pin')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Generate a temporary PIN for a staff member' })
  generateTemporaryPin(@Param('id') id: string) {
    return this.staffService.generateTemporaryPin(id);
  }

  @Post(':id/resend-credentials')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Resend login credentials (new temp PIN) to staff email' })
  resendCredentials(@Param('id') id: string) {
    return this.staffService.resendCredentials(id);
  }

  @Get(':id/activities')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Get staff activity history (audit logs + shift events)' })
  getActivities(@Param('id') id: string) {
    return this.staffService.getActivities(id);
  }

  @Post('clock-in')
  @ApiOperation({ summary: 'Clock in — start shift' })
  clockIn(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(ClockInSchema)) dto: ClockInDto,
  ) {
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
