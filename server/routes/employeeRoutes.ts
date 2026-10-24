import { Router } from 'express';
import { employeeService } from '../services/employeeService';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();

// Employee directory with search and filters (Functionality 07)
router.get('/employees', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;

  // If Employee role, only return own record
  if (user.role === 'employee') {
    if (!user.employee_id) {
      res.json({ data: [], meta: { total: 0, page: 1, limit: 1, totalPages: 0 } });
      return;
    }
    const result = employeeService.getEmployees({ search: user.email, limit: 1 });
    res.json(result);
    return;
  }

  // Admin & HR: All records with server-side filters and paging
  const query = {
    search: req.query.search as string,
    department_id: req.query.department_id as string,
    status: req.query.status as string,
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 20,
  };

  const results = employeeService.getEmployees(query);
  res.json(results);
});

// Employee 360 Profile (Functionality 07)
router.get('/employees/:id/profile', requireAuth, (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const empId = req.params.id;

    // RBAC Scope Check: An employee cannot view other employees' 360 profile!
    if (user.role === 'employee' && user.employee_id !== empId) {
      res.status(403).json({ error: 'Forbidden: You can only view your own Employee 360 profile.' });
      return;
    }

    const profile = employeeService.getEmployee360(empId);
    res.json(profile);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// Register Employee (Functionality 06 - HR only)
router.post('/employees', requireAuth, requireRole(['hr', 'admin']), async (req: AuthRequest, res) => {
  try {
    const result = await employeeService.registerEmployee(req.body);

    logAudit(
      { id: req.user!.id, email: req.user!.email, role: req.user!.role },
      'REGISTER_EMPLOYEE',
      'employees',
      result.employee.id,
      null,
      { code: result.employee.employee_code, email: result.employee.email }
    );

    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Edit Employee (Functionality 06 - HR full, Employee phone & address only)
router.put('/employees/:id', requireAuth, (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const empId = req.params.id;

    const before = employeeService.getEmployee360(empId).employee;
    const updated = employeeService.updateEmployee(empId, req.body, user.role, user.employee_id);

    logAudit(
      { id: req.user!.id, email: req.user!.email, role: req.user!.role },
      'UPDATE_EMPLOYEE',
      'employees',
      empId,
      before,
      updated
    );

    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// CSV Dry-Run (Functionality 08 - HR only)
router.post('/employees/csv/dry-run', requireAuth, requireRole(['hr', 'admin']), async (req, res) => {
  try {
    const { csv_content } = req.body;
    if (!csv_content) {
      res.status(400).json({ error: 'csv_content string is required.' });
      return;
    }

    const report = await employeeService.dryRunCSV(csv_content);
    res.json(report);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Commit CSV Import (Functionality 08 - HR only)
router.post('/employees/csv/import', requireAuth, requireRole(['hr', 'admin']), async (req: AuthRequest, res) => {
  try {
    const { valid_data } = req.body;
    if (!Array.isArray(valid_data) || valid_data.length === 0) {
      res.status(400).json({ error: 'valid_data array is required.' });
      return;
    }

    const results = await employeeService.commitCSVImport(valid_data);

    logAudit(
      { id: req.user!.id, email: req.user!.email, role: req.user!.role },
      'CSV_IMPORT_EMPLOYEES',
      'employees',
      undefined,
      null,
      { imported_count: results.length }
    );

    res.status(201).json({ imported: results.length, employees: results });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Export CSV (Functionality 08 - HR & Admin)
router.get('/employees/csv/export', requireAuth, requireRole(['hr', 'admin']), (req, res) => {
  try {
    const csv = employeeService.exportCSV();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="hcm_employees.csv"');
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
