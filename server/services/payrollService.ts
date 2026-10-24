import { randomUUID } from 'crypto';
import { db, PayrollRun, Payslip, Employee, Notification } from '../db/database';
import { leaveService } from './leaveService';

export function calculateAnnualTax(annualGross: number): number {
  if (annualGross <= 600000) {
    return 0;
  }
  if (annualGross <= 1200000) {
    return (annualGross - 600000) * 0.05;
  }
  if (annualGross <= 2400000) {
    return 30000 + (annualGross - 1200000) * 0.15;
  }
  if (annualGross <= 3600000) {
    return 210000 + (annualGross - 2400000) * 0.25;
  }
  return 510000 + (annualGross - 3600000) * 0.35;
}

export const payrollService = {
  // Get working days count for a given month (YYYY-MM)
  getMonthWorkingDays(monthStr: string): number {
    const [year, month] = monthStr.split('-').map(Number);
    const start = `${monthStr}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${monthStr}-${String(lastDay).padStart(2, '0')}`;
    return leaveService.calculateWorkingDays(start, end);
  },

  generateMonthlyDraft(month: string, creatorId: string): { run: PayrollRun; payslips: Payslip[] } {
    const payrollRuns = db.get('payroll_runs');
    const existingRun = payrollRuns.find((r) => r.month === month);

    if (existingRun && existingRun.status === 'finalized') {
      throw new Error(`Payroll for ${month} is already finalized and locked.`);
    }

    const workingDays = this.getMonthWorkingDays(month);
    if (workingDays <= 0) {
      throw new Error('No working days identified for this month.');
    }

    const employees = db.get('employees').filter((e) => e.status !== 'terminated');
    const attendance = db.get('attendance').filter((a) => a.date.startsWith(month));
    const leaveRequests = db.get('leave_requests').filter(
      (l) => l.status === 'approved' && (l.start_date.startsWith(month) || l.end_date.startsWith(month))
    );
    const leaveTypes = db.get('leave_types');
    const unpaidType = leaveTypes.find((lt) => lt.is_unpaid);
    const settings = db.get('settings');

    const payslips: Payslip[] = [];
    const runId = existingRun ? existingRun.id : randomUUID();

    let totalGross = 0;
    let totalDeductions = 0;
    let totalTax = 0;
    let totalNet = 0;

    const [year, monthNum] = month.split('-').map(Number);
    const monthStart = `${month}-01`;
    const lastDayNum = new Date(year, monthNum, 0).getDate();
    const monthEnd = `${month}-${String(lastDayNum).padStart(2, '0')}`;

    for (const emp of employees) {
      // 1. Check join date and exit date proration
      if (emp.join_date > monthEnd) {
        continue; // not joined yet
      }
      if (emp.exit_date && emp.exit_date < monthStart) {
        continue; // already left
      }

      const basic = emp.basic_salary;
      const hra = emp.hra || Math.round(basic * 0.4);
      const medical = emp.medical_allowance || Math.round(basic * 0.1);
      const gross = emp.gross_salary || Math.round(basic * 1.5);

      const perDayRate = gross / workingDays;

      // Calculate attendance metrics
      const empAttendance = attendance.filter((a) => a.employee_id === emp.id);
      const halfDaysCount = empAttendance.filter((a) => a.status === 'half_day').length;
      const lateCount = empAttendance.filter((a) => a.status === 'late').length;

      // Bonus rule: 3 lates = 0.5 day penalty if enabled
      let latePenaltyDays = 0;
      if (settings?.late_penalty_enabled && lateCount >= 3) {
        latePenaltyDays = Math.floor(lateCount / 3) * 0.5;
      }

      // Unpaid leaves in this month
      let unpaidDays = 0;
      if (unpaidType) {
        unpaidDays = leaveRequests
          .filter((l) => l.employee_id === emp.id && l.leave_type_id === unpaidType.id)
          .reduce((sum, l) => sum + l.days_count, 0);
      }

      // Calculate actual worked days
      const presentDays = empAttendance.filter((a) => a.status === 'present' || a.status === 'late').length;
      const workedDays = presentDays + halfDaysCount * 0.5;

      // Absent days: expected working days - worked - approved paid leave
      const paidLeaveDays = leaveRequests
        .filter((l) => l.employee_id === emp.id && l.leave_type_id !== unpaidType?.id)
        .reduce((sum, l) => sum + l.days_count, 0);

      // Proration for joiners
      let expectedEmpDays = workingDays;
      if (emp.join_date > monthStart) {
        expectedEmpDays = leaveService.calculateWorkingDays(emp.join_date, monthEnd);
      }
      if (emp.exit_date && emp.exit_date < monthEnd) {
        expectedEmpDays = leaveService.calculateWorkingDays(monthStart, emp.exit_date);
      }

      const absentDays = Math.max(0, expectedEmpDays - (presentDays + halfDaysCount + paidLeaveDays + unpaidDays));

      // Rule: Per day = gross ÷ working days; deduct absent + unpaid + 0.5 × half days (+ late penalties)
      const deductionDays = absentDays + unpaidDays + halfDaysCount * 0.5 + latePenaltyDays;
      const deductions = Math.min(gross, Math.round(deductionDays * perDayRate));

      // Tax calculation
      const taxableAnnual = Math.max(0, gross * 12);
      const annualTax = calculateAnnualTax(taxableAnnual);
      const monthlyTax = Math.round(annualTax / 12);

      const netSalary = Math.max(0, gross - deductions - monthlyTax);

      totalGross += gross;
      totalDeductions += deductions;
      totalTax += monthlyTax;
      totalNet += netSalary;

      payslips.push({
        id: randomUUID(),
        payroll_run_id: runId,
        employee_id: emp.id,
        month,
        basic_salary: basic,
        hra,
        medical_allowance: medical,
        gross_salary: gross,
        absent_days: absentDays,
        unpaid_leave_days: unpaidDays,
        half_days: halfDaysCount,
        worked_days: workedDays,
        deductions,
        taxable_income: taxableAnnual,
        tax: monthlyTax,
        net_salary: netSalary,
        status: 'draft',
        created_at: new Date().toISOString(),
      });
    }

    const run: PayrollRun = {
      id: runId,
      month,
      status: 'draft',
      total_gross: totalGross,
      total_deductions: totalDeductions,
      total_tax: totalTax,
      total_net: totalNet,
      working_days: workingDays,
      created_by: creatorId,
      created_at: existingRun?.created_at || new Date().toISOString(),
    };

    // Replace existing draft run if any
    const otherRuns = payrollRuns.filter((r) => r.month !== month);
    otherRuns.push(run);
    db.set('payroll_runs', otherRuns);

    // Replace existing draft payslips for this run
    const allPayslips = db.get('payslips').filter((p) => p.month !== month);
    db.set('payslips', [...allPayslips, ...payslips]);

    return { run, payslips };
  },

  finalizePayroll(month: string, adminId: string): PayrollRun {
    const runs = db.get('payroll_runs');
    const run = runs.find((r) => r.month === month);
    if (!run) {
      throw new Error(`No payroll run draft found for ${month}. Please generate draft first.`);
    }
    if (run.status === 'finalized') {
      throw new Error(`Payroll for ${month} has already been finalized and locked.`);
    }

    run.status = 'finalized';
    run.finalized_by = adminId;
    run.finalized_at = new Date().toISOString();
    db.set('payroll_runs', runs);

    // Update payslips status to paid
    const payslips = db.get('payslips');
    const users = db.get('users');
    const notifs = db.get('notifications');

    payslips.forEach((p) => {
      if (p.payroll_run_id === run.id) {
        p.status = 'paid';

        // Send in-app notification
        const user = users.find((u) => u.employee_id === p.employee_id);
        if (user) {
          notifs.unshift({
            id: randomUUID(),
            user_id: user.id,
            title: 'Payslip Ready',
            message: `Your payslip for ${month} is now available for download. Net Pay: ${p.net_salary.toLocaleString()}`,
            type: 'payroll',
            is_read: false,
            created_at: new Date().toISOString(),
          });
        }
      }
    });

    db.set('payslips', payslips);
    db.set('notifications', notifs);

    return run;
  },

  getPayrollRuns(): PayrollRun[] {
    return db.get('payroll_runs').sort((a, b) => b.month.localeCompare(a.month));
  },

  getPayslips(query: { month?: string; employee_id?: string }) {
    let payslips = db.get('payslips');
    const employees = db.get('employees');
    const departments = db.get('departments');
    const designations = db.get('designations');

    if (query.month) {
      payslips = payslips.filter((p) => p.month === query.month);
    }
    if (query.employee_id) {
      payslips = payslips.filter((p) => p.employee_id === query.employee_id);
    }

    return payslips.map((p) => {
      const emp = employees.find((e) => e.id === p.employee_id);
      const dept = departments.find((d) => d.id === emp?.department_id);
      const desig = designations.find((d) => d.id === emp?.designation_id);

      return {
        ...p,
        employee_name: emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown',
        employee_code: emp?.employee_code || '',
        department_name: dept?.name || '',
        designation_name: desig?.name || '',
      };
    });
  },

  getPayslipById(payslipId: string) {
    const payslips = db.get('payslips');
    const p = payslips.find((item) => item.id === payslipId);
    if (!p) {
      throw new Error('Payslip not found.');
    }

    const emp = db.get('employees').find((e) => e.id === p.employee_id);
    const dept = db.get('departments').find((d) => d.id === emp?.department_id);
    const desig = db.get('designations').find((d) => d.id === emp?.designation_id);
    const settings = db.get('settings');

    return {
      ...p,
      company_name: settings?.company_name || 'HCM Lite Inc.',
      currency: settings?.currency || 'PKR',
      employee_name: emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown',
      employee_code: emp?.employee_code || '',
      department_name: dept?.name || '',
      designation_name: desig?.name || '',
    };
  },
};
