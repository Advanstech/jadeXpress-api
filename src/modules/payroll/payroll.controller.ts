import { Controller, Get, Post, Body, Param, Patch, Delete, Query } from '@nestjs/common';
import { PayrollService } from './payroll.service';

@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('cycles')
  getCycles(@Query('storeId') storeId: string) {
    if (!storeId) throw new Error('storeId is required');
    return this.payrollService.getCycles(storeId);
  }

  @Post('cycles')
  createCycle(@Body() body: { storeId: string; periodMonth: number; periodYear: number; processedById?: string }) {
    return this.payrollService.createCycle(body.storeId, body);
  }

  @Get('cycles/:id')
  getCycleById(@Param('id') id: string, @Query('storeId') storeId?: string) {
    return this.payrollService.getCycleById(id, storeId);
  }

  @Post('cycles/:id/finalize')
  finalizeCycle(@Param('id') id: string, @Body() body?: { processedById?: string }) {
    return this.payrollService.finalizeCycle(id, body?.processedById);
  }

  @Post('cycles/:id/pay')
  markCyclePaid(@Param('id') id: string, @Body() body?: { processedById?: string }) {
    return this.payrollService.markCyclePaid(id, body?.processedById);
  }

  @Post('payslips')
  createPayslip(@Body() body: { cycleId: string; payslipData: any }) {
    return this.payrollService.createPayslip(body.cycleId, body.payslipData);
  }

  @Patch('payslips/:id')
  updatePayslip(@Param('id') id: string, @Body() body: any) {
    return this.payrollService.updatePayslip(id, body);
  }

  @Delete('payslips/:id')
  deletePayslip(@Param('id') id: string) {
    return this.payrollService.deletePayslip(id);
  }

  @Post('payslips/:id/pay')
  markPayslipPaid(
    @Param('id') id: string,
    @Body() body?: { paymentMethod?: string; paymentReference?: string; notes?: string },
  ) {
    return this.payrollService.markPayslipPaid(id, body ?? {});
  }
}
