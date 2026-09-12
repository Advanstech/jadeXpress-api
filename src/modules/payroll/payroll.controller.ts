import { Controller, Get, Post, Body, Param, Patch, Delete } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('cycles')
  getCycles(@CurrentUser() user: JwtPayload) {
    return this.payrollService.getCycles(user.storeId);
  }

  @Post('cycles')
  @Roles('manager', 'owner')
  createCycle(
    @Body() body: { periodMonth: number; periodYear: number },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.payrollService.createCycle(user.storeId, {
      ...body,
      processedById: user.sub,
    });
  }

  @Get('cycles/:id')
  getCycleById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.payrollService.getCycleById(id, user.storeId);
  }

  @Post('cycles/:id/finalize')
  @Roles('manager', 'owner')
  finalizeCycle(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.payrollService.finalizeCycle(id, user.sub, user.storeId);
  }

  @Post('cycles/:id/pay')
  @Roles('manager', 'owner')
  markCyclePaid(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.payrollService.markCyclePaid(id, user.sub, user.storeId);
  }

  @Post('payslips')
  @Roles('manager', 'owner')
  createPayslip(@Body() body: { cycleId: string; payslipData: any }, @CurrentUser() user: JwtPayload) {
    // Security: payslips are created in the caller's store only
    return this.payrollService.createPayslip(body.cycleId, {
      ...body.payslipData,
      storeId: user.storeId,
    });
  }

  @Patch('payslips/:id')
  @Roles('manager', 'owner')
  updatePayslip(@Param('id') id: string, @Body() body: any, @CurrentUser() user: JwtPayload) {
    return this.payrollService.updatePayslip(id, body, user.storeId);
  }

  @Delete('payslips/:id')
  @Roles('manager', 'owner')
  deletePayslip(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.payrollService.deletePayslip(id, user.storeId);
  }

  @Post('payslips/:id/pay')
  @Roles('manager', 'owner')
  markPayslipPaid(
    @Param('id') id: string,
    @Body() body: { paymentMethod?: string; paymentReference?: string; notes?: string } | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.payrollService.markPayslipPaid(id, body ?? {}, user.sub, user.storeId);
  }
}
