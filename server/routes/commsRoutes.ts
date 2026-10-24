import { Router } from 'express';
import { commsService } from '../services/commsService';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth';
import { logAudit } from '../middleware/audit';

const router = Router();

// Announcements (Functionality 23)
router.get('/comms/announcements', requireAuth, (req, res) => {
  const list = commsService.getAnnouncements();
  res.json(list);
});

router.post('/comms/announcements', requireAuth, requireRole(['admin', 'hr']), (req: AuthRequest, res) => {
  try {
    const { title, content, priority } = req.body;
    if (!title || !content) {
      res.status(400).json({ error: 'Title and content are required.' });
      return;
    }

    const item = commsService.createAnnouncement({
      title,
      content,
      priority,
      author_id: req.user!.id,
      author_name: req.user!.email,
    });

    logAudit(
      { id: req.user!.id, email: req.user!.email, role: req.user!.role },
      'POST_ANNOUNCEMENT',
      'announcements',
      item.id,
      null,
      item
    );

    res.status(201).json(item);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Notifications (Functionality 24)
router.get('/comms/notifications', requireAuth, (req: AuthRequest, res) => {
  const notifs = commsService.getNotifications(req.user!.id);
  res.json(notifs);
});

router.post('/comms/notifications/:id/read', requireAuth, (req: AuthRequest, res) => {
  commsService.markNotificationAsRead(req.params.id, req.user!.id);
  res.json({ success: true });
});

// Audit Logs (Functionality 25 - Admin ONLY)
router.get('/comms/audit-logs', requireAuth, requireRole(['admin']), (req, res) => {
  const logs = commsService.getAuditLogs();
  res.json(logs);
});

export default router;
