import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { FirstRunWizard } from './components/FirstRunWizard';
import { LoginView } from './components/LoginView';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { AIChatDrawer } from './components/AIChatDrawer';
import { DashboardView } from './views/DashboardView';
import { EmployeesView } from './views/EmployeesView';
import { AttendanceView } from './views/AttendanceView';
import { LeaveView } from './views/LeaveView';
import { PayrollView } from './views/PayrollView';
import { OrgSetupView } from './views/OrgSetupView';
import { AuditLogView } from './views/AuditLogView';
import { AnnouncementsView } from './views/AnnouncementsView';

type AuthScreen = 'login' | 'setup';

const MainLayout: React.FC = () => {
  const { user, setupCompleted, loading, mustChangePassword, role } = useAuth();

  // Set default tab based on role after login
  React.useEffect(() => {
    if (user && role) {
      switch (role) {
        case 'admin':
          setCurrentTab('dashboard');
          break;
        case 'hr':
          setCurrentTab('org');
          break;
        case 'employee':
          setCurrentTab('attendance');
          break;
        default:
          setCurrentTab('dashboard');
      }
    }
  }, [user, role]);
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  // Allow toggling between login and setup screens
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');

  if (loading) {
    return (
      <div className="app-splash-loading">
        <div className="spinner-large" />
        <h2 className="splash-title">
          HCM<span className="accent">.</span>Lite
        </h2>
        <p className="splash-subtitle">Connecting to secure operations data store...</p>
      </div>
    );
  }

  // 1. If not logged in, decide which auth screen to show
  if (!user) {
    // If setup is NOT completed → always show setup wizard
    if (setupCompleted === false) {
      return (
        <FirstRunWizard
          onGoToLogin={setupCompleted !== false ? () => setAuthScreen('login') : undefined}
        />
      );
    }

    // Setup IS completed — show login or allow switching to setup (edge case: reset DB scenario)
    if (authScreen === 'setup') {
      return (
        <FirstRunWizard
          onGoToLogin={() => setAuthScreen('login')}
        />
      );
    }

    return (
      <LoginView
        onGoToSetup={setupCompleted === false ? () => setAuthScreen('setup') : undefined}
      />
    );
  }

  // 2. User is logged in — render main app
  const renderCurrentView = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <DashboardView
            openAIChat={() => setIsAIChatOpen(true)}
            navigateToTab={(tab) => setCurrentTab(tab)}
          />
        );
      case 'employees':
        return <EmployeesView />;
      case 'attendance':
        return <AttendanceView />;
      case 'leave':
        return <LeaveView />;
      case 'payroll':
        return <PayrollView />;
      case 'org':
        return <OrgSetupView />;
      case 'audit':
        return <AuditLogView />;
      case 'announcements':
        return <AnnouncementsView />;
      default:
        return (
          <DashboardView
            openAIChat={() => setIsAIChatOpen(true)}
            navigateToTab={(tab) => setCurrentTab(tab)}
          />
        );
    }
  };

  return (
    <div className="app-shell">
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        openAIChat={() => setIsAIChatOpen(true)}
      />

      <div className="main-area">
        <Topbar currentTab={currentTab} openAIChat={() => setIsAIChatOpen(true)} />
        <main className="page-content">{renderCurrentView()}</main>
      </div>

      {mustChangePassword && <ChangePasswordModal />}

      <AIChatDrawer isOpen={isAIChatOpen} onClose={() => setIsAIChatOpen(false)} />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
