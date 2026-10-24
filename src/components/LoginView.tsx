import React, { useState } from 'react';
import { Shield, Lock, Mail, ArrowRight, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login({ email, password });
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
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
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-with-icon">
              <Lock size={16} className="input-icon" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary full-width">
            {loading ? 'Authenticating...' : (
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
        </div>
      </div>
    </div>
  );
};
