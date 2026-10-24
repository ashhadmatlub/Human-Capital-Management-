import { Router } from 'express';
import { attendanceService } from '../services/attendanceService';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();

// Web & Camera Check-in (Functionality 09 + Bonus)
router.post('/attendance/check-in', requireAuth, (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    if (!user.employee_id) {
      res.status(400).json({ error: 'Current user does not have an employee profile linked.' });
      return;
    }

    const { source, lat, lng, face_detected } = req.body;

    const result = attendanceService.checkIn({
      employee_id: user.employee_id,
      source: source || 'web',
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
      face_detected: Boolean(face_detected),
    });

    logAudit(
      { id: user.id, email: user.email, role: user.role },
      'ATTENDANCE_CHECK_IN',
      'attendance',
      result.record.id,
      null,
      { status: result.record.status, source: result.record.source }
    );

    res.status(201).json(result);
  } catch (err: any) {
    const status = err.status || 400;
    res.status(status).json({ error: err.message });
  }
});

// Check-out (Functionality 09)
router.post('/attendance/check-out', requireAuth, (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    if (!user.employee_id) {
      res.status(400).json({ error: 'Current user does not have an employee profile linked.' });
      return;
    }

    const record = attendanceService.checkOut(user.employee_id);

    logAudit(
      { id: user.id, email: user.email, role: user.role },
      'ATTENDANCE_CHECK_OUT',
      'attendance',
      record.id,
      null,
      { total_hours: record.total_hours, status: record.status }
    );

    res.json({ record, message: `Checked out successfully. Total hours: ${record.total_hours} hrs.` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Attendance Board (Functionality 10)
router.get('/attendance/board', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const date = req.query.date as string | undefined;

  const data = attendanceService.getDailyBoard(date);

  // If Employee, scope board records strictly to own record
  if (user.role === 'employee') {
    const scopedRecords = data.records.filter((r) => r.employee_id === user.employee_id);
    res.json({
      summary: {
        date: data.summary.date,
        total_employees: 1,
        present: scopedRecords.filter((r) => r.status === 'present').length,
        late: scopedRecords.filter((r) => r.status === 'late').length,
        half_day: scopedRecords.filter((r) => r.status === 'half_day').length,
        on_leave: scopedRecords.filter((r) => r.status === 'on_leave').length,
        absent: scopedRecords.filter((r) => r.status === 'absent').length,
      },
      records: scopedRecords,
    });
    return;
  }

  res.json(data);
});

// Attendance History (Functionality 10)
router.get('/attendance/history', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const requestedEmpId = (req.query.employee_id as string) || user.employee_id;
  const month = req.query.month as string | undefined;

  if (user.role === 'employee' && requestedEmpId !== user.employee_id) {
    res.status(403).json({ error: 'Forbidden: You can only view your own attendance history.' });
    return;
  }

  if (!requestedEmpId) {
    res.json([]);
    return;
  }

  const history = attendanceService.getEmployeeHistory(requestedEmpId, month);
  res.json(history);
});

// Request Attendance Correction (Functionality 11)
router.post('/attendance/corrections', requireAuth, (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    if (!user.employee_id) {
      res.status(400).json({ error: 'No employee profile linked to current account.' });
      return;
    }

    const { date, requested_check_in, requested_check_out, reason } = req.body;
    if (!date || !requested_check_in || !reason) {
      res.status(400).json({ error: 'Date, requested check-in time, and reason are required.' });
      return;
    }

    const correction = attendanceService.requestCorrection({
      employee_id: user.employee_id,
      date,
      requested_check_in,
      requested_check_out,
      reason,
    });

    logAudit(
      { id: user.id, email: user.email, role: user.role },
      'REQUEST_ATTENDANCE_CORRECTION',
      'attendance_corrections',
      correction.id,
      null,
      correction
    );

    res.status(201).json(correction);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// List Attendance Corrections (Functionality 11)
router.get('/attendance/corrections', requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const empIdFilter = user.role === 'employee' ? user.employee_id : (req.query.employee_id as string);
  const list = attendanceService.getCorrections(empIdFilter);
  res.json(list);
});

// Review Attendance Correction (Functionality 11 - HR only)
router.post('/attendance/corrections/:id/review', requireAuth, requireRole(['hr', 'admin']), (req: AuthRequest, res) => {
  try {
    const { decision, comment } = req.body;
    if (!['approved', 'rejected'].includes(decision)) {
      res.status(400).json({ error: 'Decision must be either "approved" or "rejected".' });
      return;
    }

    const reviewed = attendanceService.reviewCorrection(req.params.id, req.user!.id, decision, comment);

    logAudit(
      { id: req.user!.id, email: req.user!.email, role: req.user!.role },
      `ATTENDANCE_CORRECTION_${decision.toUpperCase()}`,
      'attendance_corrections',
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
