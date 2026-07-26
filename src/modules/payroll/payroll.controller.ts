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
  getCycleById(@Param('id') id: string) {
    return this.payrollService.getCycleById(id);
  }

  @Post('cycles/:id/finalize')
  finalizeCycle(@Param('id') id: string) {
    return this.payrollService.finalizeCycle(id);
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
}
