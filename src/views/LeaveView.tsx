import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  Plus,
  Sparkles,
  CheckCircle2,
  X,
  Check,
  Ban,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export const LeaveView: React.FC = () => {
  const { user, role } = useAuth();
  const [balances, setBalances] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'my_leaves' | 'approvals'>('my_leaves');

  // Apply Modal
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [smartInput, setSmartInput] = useState('');
  const [parsingSmart, setParsingSmart] = useState(false);
  const [applyForm, setApplyForm] = useState({
    leave_type_id: '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    reason: '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const [bals, types, reqs] = await Promise.all([
        api.getLeaveBalances(),
        api.getLeaveTypes(),
        api.getLeaveRequests(),
      ]);
      setBalances(bals);
      setLeaveTypes(types);
      setLeaveRequests(reqs);
      if (types.length > 0 && !applyForm.leave_type_id) {
        setApplyForm((prev) => ({ ...prev, leave_type_id: types[0].id }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  // Smart Leave Parser
  const handleSmartLeaveParse = async () => {
    if (!smartInput.trim()) return;
    setParsingSmart(true);
    setFormError(null);
    try {
      const parsed = await api.smartLeave(smartInput);
      const matchedType = leaveTypes.find((lt) => lt.code === parsed.leave_type_code) || leaveTypes[0];

      setApplyForm({
        leave_type_id: matchedType?.id || '',
        start_date: parsed.start_date,
        end_date: parsed.end_date,
        reason: parsed.reason,
      });
      setShowApplyModal(true);
    } catch (err: any) {
      setFormError('Failed to parse sentence with Smart Leave.');
    } finally {
      setParsingSmart(false);
    }
  };

  // Submit Leave Request
  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      await api.applyLeave(applyForm);
      setStatusMessage('Leave request successfully submitted for HR approval.');
      setShowApplyModal(false);
      setSmartInput('');
      fetchLeaves();
    } catch (err: any) {
      setFormError(err.message || 'Could not apply for leave.');
    }
  };

  // Cancel Leave
  const handleCancelLeave = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this leave request?')) return;
    try {
      await api.cancelLeave(id);
      setStatusMessage('Leave request cancelled.');
      fetchLeaves();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Review Leave (HR)
  const handleReviewLeave = async (id: string, decision: 'approved' | 'rejected') => {
    const comment = prompt(`HR Comment for ${decision}:`) || '';
    try {
      await api.reviewLeave(id, decision, comment);
      setStatusMessage(`Leave request has been ${decision}.`);
      fetchLeaves();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const pendingApprovalsCount = leaveRequests.filter((r) => r.status === 'pending').length;

  return (
    <div className="view-content">
      <div className="view-header-row">
        <div>
          <h2>Leave Management & Quotas</h2>
          <p className="subtitle">
            Automated working day calculation (skips weekends and public holidays), balance tracking, and approvals.
          </p>
        </div>

        {user?.employee_id && (
          <button onClick={() => setShowApplyModal(true)} className="btn-primary">
            <Plus size={16} />
            <span>Apply for Leave</span>
          </button>
        )}
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

      {/* SMART LEAVE NATURAL LANGUAGE BAR (Functionality 21) */}
      <div className="smart-leave-box">
        <div className="smart-leave-header">
          <div className="flex-align-gap">
            <Sparkles size={16} className="accent" />
            <strong>Smart Leave AI</strong>
          </div>
          <span className="ai-badge">Natural Language Extraction</span>
        </div>
        <p className="smart-leave-desc">
          Type your leave in plain words (e.g. <em>"Need next Monday and Tuesday off for my sister's wedding"</em>) and AI will pre-fill the form automatically.
        </p>
        <div className="smart-leave-input-row">
          <input
            type="text"
            value={smartInput}
            onChange={(e) => setSmartInput(e.target.value)}
            placeholder="Type your leave request in plain words..."
          />
          <button
            onClick={handleSmartLeaveParse}
            disabled={parsingSmart || !smartInput.trim()}
            className="btn-primary"
          >
            {parsingSmart ? 'Parsing...' : 'Extract & Pre-fill'}
          </button>
        </div>
      </div>

      {/* Leave Balances Grid (Functionality 12) */}
      {balances.length > 0 && (
        <div className="kpi-grid my-4">
          {balances.map((b) => (
            <div key={b.id} className="metric-card">
              <div className="metric-header">
                <span>{b.name}</span>
                <CalendarDays size={18} className="accent" />
              </div>
              <div className="metric-number">
                {b.is_unpaid ? 'Unlimited' : `${b.remaining} days`}
              </div>
              <div className="metric-footer">
                {b.is_unpaid
                  ? `${b.used} days taken`
                  : `Used: ${b.used} · Pending: ${b.pending} of ${b.quota} days`}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Role Tabs */}
      {(role === 'hr' || role === 'admin') && (
        <div className="view-tab-bar">
          <button
            className={`tab-btn ${activeTab === 'my_leaves' ? 'active' : ''}`}
            onClick={() => setActiveTab('my_leaves')}
          >
            All Organization Leaves
          </button>
          <button
            className={`tab-btn ${activeTab === 'approvals' ? 'active' : ''}`}
            onClick={() => setActiveTab('approvals')}
          >
            HR Approval Inbox ({pendingApprovalsCount})
          </button>
        </div>
      )}

      {/* LEAVE REQUESTS TABLE */}
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Department</th>
              <th>Leave Type</th>
              <th>Dates</th>
              <th>Working Days</th>
              <th>Reason</th>
              <th>Status</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-6">
                  Loading leave records...
                </td>
              </tr>
            ) : leaveRequests.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-6 empty-subtext">
                  No leave requests found.
                </td>
              </tr>
            ) : (
              leaveRequests
                .filter((r) => (activeTab === 'approvals' ? r.status === 'pending' : true))
                .map((req) => (
                  <tr key={req.id}>
                    <td>
                      <strong>{req.employee_name}</strong>
                      <small className="block muted-text">{req.employee_code}</small>
                    </td>
                    <td>{req.department_name}</td>
                    <td>
                      <span className="leave-type-chip">{req.leave_type_name}</span>
                    </td>
                    <td>
                      {req.start_date} to {req.end_date}
                    </td>
                    <td>
                      <strong>{req.days_count} day(s)</strong>
                    </td>
                    <td>{req.reason}</td>
                    <td>
                      <span className={`status-pill ${req.status}`}>{req.status}</span>
                    </td>
                    <td className="text-right">
                      {/* HR Approval Actions */}
                      {activeTab === 'approvals' && req.status === 'pending' && (
                        <div className="action-buttons-inline">
                          <button
                            onClick={() => handleReviewLeave(req.id, 'approved')}
                            className="btn-approve"
                            title="Approve leave"
                          >
                            <Check size={14} /> Approve
                          </button>
                          <button
                            onClick={() => handleReviewLeave(req.id, 'rejected')}
                            className="btn-reject"
                            title="Reject leave"
                          >
                            <Ban size={14} /> Reject
                          </button>
                        </div>
                      )}

                      {/* Employee Cancel Action */}
                      {role === 'employee' && req.status === 'pending' && (
                        <button
                          onClick={() => handleCancelLeave(req.id)}
                          className="btn-link error-link"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>

      {/* APPLY LEAVE MODAL */}
      {showApplyModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h3>Apply for Leave</h3>
              <button onClick={() => setShowApplyModal(false)} className="close-btn">
                <X size={18} />
              </button>
            </div>

            {formError && <div className="alert-error">{formError}</div>}

            <form onSubmit={handleApplySubmit}>
              <div className="form-group">
                <label>Leave Category</label>
                <select
                  required
                  value={applyForm.leave_type_id}
                  onChange={(e) => setApplyForm({ ...applyForm, leave_type_id: e.target.value })}
                >
                  {leaveTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.is_unpaid ? 'Unlimited' : `${t.yearly_quota} days/yr`})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    required
                    value={applyForm.start_date}
                    onChange={(e) => setApplyForm({ ...applyForm, start_date: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    required
                    value={applyForm.end_date}
                    onChange={(e) => setApplyForm({ ...applyForm, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Reason for Leave</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain reason for leave..."
                  value={applyForm.reason}
                  onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Confirm & Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
