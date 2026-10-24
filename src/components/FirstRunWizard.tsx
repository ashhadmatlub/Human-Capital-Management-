import React, { useState } from 'react';
import { ShieldCheck, Building2, Clock, MapPin, ArrowRight } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export const FirstRunWizard: React.FC = () => {
  const { checkSetupStatus, login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    company_name: 'Saylani Systems Inc.',
    admin_email: 'admin@saylani.com',
    admin_password: 'AdminPassword123!',
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

    try {
      await api.bootstrapSetup(formData);
      // Auto login as admin
      await login({
        email: formData.admin_email,
        password: formData.admin_password,
      });
      await checkSetupStatus();
    } catch (err: any) {
      setError(err.message || 'Setup initialization failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="setup-card">
        <div className="setup-badge">
          <ShieldCheck size={18} />
          <span>FIRST RUN SETUP · FRESH INSTALLATION</span>
        </div>

        <h1 className="setup-title">Initialize HCM Lite</h1>
        <p className="setup-desc">
          HCM Lite starts completely empty. Set up your organization parameters and initial Administrator account to begin operations.
        </p>

        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="setup-form">
          <div className="form-section">
            <h3 className="section-title">
              <Building2 size={16} className="accent" /> Company & Admin Credentials
            </h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Company Name</label>
                <input
                  type="text"
                  required
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="e.g. Acme Corp"
                />
              </div>

              <div className="form-group">
                <label>Administrator Email</label>
                <input
                  type="email"
                  required
                  value={formData.admin_email}
                  onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                  placeholder="admin@company.com"
                />
              </div>

              <div className="form-group full-width">
                <label>Administrator Master Password</label>
                <input
                  type="password"
                  required
                  value={formData.admin_password}
                  onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
                  placeholder="Create strong admin password"
                />
              </div>
            </div>
          </div>

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
                  onChange={(e) => setFormData({ ...formData, office_start: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, grace_minutes: Number(e.target.value) })}
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
                  onChange={(e) => setFormData({ ...formData, half_day_hours: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3 className="section-title">
              <MapPin size={16} className="accent" /> Office Geofence (Camera Check-in Bonus)
            </h3>
            <div className="form-grid-3">
              <div className="form-group">
                <label>Office Latitude</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={formData.office_lat}
                  onChange={(e) => setFormData({ ...formData, office_lat: Number(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label>Office Longitude</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={formData.office_lng}
                  onChange={(e) => setFormData({ ...formData, office_lng: Number(e.target.value) })}
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
                  onChange={(e) => setFormData({ ...formData, office_radius_meters: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>

          <div className="setup-actions">
            <button type="submit" disabled={loading} className="btn-primary full-width">
              {loading ? 'Configuring Organization...' : (
                <>
                  Complete Setup & Launch Organization <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
