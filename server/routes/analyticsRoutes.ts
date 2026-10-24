import { Router } from 'express';
import { analyticsService } from '../services/analyticsService';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// Admin Dashboard Metrics (Functionality 18)
router.get('/analytics/admin', requireAuth, requireRole(['admin']), (req, res) => {
  const deptId = req.query.department_id as string | undefined;
  const metrics = analyticsService.getAdminMetrics({ department_id: deptId });
  res.json(metrics);
});

// HR Dashboard Metrics (Functionality 18)
router.get('/analytics/hr', requireAuth, requireRole(['hr', 'admin']), (req, res) => {
  const deptId = req.query.department_id as string | undefined;
  const month = req.query.month as string | undefined;
  const metrics = analyticsService.getHRMetrics({ department_id: deptId, month });
  res.json(metrics);
});

// Employee Dashboard Metrics (Functionality 18)
router.get('/analytics/employee', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  if (!user.employee_id) {
    res.status(400).json({ error: 'No employee profile linked to current account.' });
    return;
  }

  const metrics = analyticsService.getEmployeeDashboard(user.employee_id);
  res.json(metrics);
});

export default router;
