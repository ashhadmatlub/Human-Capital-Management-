import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Lock,
  Download,
  Eye,
  X,
  ShieldCheck,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export const PayrollView: React.FC = () => {
  const { role } = useAuth();
  const [runs, setRuns] = useState<any[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayslip, setSelectedPayslip] = useState<any | null>(null);

  // Generate Draft Modal
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [draftMonth, setDraftMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const fetchPayroll = async () => {
    setLoading(true);
    try {
      if (role === 'admin' || role === 'hr') {
        const [runsData, slipsData] = await Promise.all([
          api.getPayrollRuns(),
          api.getPayslips(),
        ]);
        setRuns(runsData);
        setPayslips(slipsData);
      } else {
        const slipsData = await api.getPayslips();
        setPayslips(slipsData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayroll();
  }, [role]);

  // Generate Draft (HR or Admin)
  const handleGenerateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setStatusMessage(null);
    try {
      const res = await api.generatePayrollDraft(draftMonth);
      setStatusMessage({
        text: `Payroll draft generated for ${draftMonth}: Total Gross PKR ${res.run.total_gross.toLocaleString()} (${res.payslips.length} employees).`,
      });
      setShowDraftModal(false);
      fetchPayroll();
    } catch (err: any) {
      setStatusMessage({ text: err.message, error: true });
    } finally {
      setActionLoading(false);
    }
  };

  // Finalize Payroll (Admin ONLY)
  const handleFinalize = async (month: string) => {
    if (!confirm(`Are you sure you want to finalize and lock payroll for ${month}? This cannot be undone.`)) {
      return;
    }
    setActionLoading(true);
    setStatusMessage(null);
    try {
      await api.finalizePayroll(month);
      setStatusMessage({ text: `Payroll for ${month} is now finalized and locked.` });
      fetchPayroll();
    } catch (err: any) {
      setStatusMessage({ text: err.message, error: true });
    } finally {
      setActionLoading(false);
    }
  };

  // Generate PDF Payslip using jsPDF
  const downloadPayslipPDF = (payslip: any) => {
    const doc = new jsPDF();

    // Company Header
    doc.setFillColor(11, 18, 26); // Dark navy
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(57, 255, 136); // Neon green
    doc.setFontSize(22);
    doc.text('HCM LITE — PAYSLIP', 14, 22);

    doc.setTextColor(237, 243, 250);
    doc.setFontSize(10);
    doc.text(`Month of Salary: ${payslip.month}`, 14, 32);
    doc.text(`Status: ${payslip.status.toUpperCase()}`, 150, 32);

    // Employee Meta
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(12);
    doc.text(`Employee Name: ${payslip.employee_name}`, 14, 52);
    doc.text(`Employee ID: ${payslip.employee_code}`, 14, 60);
    doc.text(`Department: ${payslip.department_name}`, 120, 52);
    doc.text(`Designation: ${payslip.designation_name}`, 120, 60);

    // Table divider line
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 68, 196, 68);

    // Earnings Table
    doc.setFontSize(14);
    doc.text('Earnings & Compensation', 14, 78);
    doc.setFontSize(11);
    doc.text('Basic Salary:', 14, 88);
    doc.text(`PKR ${payslip.basic_salary.toLocaleString()}`, 90, 88);
    doc.text('House Rent Allowance (HRA 40%):', 14, 96);
    doc.text(`PKR ${payslip.hra.toLocaleString()}`, 90, 96);
    doc.text('Medical Allowance (10%):', 14, 104);
    doc.text(`PKR ${payslip.medical_allowance.toLocaleString()}`, 90, 104);

    doc.setDrawColor(180, 180, 180);
    doc.line(14, 110, 100, 110);
    doc.setFontSize(12);
    doc.text('Gross Earnings:', 14, 118);
    doc.text(`PKR ${payslip.gross_salary.toLocaleString()}`, 90, 118);

    // Deductions Table
    doc.setFontSize(14);
    doc.text('Deductions & Income Tax', 120, 78);
    doc.setFontSize(11);
    doc.text(`Absent / Half-Days (${payslip.absent_days + payslip.half_days * 0.5} d):`, 120, 88);
    doc.text(`PKR ${payslip.deductions.toLocaleString()}`, 175, 88);
    doc.text('Statutory Income Tax:', 120, 96);
    doc.text(`PKR ${payslip.tax.toLocaleString()}`, 175, 96);

    doc.line(120, 110, 196, 110);
    doc.setFontSize(12);
    doc.text('Total Deductions:', 120, 118);
    doc.text(`PKR ${(payslip.deductions + payslip.tax).toLocaleString()}`, 175, 118);

    // Net Salary Box
    doc.setFillColor(240, 248, 243);
    doc.roundedRect(14, 135, 182, 28, 3, 3, 'F');
    doc.setTextColor(20, 60, 40);
    doc.setFontSize(14);
    doc.text('NET TAKE-HOME PAY:', 22, 152);
    doc.setFontSize(18);
    doc.text(`PKR ${payslip.net_salary.toLocaleString()}`, 120, 153);

    // Footer
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('This is a computer-generated payslip authenticated by HCM Lite.', 14, 185);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 192);

    doc.save(`Payslip_${payslip.employee_code}_${payslip.month}.pdf`);
  };

  return (
    <div className="view-content">
      <div className="view-header-row">
        <div>
          <h2>Payroll Lite & Payslip Generation</h2>
          <p className="subtitle">
            Prorated monthly runs, absent and unpaid leave deductions, 5-tier statutory tax brackets, and PDF payslips.
          </p>
        </div>

        {(role === 'hr' || role === 'admin') && (
          <button onClick={() => setShowDraftModal(true)} className="btn-primary">
            <Wallet size={16} />
            <span>Generate Monthly Draft</span>
          </button>
        )}
      </div>

      {statusMessage && (
        <div className={`alert-banner ${statusMessage.error ? 'error' : 'success'}`}>
          {statusMessage.text}
          <button onClick={() => setStatusMessage(null)} className="alert-close">
            <X size={14} />
          </button>
        </div>
      )}

      {/* MONTHLY RUNS TABLE (Admin & HR) */}
      {(role === 'admin' || role === 'hr') && (
        <div className="panel mb-4">
          <div className="panel-header">
            <h3>Monthly Payroll Runs</h3>
            <span className="live-pill">Calculation Engine</span>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Total Gross</th>
                  <th>Total Deductions</th>
                  <th>Total Tax</th>
                  <th>Net Payout</th>
                  <th>Working Days</th>
                  <th>Status</th>
                  {role === 'admin' && <th className="text-right">Admin Finalize</th>}
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-6 empty-subtext">
                      No payroll runs created yet. Click "Generate Monthly Draft" to prepare a draft.
                    </td>
                  </tr>
                ) : (
                  runs.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.month}</strong>
                      </td>
                      <td>PKR {r.total_gross.toLocaleString()}</td>
                      <td>PKR {r.total_deductions.toLocaleString()}</td>
                      <td>PKR {r.total_tax.toLocaleString()}</td>
                      <td>
                        <strong className="accent">PKR {r.total_net.toLocaleString()}</strong>
                      </td>
                      <td>{r.working_days} days</td>
                      <td>
                        <span className={`status-pill ${r.status}`}>
                          {r.status === 'finalized' ? 'LOCKED & FINALIZED' : 'DRAFT REVIEW'}
                        </span>
                      </td>
                      {role === 'admin' && (
                        <td className="text-right">
                          {r.status === 'draft' ? (
                            <button
                              onClick={() => handleFinalize(r.month)}
                              disabled={actionLoading}
                              className="btn-primary btn-sm"
                            >
                              <Lock size={13} /> Finalize & Lock
                            </button>
                          ) : (
                            <span className="locked-tag">
                              <ShieldCheck size={14} /> Locked
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PAYSLIPS LIST */}
      <div className="panel">
        <div className="panel-header">
          <h3>Employee Payslips</h3>
          <span className="muted-text">{payslips.length} payslip(s) available</span>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Month</th>
                <th>Basic Salary</th>
                <th>Gross Salary</th>
                <th>Deductions</th>
                <th>Tax</th>
                <th>Net Salary</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-6">
                    Loading payslips...
                  </td>
                </tr>
              ) : payslips.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-6 empty-subtext">
                    No payslips generated for this period.
                  </td>
                </tr>
              ) : (
                payslips.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.employee_name}</strong>
                      <small className="block muted-text">{p.employee_code}</small>
                    </td>
                    <td>{p.month}</td>
                    <td>PKR {p.basic_salary?.toLocaleString()}</td>
                    <td>PKR {p.gross_salary?.toLocaleString()}</td>
                    <td>PKR {p.deductions?.toLocaleString()}</td>
                    <td>PKR {p.tax?.toLocaleString()}</td>
                    <td>
                      <strong className="accent">PKR {p.net_salary?.toLocaleString()}</strong>
                    </td>
                    <td>
                      <span className={`status-pill ${p.status}`}>{p.status}</span>
                    </td>
                    <td className="text-right">
                      <div className="action-buttons-inline">
                        <button
                          onClick={() => setSelectedPayslip(p)}
                          className="table-action-btn"
                          title="View Payslip"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => downloadPayslipPDF(p)}
                          className="table-action-btn"
                          title="Download Payslip PDF"
                        >
                          <Download size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* GENERATE DRAFT MODAL */}
      {showDraftModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h3>Generate Monthly Payroll Draft</h3>
              <button onClick={() => setShowDraftModal(false)} className="close-btn">
                <X size={18} />
              </button>
            </div>

            <p className="subtitle">
              Calculates gross earnings, attendance rate deductions (absent days, unpaid leave, half-days), joiner/leaver proration, and annual tax brackets.
            </p>

            <form onSubmit={handleGenerateDraft}>
              <div className="form-group">
                <label>Target Month (YYYY-MM)</label>
                <input
                  type="month"
                  required
                  value={draftMonth}
                  onChange={(e) => setDraftMonth(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowDraftModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading} className="btn-primary">
                  {actionLoading ? 'Compiling Run...' : 'Generate Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAILED PAYSLIP MODAL */}
      {selectedPayslip && (
        <div className="modal-backdrop">
          <div className="modal-box large">
            <div className="modal-header">
              <h3>Salary Payslip — {selectedPayslip.month}</h3>
              <div className="flex-align-gap">
                <button
                  onClick={() => downloadPayslipPDF(selectedPayslip)}
                  className="btn-primary btn-sm"
                >
                  <Download size={14} /> Download PDF
                </button>
                <button onClick={() => setSelectedPayslip(null)} className="close-btn">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="payslip-preview-card">
              <div className="payslip-meta-grid">
                <div>
                  <span className="meta-label">Employee</span>
                  <strong>{selectedPayslip.employee_name} ({selectedPayslip.employee_code})</strong>
                </div>
                <div>
                  <span className="meta-label">Department</span>
                  <strong>{selectedPayslip.department_name}</strong>
                </div>
                <div>
                  <span className="meta-label">Designation</span>
                  <strong>{selectedPayslip.designation_name}</strong>
                </div>
                <div>
                  <span className="meta-label">Payroll Status</span>
                  <span className={`status-pill ${selectedPayslip.status}`}>{selectedPayslip.status}</span>
                </div>
              </div>

              <div className="two-column-grid my-3">
                <div className="panel">
                  <h4>Earnings</h4>
                  <div className="spec-row">
                    <span>Basic Salary</span>
                    <strong>PKR {selectedPayslip.basic_salary?.toLocaleString()}</strong>
                  </div>
                  <div className="spec-row">
                    <span>House Rent Allowance (HRA 40%)</span>
                    <strong>PKR {selectedPayslip.hra?.toLocaleString()}</strong>
                  </div>
                  <div className="spec-row">
                    <span>Medical Allowance (10%)</span>
                    <strong>PKR {selectedPayslip.medical_allowance?.toLocaleString()}</strong>
                  </div>
                  <div className="spec-row highlight">
                    <span>Total Gross Salary</span>
                    <strong>PKR {selectedPayslip.gross_salary?.toLocaleString()}</strong>
                  </div>
                </div>

                <div className="panel">
                  <h4>Deductions & Taxes</h4>
                  <div className="spec-row">
                    <span>Absent & Half-Day Deductions</span>
                    <strong>PKR {selectedPayslip.deductions?.toLocaleString()}</strong>
                  </div>
                  <div className="spec-row">
                    <span>Monthly Statutory Income Tax</span>
                    <strong>PKR {selectedPayslip.tax?.toLocaleString()}</strong>
                  </div>
                  <div className="spec-row highlight">
                    <span>Total Deductions</span>
                    <strong>
                      PKR {((selectedPayslip.deductions || 0) + (selectedPayslip.tax || 0)).toLocaleString()}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="net-pay-banner">
                <span>NET TAKE-HOME PAY</span>
                <strong className="net-amount">PKR {selectedPayslip.net_salary?.toLocaleString()}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
