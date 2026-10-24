import React, { useState } from 'react';
import { Shield, Lock, Mail, ArrowRight, UserCheck, Eye, EyeOff, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LoginViewProps {
  onGoToSetup?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onGoToSetup }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login({ email, password });
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="login-card">
        <div className="login-header">
          <div className="login-icon">
            <Shield size={28} />
          </div>
          <h2>Welcome to HCM Lite</h2>
          <p>Sign in to access your Human Capital Management portal</p>
        </div>

        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Work Email</label>
            <div className="input-with-icon">
              <Mail size={16} className="input-icon" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-with-icon">
              <Lock size={16} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="input-icon-btn"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary full-width">
            {loading ? (
              'Authenticating...'
            ) : (
              <>
                Sign In to Portal <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <div className="access-info">
            <UserCheck size={14} className="accent" />
            <span>Server-side RBAC enforces strict Admin, HR & Employee data boundaries.</span>
          </div>

          {/* Info box about account creation */}
          <div className="login-signup-note">
            <button
              type="button"
              className="btn-ghost-small"
              onClick={() => setShowInfo((v) => !v)}
            >
              <Info size={13} />
              <span>How do I get an account?</span>
            </button>
            {showInfo && (
              <div className="signup-info-box">
                <p>
                  <strong>HCM Lite is an invite-only system.</strong> Accounts are created by your
                  Administrator or HR team — not through public self-registration.
                </p>
                <ul>
                  <li>🔑 <strong>Admin</strong> — Created during First-Run Setup</li>
                  <li>👔 <strong>HR Users</strong> — Created by Admin in User Management</li>
                  <li>👤 <strong>Employees</strong> — Created via Employee Registration module</li>
                </ul>
                <p>Contact your system administrator if you need access.</p>
              </div>
            )}
          </div>

          {/* Link to setup if org is not configured */}
          {onGoToSetup && (
            <div className="login-setup-link">
              <button onClick={onGoToSetup} className="btn-ghost-small">
                <span>First time? Run organization setup →</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
