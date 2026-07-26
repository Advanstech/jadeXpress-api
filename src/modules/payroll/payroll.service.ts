import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { payrollCycles, payslips, stores, staffProfile } from '../../database/schema';
import { eq, and, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

@Injectable()
export class PayrollService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async getCycles(storeId: string) {
    return await this.db.query.payrollCycles.findMany({
      where: eq(payrollCycles.storeId, storeId),
      orderBy: [desc(payrollCycles.periodYear), desc(payrollCycles.periodMonth)],
      with: {
        processedBy: true,
      },
    });
  }

  async getCycleById(id: string) {
    const cycle = await this.db.query.payrollCycles.findFirst({
      where: eq(payrollCycles.id, id),
      with: {
        processedBy: true,
        payslips: {
          with: {
            staff: true,
          }
        },
      },
    });
    if (!cycle) throw new NotFoundException('Payroll cycle not found');
    return cycle;
  }

  async createCycle(storeId: string, data: { periodMonth: number; periodYear: number; processedById?: string }) {
    const [cycle] = await this.db.insert(payrollCycles).values({
      storeId,
      periodMonth: data.periodMonth,
      periodYear: data.periodYear,
      status: 'draft',
      processedById: data.processedById,
    }).returning();
    return cycle;
  }

  async createPayslip(cycleId: string, data: any) {
    const [payslip] = await this.db.insert(payslips).values({
      payrollCycleId: cycleId,
      staffId: data.staffId,
      storeId: data.storeId,
      basicSalaryPesewas: data.basicSalaryPesewas,
      bonusesPesewas: data.bonusesPesewas || 0,
      ssnitTier1Pesewas: data.ssnitTier1Pesewas || 0,
      payeTaxPesewas: data.payeTaxPesewas || 0,
      otherDeductionsPesewas: data.otherDeductionsPesewas || 0,
      netPayPesewas: data.netPayPesewas,
      status: 'pending',
    }).returning();
    
    await this.updateCycleTotals(cycleId);
    return payslip;
  }

  async updatePayslip(payslipId: string, data: any) {
    const [updated] = await this.db.update(payslips).set(data).where(eq(payslips.id, payslipId)).returning();
    if (updated) await this.updateCycleTotals(updated.payrollCycleId);
    return updated;
  }

  async deletePayslip(payslipId: string) {
    const payslip = await this.db.query.payslips.findFirst({ where: eq(payslips.id, payslipId) });
    if (!payslip) return;
    
    await this.db.delete(payslips).where(eq(payslips.id, payslipId));
    await this.updateCycleTotals(payslip.payrollCycleId);
  }

  async finalizeCycle(cycleId: string) {
    const [cycle] = await this.db.update(payrollCycles).set({ status: 'finalized' }).where(eq(payrollCycles.id, cycleId)).returning();
    return cycle;
  }

  private async updateCycleTotals(cycleId: string) {
    const allPayslips = await this.db.query.payslips.findMany({ where: eq(payslips.payrollCycleId, cycleId) });
    const totalBasic = allPayslips.reduce((sum: number, p: any) => sum + p.basicSalaryPesewas, 0);
    const totalDeductions = allPayslips.reduce((sum: number, p: any) => sum + p.ssnitTier1Pesewas + p.payeTaxPesewas + p.otherDeductionsPesewas, 0);
    const totalNet = allPayslips.reduce((sum: number, p: any) => sum + p.netPayPesewas, 0);

    await this.db.update(payrollCycles).set({
      totalBasicPesewas: totalBasic,
      totalDeductionsPesewas: totalDeductions,
      totalNetPesewas: totalNet,
    }).where(eq(payrollCycles.id, cycleId));
  }
}
