import { Router, Response } from 'express';
import { authService } from '../services/authService';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();

// Check if initial setup is completed
router.get('/setup/status', (req, res) => {
  const completed = authService.isSetupCompleted();
  res.json({ setupCompleted: completed });
});

// First-run bootstrap (Company + Admin)
router.post('/setup/bootstrap', async (req, res) => {
  try {
    const {
      company_name,
      admin_email,
      admin_password,
      office_start,
      grace_minutes,
      half_day_hours,
      office_lat,
      office_lng,
      office_radius_meters,
    } = req.body;

    if (!company_name || !admin_email || !admin_password) {
      res.status(400).json({ error: 'Company name, admin email, and admin password are required.' });
      return;
    }

    const result = await authService.bootstrapFirstRun({
      company_name,
      admin_email,
      admin_password,
      office_start,
      grace_minutes,
      half_day_hours,
      office_lat,
      office_lng,
      office_radius_meters,
    });

    logAudit(
      { id: result.user.id, email: result.user.email, role: 'admin' },
      'FIRST_RUN_SETUP',
      'organization',
      result.user.id,
      null,
      { company_name }
    );

    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Login
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const result = await authService.login(email, password);

    logAudit(
      { id: result.user.id, email: result.user.email, role: result.user.role },
      'USER_LOGIN',
      'users',
      result.user.id
    );

    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

// Change Password
router.post('/auth/change-password', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password) {
      res.status(400).json({ error: 'New password is required.' });
      return;
    }

    await authService.changePassword(req.user!.id, new_password);

    logAudit(
      { id: req.user!.id, email: req.user!.email, role: req.user!.role },
      'PASSWORD_CHANGE',
      'users',
      req.user!.id
    );

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Create HR account (Admin only)
router.post('/auth/users/hr', requireAuth, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const hrUser = await authService.createHRUser(email, password);

    logAudit(
      { id: req.user!.id, email: req.user!.email, role: req.user!.role },
      'CREATE_HR_USER',
      'users',
      hrUser.id,
      null,
      { email }
    );

    res.status(201).json(hrUser);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// List all users (Admin only)
router.get('/auth/users', requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const users = await authService.listUsers();
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle user active status (Admin only)
router.post('/auth/users/:id/toggle-active', requireAuth, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const { is_active } = req.body;
    await authService.toggleUserActive(req.params.id, Boolean(is_active));

    logAudit(
      { id: req.user!.id, email: req.user!.email, role: req.user!.role },
      'TOGGLE_USER_STATUS',
      'users',
      req.params.id,
      null,
      { is_active }
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Reset user password (Admin only)
router.post('/auth/users/:id/reset-password', requireAuth, requireRole(['admin']), async (req: AuthRequest, res) => {
  try {
    const { temp_password } = req.body;
    const tempPass = temp_password || 'Saylani@2026';
    await authService.resetPassword(req.params.id, tempPass);

    logAudit(
      { id: req.user!.id, email: req.user!.email, role: req.user!.role },
      'RESET_PASSWORD',
      'users',
      req.params.id
    );

    res.json({ success: true, temp_password: tempPass });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
