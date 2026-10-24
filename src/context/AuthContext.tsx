import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';
import type { UserSession } from '../api/client';

interface AuthContextType {
  user: UserSession | null;
  role: 'admin' | 'hr' | 'employee' | null;
  setupCompleted: boolean | null;
  loading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  checkSetupStatus: () => Promise<boolean>;
  mustChangePassword: boolean;
  clearPasswordChangeFlag: () => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem('hcm_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const checkSetupStatus = async (): Promise<boolean> => {
    try {
      const res = await api.getSetupStatus();
      setSetupCompleted(res.setupCompleted);
      return res.setupCompleted;
    } catch (e) {
      console.error('Failed to get setup status', e);
      setSetupCompleted(false);
      return false;
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await checkSetupStatus();
      const savedUser = localStorage.getItem('hcm_user');
      if (savedUser) {
        const u = JSON.parse(savedUser);
        setUser(u);
        if (u.must_change_password) {
          setMustChangePassword(true);
        }
      }
      setLoading(false);
    };

    init();

    const handleAuthChange = () => {
      const saved = localStorage.getItem('hcm_user');
      setUser(saved ? JSON.parse(saved) : null);
    };

    window.addEventListener('hcm_auth_changed', handleAuthChange);
    return () => window.removeEventListener('hcm_auth_changed', handleAuthChange);
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    const res = await api.login(credentials);
    localStorage.setItem('hcm_token', res.token);
    localStorage.setItem('hcm_user', JSON.stringify(res.user));
    setUser(res.user);
    setMustChangePassword(Boolean(res.must_change_password));
  };

  const logout = () => {
    localStorage.removeItem('hcm_token');
    localStorage.removeItem('hcm_user');
    setUser(null);
    setMustChangePassword(false);
  };

  const clearPasswordChangeFlag = () => {
    setMustChangePassword(false);
    if (user) {
      const updated = { ...user, must_change_password: false };
      setUser(updated);
      localStorage.setItem('hcm_user', JSON.stringify(updated));
    }
  };

  const refreshUser = () => {
    const saved = localStorage.getItem('hcm_user');
    setUser(saved ? JSON.parse(saved) : null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        setupCompleted,
        loading,
        login,
        logout,
        checkSetupStatus,
        mustChangePassword,
        clearPasswordChangeFlag,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
