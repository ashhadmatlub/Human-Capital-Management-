import React, { useState, useEffect } from 'react';
import {
  Plus,
  CheckCircle2,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export const OrgSetupView: React.FC = () => {
  const { role } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs
  const [activeTab, setActiveTab] = useState<'settings' | 'departments' | 'designations' | 'leave_types' | 'holidays' | 'users'>('settings');

  // Modals
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: '', code: '' });

  const [showDesigModal, setShowDesigModal] = useState(false);
  const [desigForm, setDesigForm] = useState({ name: '', department_id: '' });

  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayForm, setHolidayForm] = useState({ name: '', date: '' });

  const [showHRModal, setShowHRModal] = useState(false);
  const [hrForm, setHrForm] = useState({ email: '', password: '' });

  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [s, depts, desigs, lTypes, hols] = await Promise.all([
        api.getSettings(),
        api.getDepartments(),
        api.getDesignations(),
        api.getLeaveTypes(),
        api.getPublicHolidays(),
      ]);
      setSettings(s);
      setDepartments(depts);
      setDesignations(desigs);
      setLeaveTypes(lTypes);
      setHolidays(hols);

      if (role === 'admin') {
        const u = await api.listUsers();
        setUsers(u);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [role]);

  // Save Settings (Admin)
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateSettings(settings);
      setStatusMessage('Organization settings successfully updated.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Create Department (Admin)
  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createDepartment(deptForm);
      setStatusMessage(`Department ${deptForm.name} created.`);
      setShowDeptModal(false);
      setDeptForm({ name: '', code: '' });
      fetchAll();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Create Designation (Admin)
  const handleCreateDesig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createDesignation(desigForm);
      setStatusMessage(`Designation ${desigForm.name} created.`);
      setShowDesigModal(false);
      setDesigForm({ name: '', department_id: departments[0]?.id || '' });
      fetchAll();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Create Public Holiday (Admin)
  const handleCreateHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createPublicHoliday(holidayForm);
      setStatusMessage(`Public holiday ${holidayForm.name} added.`);
      setShowHolidayModal(false);
      setHolidayForm({ name: '', date: '' });
      fetchAll();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Create HR Account (Admin)
  const handleCreateHR = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createHRUser(hrForm);
      setStatusMessage(`HR account ${hrForm.email} created.`);
      setShowHRModal(false);
      setHrForm({ email: '', password: '' });
      fetchAll();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Reset User Password
  const handleResetPassword = async (userId: string) => {
    const tempPass = prompt('Enter temporary password to assign:', 'Saylani@2026');
    if (!tempPass) return;
    try {
      await api.resetPassword(userId, tempPass);
      setStatusMessage(`User password reset to temporary password: ${tempPass}`);
      fetchAll();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Toggle User Active
  const handleToggleUser = async (userId: string, currentActive: boolean) => {
    try {
      await api.toggleUserActive(userId, !currentActive);
      setStatusMessage(`User account ${!currentActive ? 'activated' : 'deactivated'}.`);
      fetchAll();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="view-loading">
        <div className="spinner" />
        <p>Loading organization setup and rules...</p>
      </div>
    );
  }

  return (
    <div className="view-content">
      <div className="view-header-row">
        <div>
          <h2>Organization & Master Rules Engine</h2>
          <p className="subtitle">
            Configure working hours, departments, leave quotas, office geofence and user access control.
          </p>
        </div>
      </div>

      {statusMessage && (
        <div className="alert-banner success">
          <CheckCircle2 size={16} />
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="alert-close">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="view-tab-bar">
        <button
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Company Settings & Rules
        </button>
        <button
          className={`tab-btn ${activeTab === 'departments' ? 'active' : ''}`}
          onClick={() => setActiveTab('departments')}
        >
          Departments ({departments.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'designations' ? 'active' : ''}`}
          onClick={() => setActiveTab('designations')}
        >
          Designations ({designations.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'leave_types' ? 'active' : ''}`}
          onClick={() => setActiveTab('leave_types')}
        >
          Leave Types & Quotas
        </button>
        <button
          className={`tab-btn ${activeTab === 'holidays' ? 'active' : ''}`}
          onClick={() => setActiveTab('holidays')}
        >
          Public Holidays ({holidays.length})
        </button>
        {role === 'admin' && (
          <button
            className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            User Access & HR Logins ({users.length})
          </button>
        )}
      </div>

      {/* 1. SETTINGS TAB */}
      {activeTab === 'settings' && settings && (
        <div className="panel max-w-3xl">
          <div className="panel-header">
            <h3>Company Configuration</h3>
            {role !== 'admin' && <span className="pill muted-pill">READ ONLY</span>}
          </div>

          <form onSubmit={handleSaveSettings}>
            <div className="form-grid">
              <div className="form-group">
                <label>Company Display Name</label>
                <input
                  type="text"
                  disabled={role !== 'admin'}
                  value={settings.company_name}
                  onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Default Currency</label>
                <input
                  type="text"
                  disabled={role !== 'admin'}
                  value={settings.currency || 'PKR'}
                  onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                />
              </div>
            </div>

            <div className="form-grid-3">
              <div className="form-group">
                <label>Office Start Time</label>
                <input
                  type="time"
                  disabled={role !== 'admin'}
                  value={settings.office_start}
                  onChange={(e) => setSettings({ ...settings, office_start: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Grace Period (Minutes)</label>
                <input
                  type="number"
                  disabled={role !== 'admin'}
                  value={settings.grace_minutes}
                  onChange={(e) => setSettings({ ...settings, grace_minutes: Number(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label>Half-Day Threshold (Hours)</label>
                <input
                  type="number"
                  disabled={role !== 'admin'}
                  value={settings.half_day_hours}
                  onChange={(e) => setSettings({ ...settings, half_day_hours: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="form-grid-3">
              <div className="form-group">
                <label>Office Latitude</label>
                <input
                  type="number"
                  step="any"
                  disabled={role !== 'admin'}
                  value={settings.office_lat}
                  onChange={(e) => setSettings({ ...settings, office_lat: Number(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label>Office Longitude</label>
                <input
                  type="number"
                  step="any"
                  disabled={role !== 'admin'}
                  value={settings.office_lng}
                  onChange={(e) => setSettings({ ...settings, office_lng: Number(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label>Geofence Radius (Meters)</label>
                <input
                  type="number"
                  disabled={role !== 'admin'}
                  value={settings.office_radius_meters}
                  onChange={(e) => setSettings({ ...settings, office_radius_meters: Number(e.target.value) })}
                />
              </div>
            </div>

            {/* Bonus late penalty toggle */}
            <div className="checkbox-row my-3">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  disabled={role !== 'admin'}
                  checked={Boolean(settings.late_penalty_enabled)}
                  onChange={(e) => setSettings({ ...settings, late_penalty_enabled: e.target.checked })}
                />
                <span>Enable Late Penalty Rule (3 lates in a month = 0.5 day salary deduction)</span>
              </label>
            </div>

            {role === 'admin' && (
              <button type="submit" className="btn-primary mt-3">
                Save Organization Settings
              </button>
            )}
          </form>
        </div>
      )}

      {/* 2. DEPARTMENTS TAB */}
      {activeTab === 'departments' && (
        <div className="panel">
          <div className="flex-between mb-3">
            <h3>Company Departments</h3>
            {role === 'admin' && (
              <button onClick={() => setShowDeptModal(true)} className="btn-primary">
                <Plus size={16} /> Add Department
              </button>
            )}
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Department Name</th>
                  <th>Department Code</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {departments.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-6 empty-subtext">
                      No departments added yet.
                    </td>
                  </tr>
                ) : (
                  departments.map((d) => (
                    <tr key={d.id}>
                      <td><strong>{d.name}</strong></td>
                      <td><span className="code-badge">{d.code}</span></td>
                      <td>{new Date(d.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. DESIGNATIONS TAB */}
      {activeTab === 'designations' && (
        <div className="panel">
          <div className="flex-between mb-3">
            <h3>Designation Hierarchy</h3>
            {role === 'admin' && (
              <button
                onClick={() => {
                  setDesigForm({ name: '', department_id: departments[0]?.id || '' });
                  setShowDesigModal(true);
                }}
                className="btn-primary"
              >
                <Plus size={16} /> Add Designation
              </button>
            )}
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Designation Title</th>
                  <th>Department</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {designations.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-6 empty-subtext">
                      No designations configured yet.
                    </td>
                  </tr>
                ) : (
                  designations.map((desig) => {
                    const dept = departments.find((d) => d.id === desig.department_id);
                    return (
                      <tr key={desig.id}>
                        <td><strong>{desig.name}</strong></td>
                        <td>{dept?.name || 'Unassigned'}</td>
                        <td>{new Date(desig.created_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. LEAVE TYPES TAB */}
      {activeTab === 'leave_types' && (
        <div className="panel">
          <div className="panel-header">
            <h3>Leave Types & Yearly Quotas</h3>
            <span className="pill">Mandatory Policy</span>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Leave Type</th>
                  <th>Code</th>
                  <th>Yearly Quota</th>
                  <th>Classification</th>
                </tr>
              </thead>
              <tbody>
                {leaveTypes.map((lt) => (
                  <tr key={lt.id}>
                    <td><strong>{lt.name}</strong></td>
                    <td><span className="code-badge">{lt.code}</span></td>
                    <td>
                      <strong>{lt.is_unpaid ? 'Unlimited' : `${lt.yearly_quota} days`}</strong>
                    </td>
                    <td>{lt.is_unpaid ? 'Unpaid' : 'Paid Quota'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. PUBLIC HOLIDAYS TAB */}
      {activeTab === 'holidays' && (
        <div className="panel">
          <div className="flex-between mb-3">
            <h3>Public Holidays Calendar</h3>
            {role === 'admin' && (
              <button onClick={() => setShowHolidayModal(true)} className="btn-primary">
                <Plus size={16} /> Add Public Holiday
              </button>
            )}
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Holiday Name</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {holidays.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="text-center py-6 empty-subtext">
                      No public holidays registered.
                    </td>
                  </tr>
                ) : (
                  holidays.map((h) => (
                    <tr key={h.id}>
                      <td><strong>{h.name}</strong></td>
                      <td>{h.date}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. USERS MANAGEMENT TAB (Admin only) */}
      {activeTab === 'users' && role === 'admin' && (
        <div className="panel">
          <div className="flex-between mb-3">
            <h3>User Credentials & Access Accounts</h3>
            <button onClick={() => setShowHRModal(true)} className="btn-primary">
              <Plus size={16} /> Create HR Login
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User Email</th>
                  <th>Role</th>
                  <th>Linked Profile</th>
                  <th>Must Change Password</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.email}</strong></td>
                    <td>
                      <span className={`role-badge ${u.role}`}>{u.role}</span>
                    </td>
                    <td>{u.employee_name || 'System / Operations'}</td>
                    <td>{u.must_change_password ? 'YES (Pending)' : 'NO'}</td>
                    <td>
                      <span className={`status-pill ${u.is_active ? 'active' : 'resigned'}`}>
                        {u.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="action-buttons-inline">
                        <button
                          onClick={() => handleResetPassword(u.id)}
                          className="btn-link"
                          title="Reset Password"
                        >
                          Reset Pass
                        </button>
                        {u.role !== 'admin' && (
                          <button
                            onClick={() => handleToggleUser(u.id, u.is_active)}
                            className={`btn-link ${u.is_active ? 'error-link' : 'success-link'}`}
                          >
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE DEPT MODAL */}
      {showDeptModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h3>Create Department</h3>
              <button onClick={() => setShowDeptModal(false)} className="close-btn">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateDept}>
              <div className="form-group">
                <label>Department Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Engineering"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Department Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ENG"
                  value={deptForm.code}
                  onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowDeptModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE DESIG MODAL */}
      {showDesigModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h3>Create Designation</h3>
              <button onClick={() => setShowDesigModal(false)} className="close-btn">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateDesig}>
              <div className="form-group">
                <label>Designation Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lead Software Engineer"
                  value={desigForm.name}
                  onChange={(e) => setDesigForm({ ...desigForm, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Assigned Department</label>
                <select
                  required
                  value={desigForm.department_id}
                  onChange={(e) => setDesigForm({ ...desigForm, department_id: e.target.value })}
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowDesigModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Designation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE HOLIDAY MODAL */}
      {showHolidayModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h3>Add Public Holiday</h3>
              <button onClick={() => setShowHolidayModal(false)} className="close-btn">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateHoliday}>
              <div className="form-group">
                <label>Holiday Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pakistan Independence Day"
                  value={holidayForm.name}
                  onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Date (YYYY-MM-DD)</label>
                <input
                  type="date"
                  required
                  value={holidayForm.date}
                  onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowHolidayModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Holiday
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE HR MODAL */}
      {showHRModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h3>Create HR Operations Login</h3>
              <button onClick={() => setShowHRModal(false)} className="close-btn">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateHR}>
              <div className="form-group">
                <label>HR Work Email</label>
                <input
                  type="email"
                  required
                  placeholder="hr@company.com"
                  value={hrForm.email}
                  onChange={(e) => setHrForm({ ...hrForm, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Initial Password</label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={hrForm.password}
                  onChange={(e) => setHrForm({ ...hrForm, password: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowHRModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create HR Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
