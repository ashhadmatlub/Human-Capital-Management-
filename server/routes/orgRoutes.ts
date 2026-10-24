import { Router } from 'express';
import { orgService } from '../services/orgService';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();

// Settings
router.get('/org/settings', requireAuth, (req, res) => {
  const settings = orgService.getSettings();
  res.json(settings);
});

router.put('/org/settings', requireAuth, requireRole(['admin']), (req: AuthRequest, res) => {
  try {
    const before = orgService.getSettings();
    const updated = orgService.updateSettings(req.body);

    logAudit(
      { id: req.user!.id, email: req.user!.email, role: req.user!.role },
      'UPDATE_SETTINGS',
      'settings',
      'global',
      before,
      updated
    );

    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Departments
router.get('/org/departments', requireAuth, (req, res) => {
  res.json(orgService.getDepartments());
});

router.post('/org/departments', requireAuth, requireRole(['admin']), (req: AuthRequest, res) => {
  try {
    const { name, code } = req.body;
    if (!name || !code) {
      res.status(400).json({ error: 'Name and code are required.' });
      return;
    }
    const dept = orgService.createDepartment(name, code);

    logAudit(
      { id: req.user!.id, email: req.user!.email, role: req.user!.role },
      'CREATE_DEPARTMENT',
      'departments',
      dept.id,
      null,
      dept
    );

    res.status(201).json(dept);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Designations
router.get('/org/designations', requireAuth, (req, res) => {
  const deptId = req.query.department_id as string | undefined;
  res.json(orgService.getDesignations(deptId));
});

router.post('/org/designations', requireAuth, requireRole(['admin']), (req: AuthRequest, res) => {
  try {
    const { name, department_id } = req.body;
    if (!name || !department_id) {
      res.status(400).json({ error: 'Name and department_id are required.' });
      return;
    }
    const desig = orgService.createDesignation(name, department_id);

    logAudit(
      { id: req.user!.id, email: req.user!.email, role: req.user!.role },
      'CREATE_DESIGNATION',
      'designations',
      desig.id,
      null,
      desig
    );

    res.status(201).json(desig);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Leave Types
router.get('/org/leave-types', requireAuth, (req, res) => {
  res.json(orgService.getLeaveTypes());
});

router.post('/org/leave-types', requireAuth, requireRole(['admin']), (req: AuthRequest, res) => {
  try {
    const { name, code, yearly_quota } = req.body;
    const item = orgService.createLeaveType(name, code, Number(yearly_quota) || 0);

    logAudit(
      { id: req.user!.id, email: req.user!.email, role: req.user!.role },
      'CREATE_LEAVE_TYPE',
      'leave_types',
      item.id,
      null,
      item
    );

    res.status(201).json(item);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Public Holidays
router.get('/org/public-holidays', requireAuth, (req, res) => {
  res.json(orgService.getPublicHolidays());
});

router.post('/org/public-holidays', requireAuth, requireRole(['admin']), (req: AuthRequest, res) => {
  try {
    const { name, date } = req.body;
    const item = orgService.createPublicHoliday(name, date);

    logAudit(
      { id: req.user!.id, email: req.user!.email, role: req.user!.role },
      'CREATE_PUBLIC_HOLIDAY',
      'public_holidays',
      item.id,
      null,
      item
    );

    res.status(201).json(item);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
