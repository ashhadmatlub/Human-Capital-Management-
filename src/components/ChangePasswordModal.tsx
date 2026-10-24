import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export const ChangePasswordModal: React.FC = () => {
  const { clearPasswordChangeFlag } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.changePassword(newPassword);
      clearPasswordChangeFlag();
    } catch (err: any) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-box">
        <div className="modal-icon-header">
          <div className="icon-wrapper warning">
            <KeyRound size={24} />
          </div>
          <h3>Change Temporary Password</h3>
          <p>
            You are signing in with a temporary password. You must set a permanent secure password to continue.
          </p>
        </div>

        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>New Permanent Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 6 characters"
            />
          </div>

          <div className="form-group">
            <label>Confirm Permanent Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
            />
          </div>

          <div className="modal-actions">
            <button type="submit" disabled={loading} className="btn-primary full-width">
              {loading ? 'Updating Password...' : 'Save Password & Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
