import { Router } from 'express';
import { payrollService } from '../services/payrollService';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();

// List Payroll Runs (Functionality 15)
router.get('/payroll/runs', requireAuth, requireRole(['admin', 'hr']), (req, res) => {
  const runs = payrollService.getPayrollRuns();
  res.json(runs);
});

// Create Monthly Payroll Draft (Functionality 15 - HR & Admin)
router.post('/payroll/draft', requireAuth, requireRole(['hr', 'admin']), (req: AuthRequest, res) => {
  try {
    const { month } = req.body;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: 'Valid month (YYYY-MM) is required.' });
      return;
    }

    const result = payrollService.generateMonthlyDraft(month, req.user!.id);

    logAudit(
      { id: req.user!.id, email: req.user!.email, role: req.user!.role },
      'GENERATE_PAYROLL_DRAFT',
      'payroll_runs',
      result.run.id,
      null,
      { month, total_gross: result.run.total_gross, count: result.payslips.length }
    );

    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Finalize Payroll (Functionality 16 - ADMIN ONLY, locks the month)
router.post('/payroll/finalize', requireAuth, requireRole(['admin']), (req: AuthRequest, res) => {
  try {
    const { month } = req.body;
    if (!month) {
      res.status(400).json({ error: 'Month (YYYY-MM) is required.' });
      return;
    }

    const run = payrollService.finalizePayroll(month, req.user!.id);

    logAudit(
      { id: req.user!.id, email: req.user!.email, role: req.user!.role },
      'FINALIZE_PAYROLL',
      'payroll_runs',
      run.id,
      null,
      { month, status: 'finalized', total_net: run.total_net }
    );

    res.json(run);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// List Payslips (Functionality 17)
router.get('/payroll/payslips', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const month = req.query.month as string | undefined;

  if (user.role === 'employee') {
    if (!user.employee_id) {
      res.json([]);
      return;
    }
    const payslips = payrollService.getPayslips({ month, employee_id: user.employee_id });
    res.json(payslips);
    return;
  }

  // Admin & HR can see all or filter by employee/month
  const empId = req.query.employee_id as string | undefined;
  const payslips = payrollService.getPayslips({ month, employee_id: empId });
  res.json(payslips);
});

// Get Single Payslip (Functionality 17)
router.get('/payroll/payslips/:id', requireAuth, (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const payslip = payrollService.getPayslipById(req.params.id);

    // Security scope: An employee cannot view another employee's payslip!
    if (user.role === 'employee' && payslip.employee_id !== user.employee_id) {
      res.status(403).json({ error: 'Forbidden: You do not have permission to view other employee payslips.' });
      return;
    }

    res.json(payslip);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

export default router;
