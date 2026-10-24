import { Router } from 'express';
import { leaveService } from '../services/leaveService';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();

// Leave Balances (Functionality 12)
router.get('/leave/balances', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const requestedEmpId = (req.query.employee_id as string) || user.employee_id;

  if (user.role === 'employee' && requestedEmpId !== user.employee_id) {
    res.status(403).json({ error: 'Forbidden: You can only view your own leave balances.' });
    return;
  }

  if (!requestedEmpId) {
    res.json([]);
    return;
  }

  const balances = leaveService.getLeaveBalances(requestedEmpId);
  res.json(balances);
});

// Apply Leave (Functionality 12)
router.post('/leave/apply', requireAuth, (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const empId = user.role === 'employee' ? user.employee_id : (req.body.employee_id || user.employee_id);

    if (!empId) {
      res.status(400).json({ error: 'No employee profile linked to current account.' });
      return;
    }

    const { leave_type_id, start_date, end_date, reason } = req.body;
    if (!leave_type_id || !start_date || !end_date || !reason) {
      res.status(400).json({ error: 'Leave type, start date, end date, and reason are required.' });
      return;
    }

    const request = leaveService.applyLeave({
      employee_id: empId,
      leave_type_id,
      start_date,
      end_date,
      reason,
    });

    logAudit(
      { id: user.id, email: user.email, role: user.role },
      'APPLY_LEAVE',
      'leave_requests',
      request.id,
      null,
      request
    );

    res.status(201).json(request);
  } catch (err: any) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message });
  }
});

// Cancel Leave (Functionality 12)
router.post('/leave/:id/cancel', requireAuth, (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    if (!user.employee_id) {
      res.status(400).json({ error: 'No employee profile linked.' });
      return;
    }

    const cancelled = leaveService.cancelLeave(req.params.id, user.employee_id);

    logAudit(
      { id: user.id, email: user.email, role: user.role },
      'CANCEL_LEAVE',
      'leave_requests',
      cancelled.id,
      null,
      { status: 'cancelled' }
    );

    res.json(cancelled);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// List Leave Requests (Functionality 12 & 13)
router.get('/leave/requests', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const filter: any = {};

  if (user.role === 'employee') {
    filter.employee_id = user.employee_id;
  } else if (req.query.employee_id) {
    filter.employee_id = req.query.employee_id as string;
  }

  if (req.query.status) {
    filter.status = req.query.status as string;
  }

  const list = leaveService.getLeaveRequests(filter);
  res.json(list);
});

// Review Leave Request (Functionality 13 - HR only)
router.post('/leave/:id/review', requireAuth, requireRole(['hr', 'admin']), (req: AuthRequest, res) => {
  try {
    const { decision, comment } = req.body;
    if (!['approved', 'rejected'].includes(decision)) {
      res.status(400).json({ error: 'Decision must be either "approved" or "rejected".' });
      return;
    }

    const reviewed = leaveService.reviewLeave(req.params.id, req.user!.id, decision, comment);

    logAudit(
      { id: req.user!.id, email: req.user!.email, role: req.user!.role },
      `LEAVE_REQUEST_${decision.toUpperCase()}`,
      'leave_requests',
      reviewed.id,
      null,
      { decision, comment }
    );

    res.json(reviewed);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
