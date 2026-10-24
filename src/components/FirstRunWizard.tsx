import React, { useState } from 'react';
import { ShieldCheck, Building2, Clock, MapPin, ArrowRight, LogIn, Eye, EyeOff } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface FirstRunWizardProps {
  onGoToLogin?: () => void;
}

export const FirstRunWizard: React.FC<FirstRunWizardProps> = ({ onGoToLogin }) => {
  const { checkSetupStatus, login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    company_name: '',
    admin_email: '',
    admin_password: '',
    office_start: '09:00',
    grace_minutes: 15,
    half_day_hours: 5,
    office_lat: 24.8607,
    office_lng: 67.0011,
    office_radius_meters: 150,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (formData.admin_password.length < 8) {
      setError('Password must be at least 8 characters long.');
      setLoading(false);
      return;
    }

    try {
      await api.bootstrapSetup(formData);
      await login({ email: formData.admin_email, password: formData.admin_password });
      await checkSetupStatus();
    } catch (err: any) {
      setError(err.message || 'Setup initialization failed.');
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string, value: any) => setFormData((p) => ({ ...p, [field]: value }));

  return (
    <div className="auth-overlay">
      <div className="setup-card">
        <div className="setup-badge">
          <ShieldCheck size={18} />
          <span>FIRST RUN SETUP · FRESH INSTALLATION</span>
        </div>

        <h1 className="setup-title">Initialize HCM Lite</h1>
        <p className="setup-desc">
          HCM Lite starts completely empty. Configure your organization and create the initial Administrator account to begin operations.
        </p>

        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="setup-form">
          {/* Company & Admin */}
          <div className="form-section">
            <h3 className="section-title">
              <Building2 size={16} className="accent" /> Company & Admin Credentials
            </h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Company Name <span className="required">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.company_name}
                  onChange={(e) => update('company_name', e.target.value)}
                  placeholder="e.g. Saylani Tech Pvt Ltd"
                />
              </div>

              <div className="form-group">
                <label>Administrator Email <span className="required">*</span></label>
                <input
                  type="email"
                  required
                  value={formData.admin_email}
                  onChange={(e) => update('admin_email', e.target.value)}
                  placeholder="admin@company.com"
                />
              </div>

              <div className="form-group full-width">
                <label>Administrator Password <span className="required">*</span></label>
                <div className="input-with-icon">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={formData.admin_password}
                    onChange={(e) => update('admin_password', e.target.value)}
                    placeholder="Min 8 characters"
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
            </div>
          </div>

          {/* Attendance Rules */}
          <div className="form-section">
            <h3 className="section-title">
              <Clock size={16} className="accent" /> Attendance Rules & Working Hours
            </h3>
            <div className="form-grid-3">
              <div className="form-group">
                <label>Office Start Time</label>
                <input
                  type="time"
                  required
                  value={formData.office_start}
                  onChange={(e) => update('office_start', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Grace Period (Minutes)</label>
                <input
                  type="number"
                  required
                  min={0}
                  max={60}
                  value={formData.grace_minutes}
                  onChange={(e) => update('grace_minutes', Number(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>Half-Day Threshold (Hours)</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={12}
                  value={formData.half_day_hours}
                  onChange={(e) => update('half_day_hours', Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Geofence */}
          <div className="form-section">
            <h3 className="section-title">
              <MapPin size={16} className="accent" /> Office Geofence (Camera Check-in)
            </h3>
            <div className="form-grid-3">
              <div className="form-group">
                <label>Office Latitude</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={formData.office_lat}
                  onChange={(e) => update('office_lat', Number(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>Office Longitude</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={formData.office_lng}
                  onChange={(e) => update('office_lng', Number(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>Authorized Radius (Meters)</label>
                <input
                  type="number"
                  min={10}
                  max={5000}
                  required
                  value={formData.office_radius_meters}
                  onChange={(e) => update('office_radius_meters', Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="setup-actions">
            <button type="submit" disabled={loading} className="btn-primary full-width">
              {loading ? (
                'Configuring Organization...'
              ) : (
                <>
                  Complete Setup & Launch Organization <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Back to login link — shown if setup was already done */}
        {onGoToLogin && (
          <div className="setup-login-link">
            <button onClick={onGoToLogin} className="btn-ghost-small">
              <LogIn size={14} />
              <span>Already set up? Sign in instead</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
