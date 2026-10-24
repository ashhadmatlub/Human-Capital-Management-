import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  FileSpreadsheet,
  Download,
  Eye,
  Edit,
  CheckCircle2,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export const EmployeesView: React.FC = () => {
  const { user, role } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [selected360EmpId, setSelected360EmpId] = useState<string | null>(null);
  const [profile360Data, setProfile360Data] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [editEmployeeData, setEditEmployeeData] = useState<any | null>(null);

  // Register Form State
  const [regForm, setRegForm] = useState({
    employee_code: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    gender: 'male' as 'male' | 'female' | 'other',
    date_of_birth: '1995-01-01',
    join_date: new Date().toISOString().slice(0, 10),
    department_id: '',
    designation_id: '',
    basic_salary: 50000,
    temporary_password: '',
  });

  // CSV Dry-Run State
  const [csvContent, setCsvContent] = useState('');
  const [dryRunReport, setDryRunReport] = useState<any | null>(null);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await api.getEmployees({
        search,
        department_id: selectedDept,
        status: selectedStatus,
        page,
      });
      setEmployees(res.data);
      setTotalPages(res.meta.totalPages || 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMasters = async () => {
    try {
      const [depts, desigs] = await Promise.all([
        api.getDepartments(),
        api.getDesignations(),
      ]);
      setDepartments(depts);
      setDesignations(desigs);
      if (depts.length > 0 && !regForm.department_id) {
        setRegForm((prev) => ({
          ...prev,
          department_id: depts[0].id,
          designation_id: desigs.length > 0 ? desigs[0].id : '',
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchMasters();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [search, selectedDept, selectedStatus, page]);

  // Open 360 profile
  const handleOpen360 = async (empId: string) => {
    setSelected360EmpId(empId);
    setProfileLoading(true);
    try {
      const data = await api.getEmployee360(empId);
      setProfile360Data(data);
    } catch (e: any) {
      alert(e.message);
      setSelected360EmpId(null);
    } finally {
      setProfileLoading(false);
    }
  };

  // Register Employee Submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.registerEmployee(regForm);
      setStatusMessage(`Employee created! Temporary password: ${res.tempPassword}`);
      setShowRegisterModal(false);
      fetchEmployees();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // CSV Dry-Run
  const handleDryRun = async () => {
    if (!csvContent.trim()) {
      alert('Please paste CSV text or select a CSV file.');
      return;
    }
    setDryRunLoading(true);
    try {
      const report = await api.dryRunCSV(csvContent);
      setDryRunReport(report);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDryRunLoading(false);
    }
  };

  // CSV Import Commit
  const handleCommitImport = async () => {
    if (!dryRunReport?.validData || dryRunReport.validData.length === 0) return;
    setImportLoading(true);
    try {
      const res = await api.commitCSVImport(dryRunReport.validData);
      setStatusMessage(`Successfully imported ${res.imported} employee(s)!`);
      setShowCSVModal(false);
      setDryRunReport(null);
      setCsvContent('');
      fetchEmployees();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setImportLoading(false);
    }
  };

  // Edit Employee Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEmployeeData) return;
    try {
      await api.updateEmployee(editEmployeeData.id, editEmployeeData);
      setEditEmployeeData(null);
      fetchEmployees();
      if (selected360EmpId) {
        handleOpen360(selected360EmpId);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const basic = Number(regForm.basic_salary) || 0;
  const hra = Math.round(basic * 0.4);
  const medical = Math.round(basic * 0.1);
  const gross = Math.round(basic * 1.5);

  return (
    <div className="view-content">
      <div className="view-header-row">
        <div>
          <h2>Employee Directory & 360 Records</h2>
          <p className="subtitle">
            Manage organization members, compensation parameters and profile histories.
          </p>
        </div>

        {role === 'hr' && (
          <div className="header-actions">
            <button
              onClick={() => setShowCSVModal(true)}
              className="btn-secondary"
            >
              <FileSpreadsheet size={16} />
              <span>CSV Import / Export</span>
            </button>
            <button
              onClick={() => setShowRegisterModal(true)}
              className="btn-primary"
            >
              <Plus size={16} />
              <span>Register Employee</span>
            </button>
          </div>
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

      {/* Filter Toolbar */}
      <div className="filter-toolbar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by name, employee code, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {role !== 'employee' && (
          <>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="filter-select"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="filter-select"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="probation">Probation</option>
              <option value="resigned">Resigned</option>
              <option value="terminated">Terminated</option>
            </select>
          </>
        )}
      </div>

      {/* Employee Table */}
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee Code</th>
              <th>Full Name</th>
              <th>Department</th>
              <th>Designation</th>
              <th>Gross Salary</th>
              <th>Status</th>
              <th>Joined</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-8">
                  Loading employee records...
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 empty-subtext">
                  No employee records found.
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp.id}>
                  <td>
                    <span className="code-badge">{emp.employee_code}</span>
                  </td>
                  <td>
                    <div className="table-person">
                      <strong>{emp.first_name} {emp.last_name}</strong>
                      <small>{emp.email}</small>
                    </div>
                  </td>
                  <td>{emp.department_name}</td>
                  <td>{emp.designation_name}</td>
                  <td>
                    {role === 'employee' ? (
                      <span className="muted-text">Confidential</span>
                    ) : (
                      <strong>PKR {emp.gross_salary?.toLocaleString()}</strong>
                    )}
                  </td>
                  <td>
                    <span className={`status-pill ${emp.status}`}>{emp.status}</span>
                  </td>
                  <td>{emp.join_date}</td>
                  <td className="text-right">
                    <button
                      onClick={() => handleOpen360(emp.id)}
                      className="table-action-btn"
                      title="View Employee 360"
                    >
                      <Eye size={15} />
                    </button>
                    {(role === 'hr' || (role === 'employee' && user?.employee_id === emp.id)) && (
                      <button
                        onClick={() => setEditEmployeeData(emp)}
                        className="table-action-btn"
                        title="Edit Details"
                      >
                        <Edit size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination-bar">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-page"
          >
            Previous
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-page"
          >
            Next
          </button>
        </div>
      )}

      {/* REGISTER EMPLOYEE MODAL */}
      {showRegisterModal && (
        <div className="modal-backdrop">
          <div className="modal-box large">
            <div className="modal-header">
              <h3>Register New Employee</h3>
              <button onClick={() => setShowRegisterModal(false)} className="close-btn">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit}>
              <div className="form-grid-3">
                <div className="form-group">
                  <label>Employee Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. EMP-101"
                    value={regForm.employee_code}
                    onChange={(e) => setRegForm({ ...regForm, employee_code: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    required
                    value={regForm.first_name}
                    onChange={(e) => setRegForm({ ...regForm, first_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    required
                    value={regForm.last_name}
                    onChange={(e) => setRegForm({ ...regForm, last_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid-3">
                <div className="form-group">
                  <label>Work Email</label>
                  <input
                    type="email"
                    required
                    value={regForm.email}
                    onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="text"
                    required
                    value={regForm.phone}
                    onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Gender</label>
                  <select
                    value={regForm.gender}
                    onChange={(e) => setRegForm({ ...regForm, gender: e.target.value as any })}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-grid-3">
                <div className="form-group">
                  <label>Department</label>
                  <select
                    required
                    value={regForm.department_id}
                    onChange={(e) => setRegForm({ ...regForm, department_id: e.target.value })}
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Designation</label>
                  <select
                    required
                    value={regForm.designation_id}
                    onChange={(e) => setRegForm({ ...regForm, designation_id: e.target.value })}
                  >
                    {designations.map((desig) => (
                      <option key={desig.id} value={desig.id}>
                        {desig.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Joining Date</label>
                  <input
                    type="date"
                    required
                    value={regForm.join_date}
                    onChange={(e) => setRegForm({ ...regForm, join_date: e.target.value })}
                  />
                </div>
              </div>

              {/* Salary Structure Calculator */}
              <div className="salary-calc-box">
                <h4>Compensation & Salary Structure (Gross = 1.5 × Basic)</h4>
                <div className="form-grid-4">
                  <div className="form-group">
                    <label>Basic Salary (PKR)</label>
                    <input
                      type="number"
                      required
                      min={1000}
                      value={regForm.basic_salary}
                      onChange={(e) => setRegForm({ ...regForm, basic_salary: Number(e.target.value) })}
                    />
                  </div>
                  <div className="salary-preview-item">
                    <span>HRA (40%)</span>
                    <strong>PKR {hra.toLocaleString()}</strong>
                  </div>
                  <div className="salary-preview-item">
                    <span>Medical (10%)</span>
                    <strong>PKR {medical.toLocaleString()}</strong>
                  </div>
                  <div className="salary-preview-item highlight">
                    <span>Total Gross</span>
                    <strong>PKR {gross.toLocaleString()}</strong>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Residential Address</label>
                <textarea
                  rows={2}
                  required
                  value={regForm.address}
                  onChange={(e) => setRegForm({ ...regForm, address: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Register & Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV IMPORT & DRY RUN MODAL */}
      {showCSVModal && (
        <div className="modal-backdrop">
          <div className="modal-box large">
            <div className="modal-header">
              <h3>Employee CSV Import & Dry-Run</h3>
              <button onClick={() => setShowCSVModal(false)} className="close-btn">
                <X size={18} />
              </button>
            </div>

            <p className="subtitle">
              Paste employee CSV data. The system executes a non-committing dry-run returning row-by-row validation errors before any record is stored.
            </p>

            <div className="csv-template-box">
              <div className="flex-between">
                <span>Sample CSV Format Header:</span>
                <a
                  href={api.exportCSVUrl()}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-link"
                >
                  <Download size={13} /> Export Current CSV
                </a>
              </div>
              <code>
                employee_code,first_name,last_name,email,department_code,basic_salary,join_date
              </code>
            </div>

            <div className="form-group mt-3">
              <label>CSV Data Content</label>
              <textarea
                rows={6}
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder="Paste comma-separated employee records here..."
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                onClick={handleDryRun}
                disabled={dryRunLoading}
                className="btn-secondary"
              >
                {dryRunLoading ? 'Validating CSV...' : 'Run Dry-Run Audit'}
              </button>
            </div>

            {/* Dry run report */}
            {dryRunReport && (
              <div className="dry-run-results">
                <div className="dry-run-summary-bar">
                  <div className="summary-chip">
                    Total Rows: <strong>{dryRunReport.summary.total}</strong>
                  </div>
                  <div className="summary-chip success">
                    Valid Rows: <strong>{dryRunReport.summary.validRows}</strong>
                  </div>
                  <div className="summary-chip error">
                    Invalid Rows: <strong>{dryRunReport.summary.invalidRows}</strong>
                  </div>
                </div>

                {dryRunReport.errors.length > 0 && (
                  <div className="dry-run-error-list">
                    <h4>Validation Errors Identified:</h4>
                    {dryRunReport.errors.map((err: any, i: number) => (
                      <div key={i} className="dry-run-error-row">
                        <span className="error-row-num">Row {err.row}</span>
                        <span className="error-field">[{err.field}]</span>
                        <span className="error-reason">{err.reason}</span>
                      </div>
                    ))}
                  </div>
                )}

                {dryRunReport.validData.length > 0 && (
                  <div className="mt-4">
                    <button
                      onClick={handleCommitImport}
                      disabled={importLoading}
                      className="btn-primary full-width"
                    >
                      {importLoading
                        ? 'Committing Records...'
                        : `Commit & Import ${dryRunReport.validData.length} Valid Employee(s)`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* EMPLOYEE 360 PROFILE MODAL */}
      {selected360EmpId && (
        <div className="modal-backdrop">
          <div className="modal-box large">
            <div className="modal-header">
              <h3>Employee 360 Profile</h3>
              <button onClick={() => setSelected360EmpId(null)} className="close-btn">
                <X size={18} />
              </button>
            </div>

            {profileLoading || !profile360Data ? (
              <p className="text-center py-6">Loading 360 profile...</p>
            ) : (
              <div className="profile-360-content">
                <div className="profile-hero-card">
                  <div className="profile-avatar-circle">
                    {profile360Data.employee.first_name[0]}
                  </div>
                  <div className="profile-hero-text">
                    <h2>
                      {profile360Data.employee.first_name} {profile360Data.employee.last_name}
                    </h2>
                    <p>
                      {profile360Data.employee.designation_name} · {profile360Data.employee.department_name}
                    </p>
                    <div className="badge-row">
                      <span className="code-badge">{profile360Data.employee.employee_code}</span>
                      <span className={`status-pill ${profile360Data.employee.status}`}>
                        {profile360Data.employee.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Compensation breakdown (hidden for employees viewing others) */}
                {role !== 'employee' && (
                  <div className="panel my-3">
                    <h4>Salary & Allowances</h4>
                    <div className="salary-pill-grid">
                      <div>Basic: <strong>PKR {profile360Data.employee.basic_salary?.toLocaleString()}</strong></div>
                      <div>HRA: <strong>PKR {profile360Data.employee.hra?.toLocaleString()}</strong></div>
                      <div>Medical: <strong>PKR {profile360Data.employee.medical_allowance?.toLocaleString()}</strong></div>
                      <div>Gross: <strong className="accent">PKR {profile360Data.employee.gross_salary?.toLocaleString()}</strong></div>
                    </div>
                  </div>
                )}

                {/* Leave Balances */}
                <div className="panel my-3">
                  <h4>Leave Balances</h4>
                  <div className="form-grid-4">
                    {profile360Data.leave_balances?.map((lb: any) => (
                      <div key={lb.id} className="mini-balance-chip">
                        <span>{lb.name}</span>
                        <strong>{lb.is_unpaid ? 'Unlimited' : `${lb.remaining} left`}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Attendance */}
                <div className="panel my-3">
                  <h4>Recent Attendance (Last 5 Records)</h4>
                  <div className="table-responsive">
                    <table className="mini-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Check-in</th>
                          <th>Check-out</th>
                          <th>Hours</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profile360Data.recent_attendance?.slice(0, 5).map((a: any) => (
                          <tr key={a.id}>
                            <td>{a.date}</td>
                            <td>{new Date(a.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td>
                              {a.check_out
                                ? new Date(a.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : '—'}
                            </td>
                            <td>{a.total_hours || '—'}</td>
                            <td>
                              <span className={`status-pill ${a.status}`}>{a.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT EMPLOYEE MODAL */}
      {editEmployeeData && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h3>Edit Employee Profile</h3>
              <button onClick={() => setEditEmployeeData(null)} className="close-btn">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="form-group">
                <label>Phone Number</label>
                <input
                  type="text"
                  required
                  value={editEmployeeData.phone}
                  onChange={(e) => setEditEmployeeData({ ...editEmployeeData, phone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Residential Address</label>
                <textarea
                  rows={2}
                  required
                  value={editEmployeeData.address}
                  onChange={(e) => setEditEmployeeData({ ...editEmployeeData, address: e.target.value })}
                />
              </div>

              {/* HR can edit salary and status */}
              {role === 'hr' && (
                <>
                  <div className="form-group">
                    <label>Basic Salary (PKR)</label>
                    <input
                      type="number"
                      required
                      value={editEmployeeData.basic_salary}
                      onChange={(e) => setEditEmployeeData({ ...editEmployeeData, basic_salary: Number(e.target.value) })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Employment Status</label>
                    <select
                      value={editEmployeeData.status}
                      onChange={(e) => setEditEmployeeData({ ...editEmployeeData, status: e.target.value })}
                    >
                      <option value="active">Active</option>
                      <option value="probation">Probation</option>
                      <option value="resigned">Resigned</option>
                      <option value="terminated">Terminated</option>
                    </select>
                  </div>
                </>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setEditEmployeeData(null)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
