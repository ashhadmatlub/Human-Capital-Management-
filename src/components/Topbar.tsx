import React, { useState, useEffect } from 'react';
import { Bell, Sparkles, Clock } from 'lucide-react';
import { api } from '../api/client';

interface TopbarProps {
  currentTab: string;
  openAIChat: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ currentTab, openAIChat }) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  const fetchNotifs = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    const notifInterval = setInterval(fetchNotifs, 10000);
    return () => {
      clearInterval(interval);
      clearInterval(notifInterval);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAsRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (e) {
      // ignore
    }
  };

  const getBreadcrumbTitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return 'Overview & Real-Time Metrics';
      case 'employees':
        return 'People Directory & Employee 360';
      case 'attendance':
        return 'Time Tracking & Daily Attendance Board';
      case 'leave':
        return 'Leave Management & Quota Tracking';
      case 'payroll':
        return 'Payroll Lite & Payslips';
      case 'org':
        return 'Organization Setup & Rules Engine';
      case 'audit':
        return 'Security & Tamper-Proof Audit Trail';
      case 'announcements':
        return 'Company Noticeboard & Broadcasts';
      default:
        return 'Workspace';
    }
  };

  return (
    <header className="topbar">
      <div className="breadcrumb">
        <span>HCM Lite</span>
        <span className="breadcrumb-slash">/</span>
        <strong className="breadcrumb-active">{getBreadcrumbTitle()}</strong>
      </div>

      <div className="topbar-actions">
        <div className="clock-badge">
          <Clock size={14} className="accent" />
          <span>{currentTime}</span>
        </div>

        <button
          onClick={openAIChat}
          className="topbar-ai-btn"
          title="Open AI Assistant"
        >
          <Sparkles size={15} />
          <span>Ask AI</span>
        </button>

        <div className="notification-container">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="notif-trigger"
            title="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
          </button>

          {showNotifs && (
            <div className="notif-dropdown">
              <div className="notif-dropdown-header">
                <strong>Notifications</strong>
                <span className="notif-count-tag">{unreadCount} new</span>
              </div>
              <div className="notif-list">
                {notifications.length === 0 ? (
                  <div className="notif-empty">No notifications yet</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`notif-item ${!n.is_read ? 'unread' : ''}`}
                      onClick={() => markAsRead(n.id)}
                    >
                      <div className="notif-item-top">
                        <span className="notif-item-title">{n.title}</span>
                        <span className="notif-item-time">
                          {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="notif-item-msg">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
