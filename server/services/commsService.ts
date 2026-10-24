import { randomUUID } from 'crypto';
import { db, Announcement, Notification } from '../db/database';

export const commsService = {
  getAnnouncements() {
    return db.get('announcements').slice(0, 30);
  },

  createAnnouncement(data: {
    title: string;
    content: string;
    priority?: 'normal' | 'important' | 'urgent';
    author_id: string;
    author_name: string;
  }): Announcement {
    const list = db.get('announcements');
    const item: Announcement = {
      id: randomUUID(),
      title: data.title.trim(),
      content: data.content.trim(),
      priority: data.priority || 'normal',
      author_id: data.author_id,
      author_name: data.author_name,
      created_at: new Date().toISOString(),
    };
    list.unshift(item);
    db.set('announcements', list);
    return item;
  },

  getNotifications(userId: string) {
    return db.get('notifications').filter((n) => n.user_id === userId);
  },

  markNotificationAsRead(notificationId: string, userId: string) {
    const list = db.get('notifications');
    const notif = list.find((n) => n.id === notificationId && n.user_id === userId);
    if (notif) {
      notif.is_read = true;
      db.set('notifications', list);
    }
  },

  getAuditLogs() {
    return db.get('audit_logs');
  },
};
