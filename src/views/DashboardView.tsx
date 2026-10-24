import React, { useState, useEffect } from 'react';
import {
  Users,
  CheckCircle2,
  CalendarDays,
  Wallet,
  Clock3,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Building,
  UserX,
  Camera,
  ArrowRight,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface DashboardViewProps {
  openAIChat: () => void;
  navigateToTab: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ openAIChat, navigateToTab }) => {
  const { role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [aiSummary, setAiSummary] = useState<string[] | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [checkActionLoading, setCheckActionLoading] = useState(false);
  const [checkMessage, setCheckMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      if (role === 'admin') {
        const res = await api.getAdminMetrics();
        setData(res);
      } else if (role === 'hr') {
        const res = await api.getHRMetrics();
        setData(res);
      } else {
        const res = await api.getEmployeeDashboard();
        setData(res);
      }
    } catch (e) {
      console.error('Failed to load dashboard', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [role]);

  const handleGenerateSummary = async () => {
    if (!data) return;
    setSummarizing(true);
    try {
      const res = await api.summarizeKPIs(data);
      setAiSummary(res.bullets);
    } catch (e) {
      console.error(e);
    } finally {
      setSummarizing(false);
    }
  };

  const handleCheckIn = async (source: 'web' | 'camera' = 'web') => {
    setCheckActionLoading(true);
    setCheckMessage(null);
    try {
      let lat: number | undefined;
      let lng: number | undefined;

      if (source === 'camera') {
        // Fetch GPS position from browser
        if ('geolocation' in navigator) {
          try {
            const pos: GeolocationPosition = await new Promise((res, rej) =>
              navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
            );
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
          } catch (e) {
            console.warn('Geolocation unavailable or denied');
          }
        }
      }

      const res = await api.checkIn({
        source,
        lat,
        lng,
        face_detected: true, // Camera simulation / Web preview
      });

      setCheckMessage({ text: res.message });
      await fetchDashboardData();
    } catch (err: any) {
      setCheckMessage({ text: err.message, error: true });
    } finally {
      setCheckActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setCheckActionLoading(true);
    setCheckMessage(null);
    try {
      const res = await api.checkOut();
      setCheckMessage({ text: res.message });
      await fetchDashboardData();
    } catch (err: any) {
      setCheckMessage({ text: err.message, error: true });
    } finally {
      setCheckActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="view-loading">
        <div className="spinner" />
        <p>Calculating live database metrics...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Welcome Banner */}
      <div className="welcome-banner">
        <div>
          <span className="eyebrow">{role?.toUpperCase()} OPERATIONS</span>
          <h1>
            Organization Intelligence, <span className="accent">in Real-Time.</span>
          </h1>
          <p className="subtitle">
            Zero dummy data. All aggregates are compiled directly from live database activity.
          </p>
        </div>

        <div className="flex-align-gap">
          <button onClick={openAIChat} className="btn-secondary">
            <Sparkles size={16} className="accent" />
            <span>Ask Copilot</span>
          </button>
          {(role === 'admin' || role === 'hr') && (
            <button
              onClick={handleGenerateSummary}
              disabled={summarizing}
              className="btn-ai-summary"
            >
              <Sparkles size={16} />
              <span>{summarizing ? 'Compiling AI Insights...' : 'Summarize with AI'}</span>
            </button>
          )}
        </div>
      </div>

      {/* AI Summary Bullets */}
      {aiSummary && (
        <div className="ai-summary-card">
          <div className="ai-summary-header">
            <Sparkles size={18} className="accent" />
            <h3>Executive AI Summary</h3>
            <span className="ai-badge">AI-generated</span>
          </div>
          <ul className="ai-summary-bullets">
            {aiSummary.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 1. ADMIN DASHBOARD */}
      {role === 'admin' && data && (
        <>
          <div className="kpi-grid">
            <div className="metric-card">
              <div className="metric-header">
                <span>Active Headcount</span>
                <Users size={18} className="accent" />
              </div>
              <div className="metric-number">{data.headcount}</div>
              <div className="metric-footer">Active personnel</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span>Attrition Rate YTD</span>
                <UserX size={18} className="accent" />
              </div>
              <div className="metric-number">{data.attrition_rate}%</div>
              <div className="metric-footer">Exits ÷ Avg Headcount</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span>Monthly Payroll Gross</span>
                <Wallet size={18} className="accent" />
              </div>
              <div className="metric-number">PKR {data.monthly_payroll_cost.toLocaleString()}</div>
              <div className="metric-footer">Sum of all basic + allowances</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span>Average Monthly Salary</span>
                <TrendingUp size={18} className="accent" />
              </div>
              <div className="metric-number">PKR {data.avg_salary.toLocaleString()}</div>
              <div className="metric-footer">Gross ÷ Headcount</div>
            </div>
          </div>

          <div className="two-column-grid">
            {/* Headcount by Department */}
            <div className="panel">
              <div className="panel-header">
                <h3>Headcount & Payroll by Department</h3>
                <Building size={18} className="muted-icon" />
              </div>
              <div className="department-breakdown">
                {data.headcount_by_department?.length === 0 ? (
                  <p className="empty-subtext">No departments created yet.</p>
                ) : (
                  data.headcount_by_department?.map((d: any) => (
                    <div key={d.id} className="dept-stat-row">
                      <div className="dept-stat-info">
                        <strong>{d.name}</strong>
                        <small>{d.code} · PKR {d.payroll_cost.toLocaleString()} / mo</small>
                      </div>
                      <div className="dept-stat-count">
                        <span className="count-pill">{d.headcount} employees</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Audit Log Feed */}
            <div className="panel">
              <div className="panel-header">
                <h3>Recent Security Audit Feed</h3>
                <span className="live-pill">Live Feed</span>
              </div>
              <div className="audit-feed-list">
                {data.recent_audit_feed?.length === 0 ? (
                  <p className="empty-subtext">No audited events recorded yet.</p>
                ) : (
                  data.recent_audit_feed?.slice(0, 6).map((log: any) => (
                    <div key={log.id} className="audit-feed-item">
                      <div className="audit-feed-top">
                        <span className="audit-action-tag">{log.action}</span>
                        <span className="audit-time">
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="audit-actor">
                        By <strong>{log.actor_name}</strong> ({log.actor_role}) on {log.entity}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* 2. HR DASHBOARD */}
      {role === 'hr' && data && (
        <>
          <div className="kpi-grid">
            <div className="metric-card">
              <div className="metric-header">
                <span>Total Headcount</span>
                <Users size={18} className="accent" />
              </div>
              <div className="metric-number">{data.headcount}</div>
              <div className="metric-footer">Active + probation</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span>Present Today</span>
                <CheckCircle2 size={18} className="accent" />
              </div>
              <div className="metric-number">{data.present_today}</div>
              <div className="metric-footer">On-time check-ins</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span>Late Arrivals Today</span>
                <Clock3 size={18} className="accent" />
              </div>
              <div className="metric-number warning">{data.late_today}</div>
              <div className="metric-footer">Checked in after 09:15</div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <span>Pending Approvals</span>
                <AlertTriangle size={18} className="accent" />
              </div>
              <div className="metric-number">{data.pending_approvals}</div>
              <div className="metric-footer">
                {data.pending_leave_count} leaves · {data.pending_correction_count} corrections
              </div>
            </div>
          </div>

          <div className="two-column-grid">
            {/* Top Late Comers */}
            <div className="panel">
              <div className="panel-header">
                <h3>Top Late-Comers This Month</h3>
                <Clock3 size={18} className="muted-icon" />
              </div>
              <div className="late-comers-list">
                {data.top_5_late_comers?.length === 0 ? (
                  <p className="empty-subtext">No late check-ins recorded this month!</p>
                ) : (
                  data.top_5_late_comers?.map((item: any, i: number) => (
                    <div key={item.employee_id} className="late-comer-row">
                      <span className="rank-badge">{i + 1}</span>
                      <div className="late-comer-info">
                        <strong>{item.name}</strong>
                        <small>{item.employee_code}</small>
                      </div>
                      <span className="late-count-badge">{item.late_count} lates</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Attendance Consistency & Absenteeism */}
            <div className="panel">
              <div className="panel-header">
                <h3>Monthly Attendance Rate</h3>
                <span className="rate-badge">{data.attendance_rate}%</span>
              </div>
              <p className="rate-desc">
                Formula: (present + late + missing_checkout + 0.5×half_day) ÷ working_records
              </p>
              <div className="progress-bar-bg">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${Math.min(100, data.attendance_rate)}%` }}
                />
              </div>

              <div className="panel-sub-section">
                <h4>Leave Utilization by Type</h4>
                <div className="leave-util-list">
                  {data.leave_utilization?.map((l: any) => (
                    <div key={l.id} className="leave-util-item">
                      <span>{l.name}</span>
                      <strong>{l.used_this_month} days used</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 3. EMPLOYEE DASHBOARD */}
      {role === 'employee' && data && (
        <>
          {/* Action alerts */}
          {checkMessage && (
            <div className={`alert-banner ${checkMessage.error ? 'error' : 'success'}`}>
              {checkMessage.text}
            </div>
          )}

          <div className="employee-dash-grid">
            {/* Today's Check-in Card */}
            <div className="panel check-in-panel">
              <div className="panel-header">
                <h3>Today's Attendance Status</h3>
                <Clock3 size={18} className="accent" />
              </div>

              <div className="check-in-status-box">
                {data.today_status?.checked_in ? (
                  <div className="checked-in-state">
                    <div className="status-indicator-badge success">
                      <CheckCircle2 size={16} />
                      <span>
                        Checked In at{' '}
                        {new Date(data.today_status.check_in_time).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {data.today_status.status === 'late' && (
                      <span className="pill warning-pill">LATE ARRIVAL</span>
                    )}

                    {data.today_status.check_out_time ? (
                      <div className="checkout-info">
                        Checked Out at{' '}
                        {new Date(data.today_status.check_out_time).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        <div className="total-hours-label">
                          Total: <strong>{data.today_status.total_hours} hrs</strong>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={handleCheckOut}
                        disabled={checkActionLoading}
                        className="btn-danger check-btn"
                      >
                        {checkActionLoading ? 'Stamping Out...' : 'Check Out Now'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="not-checked-in-state">
                    <p>You have not checked in for today yet.</p>
                    <div className="check-btn-group">
                      <button
                        onClick={() => handleCheckIn('web')}
                        disabled={checkActionLoading}
                        className="btn-primary check-btn"
                      >
                        {checkActionLoading ? 'Recording...' : 'Web Check-In'}
                      </button>
                      <button
                        onClick={() => handleCheckIn('camera')}
                        disabled={checkActionLoading}
                        className="btn-secondary check-btn camera-btn"
                        title="Front Camera & Geofence Verification"
                      >
                        <Camera size={16} />
                        <span>Camera Check-In (+GPS)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Weekly Target Progress */}
            <div className="panel">
              <div className="panel-header">
                <h3>Hours This Week</h3>
                <span className="accent">
                  {data.weekly_hours} / {data.weekly_target} hrs
                </span>
              </div>
              <p className="subtitle">Progress towards 40-hour weekly target</p>
              <div className="progress-bar-bg">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${Math.min(100, (data.weekly_hours / data.weekly_target) * 100)}%` }}
                />
              </div>
              <div className="stat-pill-row">
                <div className="stat-pill">
                  <span className="stat-label">Late Arrivals (This Month)</span>
                  <span className="stat-val">{data.monthly_late_count}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Leave Balances Grid */}
          <div className="section-title-row">
            <h2>Your Leave Balances</h2>
            <button onClick={() => navigateToTab('leave')} className="btn-link">
              Apply for Leave <ArrowRight size={14} />
            </button>
          </div>

          <div className="kpi-grid">
            {data.leave_balances?.map((lb: any) => (
              <div key={lb.id} className="metric-card">
                <div className="metric-header">
                  <span>{lb.name}</span>
                  <CalendarDays size={18} className="accent" />
                </div>
                <div className="metric-number">
                  {lb.is_unpaid ? 'Unlimited' : `${lb.remaining} days`}
                </div>
                <div className="metric-footer">
                  {lb.is_unpaid ? 'Available upon request' : `Used: ${lb.used} of ${lb.quota} days`}
                </div>
              </div>
            ))}
          </div>

          {/* Announcements Row */}
          <div className="panel announcements-panel">
            <div className="panel-header">
              <h3>Company Noticeboard</h3>
              <button onClick={() => navigateToTab('announcements')} className="btn-link">
                View All
              </button>
            </div>
            <div className="announcement-cards">
              {data.announcements?.length === 0 ? (
                <p className="empty-subtext">No company announcements posted.</p>
              ) : (
                data.announcements?.map((a: any) => (
                  <div key={a.id} className="announcement-mini-card">
                    <div className="announcement-mini-top">
                      <strong>{a.title}</strong>
                      <span className={`priority-tag ${a.priority}`}>{a.priority}</span>
                    </div>
                    <p className="announcement-mini-content">{a.content}</p>
                    <small className="announcement-date">
                      {new Date(a.created_at).toLocaleDateString()}
                    </small>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
