import React from 'react';
import {
  LayoutDashboard,
  Users,
  Clock3,
  CalendarDays,
  Wallet,
  Settings2,
  Bot,
  LogOut,
  Shield,
  Building2,
  Megaphone,
  History,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  openAIChat: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, openAIChat }) => {
  const { user, role, logout } = useAuth();

  const getMenuItems = () => {
    const items = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'employees', label: 'Employees', icon: Users },
      { id: 'attendance', label: 'Attendance', icon: Clock3 },
      { id: 'leave', label: 'Leave', icon: CalendarDays },
      { id: 'payroll', label: 'Payroll', icon: Wallet },
      { id: 'announcements', label: 'Announcements', icon: Megaphone },
    ];

    if (role === 'admin' || role === 'hr') {
      items.push({ id: 'org', label: 'Organization', icon: Settings2 });
    }

    if (role === 'admin') {
      items.push({ id: 'audit', label: 'Audit Log', icon: History });
    }

    return items;
  };

  const menuItems = getMenuItems();

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <Shield size={22} />
        </span>
        <div>
          <strong className="brand-title">
            HCM<span className="accent">.</span>Lite
          </strong>
          <small className="brand-subtitle">SAYLANI HACKATHON</small>
        </div>
      </div>

      <div className="workspace-badge">
        <Building2 size={16} className="workspace-icon" />
        <div className="workspace-info">
          <span className="workspace-role">{role?.toUpperCase()} PORTAL</span>
          <span className="workspace-user" title={user?.email}>{user?.email}</span>
        </div>
      </div>

      <div className="nav-label">MAIN NAVIGATION</div>
      <nav className="navigation">
        {menuItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setCurrentTab(id)}
            className={`nav-item ${currentTab === id ? 'active' : ''}`}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}

        <button
          onClick={openAIChat}
          className="nav-item ai-nav-btn"
        >
          <Bot size={18} />
          <span>AI Assistant</span>
          <span className="ai-tag">AI</span>
        </button>
      </nav>

      <div className="sidebar-bottom">
        <div className="user-profile-bar">
          <div className="user-avatar">
            {user?.email.charAt(0).toUpperCase()}
          </div>
          <div className="user-text">
            <span className="user-email" title={user?.email}>{user?.email}</span>
            <span className="user-role-tag">{role}</span>
          </div>
          <button onClick={logout} className="logout-btn" title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
        <div className="version-tag">HCM LITE v1.0.0 · 2026 EDITION</div>
      </div>
    </aside>
  );
};
