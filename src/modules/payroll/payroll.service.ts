import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { payrollCycles, payslips, staffProfile, ledgerEntries } from '../../database/schema';
import { eq, and, desc } from 'drizzle-orm';

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

  async getCycleById(id: string, storeId?: string) {
    const cycle = await this.db.query.payrollCycles.findFirst({
      where: storeId
        ? and(eq(payrollCycles.id, id), eq(payrollCycles.storeId, storeId))
        : eq(payrollCycles.id, id),
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
    const existing = await this.db.query.payrollCycles.findFirst({
      where: and(
        eq(payrollCycles.storeId, storeId),
        eq(payrollCycles.periodMonth, data.periodMonth),
        eq(payrollCycles.periodYear, data.periodYear),
      ),
    });
    if (existing) {
      throw new BadRequestException(
        `A payroll cycle for ${data.periodMonth}/${data.periodYear} already exists.`,
      );
    }

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
    const cycle = await this.getCycleById(cycleId, data.storeId);
    if (cycle.status !== 'draft') {
      throw new BadRequestException('Cannot add payslips to a finalized or paid cycle.');
    }

    const existing = await this.db.query.payslips.findFirst({
      where: and(
        eq(payslips.payrollCycleId, cycleId),
        eq(payslips.staffId, data.staffId),
      ),
    });
    if (existing) {
      const staff = await this.db.query.staffProfile.findFirst({ where: eq(staffProfile.id, data.staffId) });
      const name = staff ? `${staff.firstName} ${staff.lastName}` : 'this staff member';
      throw new BadRequestException(`A payslip for ${name} already exists in this cycle.`);
    }

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
    const existing = await this.db.query.payslips.findFirst({ where: eq(payslips.id, payslipId) });
    if (!existing) throw new NotFoundException('Payslip not found');

    const cycle = await this.db.query.payrollCycles.findFirst({ where: eq(payrollCycles.id, existing.payrollCycleId) });
    if (cycle && cycle.status !== 'draft') {
      throw new BadRequestException('Cannot edit payslips in a finalized or paid cycle.');
    }

    const allowed: Record<string, any> = {};
    for (const key of ['basicSalaryPesewas', 'bonusesPesewas', 'ssnitTier1Pesewas', 'payeTaxPesewas', 'otherDeductionsPesewas', 'netPayPesewas', 'notes']) {
      if (data[key] !== undefined) allowed[key] = data[key];
    }

    const [updated] = await this.db.update(payslips).set(allowed).where(eq(payslips.id, payslipId)).returning();
    if (updated) await this.updateCycleTotals(updated.payrollCycleId);
    return updated;
  }

  async deletePayslip(payslipId: string) {
    const payslip = await this.db.query.payslips.findFirst({ where: eq(payslips.id, payslipId) });
    if (!payslip) return;

    const cycle = await this.db.query.payrollCycles.findFirst({ where: eq(payrollCycles.id, payslip.payrollCycleId) });
    if (cycle && cycle.status !== 'draft') {
      throw new BadRequestException('Cannot delete payslips from a finalized or paid cycle.');
    }

    await this.db.delete(payslips).where(eq(payslips.id, payslipId));
    await this.updateCycleTotals(payslip.payrollCycleId);
  }

  async finalizeCycle(cycleId: string, processedById?: string) {
    const cycle = await this.getCycleById(cycleId);
    if (cycle.status !== 'draft') {
      throw new BadRequestException(`Cycle is already ${cycle.status}.`);
    }
    if (!cycle.payslips || cycle.payslips.length === 0) {
      throw new BadRequestException('Cannot finalize a cycle with no payslips.');
    }

    const [updated] = await this.db.update(payrollCycles).set({
      status: 'finalized',
      processedById: processedById ?? cycle.processedById,
    }).where(eq(payrollCycles.id, cycleId)).returning();
    return updated;
  }

  async markPayslipPaid(payslipId: string, data: { paymentMethod?: string; paymentReference?: string; notes?: string }) {
    const payslip = await this.db.query.payslips.findFirst({ where: eq(payslips.id, payslipId) });
    if (!payslip) throw new NotFoundException('Payslip not found');
    if (payslip.status === 'paid') return payslip;

    const cycle = await this.db.query.payrollCycles.findFirst({ where: eq(payrollCycles.id, payslip.payrollCycleId) });
    if (cycle && cycle.status === 'draft') {
      throw new BadRequestException('Finalize the payroll cycle before marking payslips as paid.');
    }

    const [updated] = await this.db.update(payslips).set({
      status: 'paid',
      paymentDate: new Date(),
      paymentMethod: data.paymentMethod || null,
      paymentReference: data.paymentReference || null,
      notes: data.notes || payslip.notes,
    }).where(eq(payslips.id, payslipId)).returning();

    return updated;
  }

  async markCyclePaid(cycleId: string, processedById?: string) {
    const cycle = await this.getCycleById(cycleId);
    if (cycle.status === 'paid') return cycle;
    if (cycle.status !== 'finalized') {
      throw new BadRequestException('Cycle must be finalized before marking as paid.');
    }

    const unpaidPayslips = (cycle.payslips || []).filter((p: any) => p.status !== 'paid');
    for (const p of unpaidPayslips) {
      await this.db.update(payslips).set({
        status: 'paid',
        paymentDate: new Date(),
      }).where(eq(payslips.id, p.id));
    }

    const [updated] = await this.db.update(payrollCycles).set({
      status: 'paid',
      processedById: processedById ?? cycle.processedById,
    }).where(eq(payrollCycles.id, cycleId)).returning();

    // Create ledger entry for the total net pay (cash outflow)
    await this.db.insert(ledgerEntries).values({
      storeId: cycle.storeId,
      entryType: 'debit',
      category: 'expense',
      amountPesewas: cycle.totalNetPesewas,
      description: `Payroll payment for ${cycle.periodMonth}/${cycle.periodYear}`,
      referenceType: 'payroll',
      referenceId: cycleId,
      performedById: processedById ?? cycle.processedById,
    });

    return updated;
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
