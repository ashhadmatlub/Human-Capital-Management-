export interface UserSession {
  id: string;
  email: string;
  role: 'admin' | 'hr' | 'employee';
  employee_id?: string;
  must_change_password?: boolean;
  is_active: boolean;
  employee?: any;
}

const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('hcm_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    (headers as any)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    if (!endpoint.includes('/auth/login') && !endpoint.includes('/setup/status')) {
      localStorage.removeItem('hcm_token');
      localStorage.removeItem('hcm_user');
      window.dispatchEvent(new Event('hcm_auth_changed'));
    }
  }

  const contentType = response.headers.get('content-type');
  let data: any = null;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    throw new ApiError(response.status, data?.error || response.statusText || 'Request failed', data);
  }

  return data;
}

export const api = {
  // Setup & Auth
  getSetupStatus: () => apiRequest<{ setupCompleted: boolean }>('/setup/status'),
  bootstrapSetup: (data: any) =>
    apiRequest<{ user: UserSession; token: string }>('/setup/bootstrap', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  login: (credentials: { email: string; password: string }) =>
    apiRequest<{ user: UserSession; token: string; must_change_password: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  changePassword: (new_password: string) =>
    apiRequest<{ success: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ new_password }),
    }),
  listUsers: () => apiRequest<any[]>('/auth/users'),
  createHRUser: (data: { email: string; password: string }) =>
    apiRequest<any>('/auth/users/hr', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  toggleUserActive: (id: string, is_active: boolean) =>
    apiRequest<any>(`/auth/users/${id}/toggle-active`, {
      method: 'POST',
      body: JSON.stringify({ is_active }),
    }),
  resetPassword: (id: string, temp_password?: string) =>
    apiRequest<any>(`/auth/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ temp_password }),
    }),

  // Organization
  getSettings: () => apiRequest<any>('/org/settings'),
  updateSettings: (data: any) =>
    apiRequest<any>('/org/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getDepartments: () => apiRequest<any[]>('/org/departments'),
  createDepartment: (data: { name: string; code: string }) =>
    apiRequest<any>('/org/departments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getDesignations: (department_id?: string) =>
    apiRequest<any[]>(`/org/designations${department_id ? `?department_id=${department_id}` : ''}`),
  createDesignation: (data: { name: string; department_id: string }) =>
    apiRequest<any>('/org/designations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getLeaveTypes: () => apiRequest<any[]>('/org/leave-types'),
  createLeaveType: (data: { name: string; code: string; yearly_quota: number }) =>
    apiRequest<any>('/org/leave-types', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getPublicHolidays: () => apiRequest<any[]>('/org/public-holidays'),
  createPublicHoliday: (data: { name: string; date: string }) =>
    apiRequest<any>('/org/public-holidays', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Employees
  getEmployees: (params?: { search?: string; department_id?: string; status?: string; page?: number }) => {
    const sp = new URLSearchParams();
    if (params?.search) sp.set('search', params.search);
    if (params?.department_id) sp.set('department_id', params.department_id);
    if (params?.status) sp.set('status', params.status);
    if (params?.page) sp.set('page', String(params.page));
    return apiRequest<{ data: any[]; meta: any }>(`/employees?${sp.toString()}`);
  },
  getEmployee360: (id: string) => apiRequest<any>(`/employees/${id}/profile`),
  registerEmployee: (data: any) =>
    apiRequest<{ employee: any; tempPassword: string }>('/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateEmployee: (id: string, updates: any) =>
    apiRequest<any>(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  dryRunCSV: (csv_content: string) =>
    apiRequest<any>('/employees/csv/dry-run', {
      method: 'POST',
      body: JSON.stringify({ csv_content }),
    }),
  commitCSVImport: (valid_data: any[]) =>
    apiRequest<any>('/employees/csv/import', {
      method: 'POST',
      body: JSON.stringify({ valid_data }),
    }),
  exportCSVUrl: () => `${API_BASE}/employees/csv/export`,

  // Attendance
  checkIn: (data: { source?: 'web' | 'camera'; lat?: number; lng?: number; face_detected?: boolean }) =>
    apiRequest<any>('/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  checkOut: () =>
    apiRequest<any>('/attendance/check-out', {
      method: 'POST',
    }),
  getAttendanceBoard: (date?: string) =>
    apiRequest<any>(`/attendance/board${date ? `?date=${date}` : ''}`),
  getAttendanceHistory: (employee_id?: string, month?: string) => {
    const sp = new URLSearchParams();
    if (employee_id) sp.set('employee_id', employee_id);
    if (month) sp.set('month', month);
    return apiRequest<any[]>(`/attendance/history?${sp.toString()}`);
  },
  requestAttendanceCorrection: (data: { date: string; requested_check_in: string; requested_check_out?: string; reason: string }) =>
    apiRequest<any>('/attendance/corrections', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getAttendanceCorrections: () => apiRequest<any[]>('/attendance/corrections'),
  reviewAttendanceCorrection: (id: string, decision: 'approved' | 'rejected', comment?: string) =>
    apiRequest<any>(`/attendance/corrections/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, comment }),
    }),

  // Leave
  getLeaveBalances: (employee_id?: string) =>
    apiRequest<any[]>(`/leave/balances${employee_id ? `?employee_id=${employee_id}` : ''}`),
  applyLeave: (data: { leave_type_id: string; start_date: string; end_date: string; reason: string; employee_id?: string }) =>
    apiRequest<any>('/leave/apply', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  cancelLeave: (id: string) =>
    apiRequest<any>(`/leave/${id}/cancel`, {
      method: 'POST',
    }),
  getLeaveRequests: (params?: { employee_id?: string; status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.employee_id) sp.set('employee_id', params.employee_id);
    if (params?.status) sp.set('status', params.status);
    return apiRequest<any[]>(`/leave/requests?${sp.toString()}`);
  },
  reviewLeave: (id: string, decision: 'approved' | 'rejected', comment?: string) =>
    apiRequest<any>(`/leave/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, comment }),
    }),

  // Payroll
  getPayrollRuns: () => apiRequest<any[]>('/payroll/runs'),
  generatePayrollDraft: (month: string) =>
    apiRequest<any>('/payroll/draft', {
      method: 'POST',
      body: JSON.stringify({ month }),
    }),
  finalizePayroll: (month: string) =>
    apiRequest<any>('/payroll/finalize', {
      method: 'POST',
      body: JSON.stringify({ month }),
    }),
  getPayslips: (params?: { month?: string; employee_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.month) sp.set('month', params.month);
    if (params?.employee_id) sp.set('employee_id', params.employee_id);
    return apiRequest<any[]>(`/payroll/payslips?${sp.toString()}`);
  },
  getPayslipById: (id: string) => apiRequest<any>(`/payroll/payslips/${id}`),

  // Analytics
  getAdminMetrics: (department_id?: string) =>
    apiRequest<any>(`/analytics/admin${department_id ? `?department_id=${department_id}` : ''}`),
  getHRMetrics: (params?: { department_id?: string; month?: string }) => {
    const sp = new URLSearchParams();
    if (params?.department_id) sp.set('department_id', params.department_id);
    if (params?.month) sp.set('month', params.month);
    return apiRequest<any>(`/analytics/hr?${sp.toString()}`);
  },
  getEmployeeDashboard: () => apiRequest<any>('/analytics/employee'),

  // AI Assistant
  askAI: (prompt: string) =>
    apiRequest<{ reply: string; tool_called?: string }>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),
  smartLeave: (text: string) =>
    apiRequest<{ leave_type_code: string; start_date: string; end_date: string; reason: string }>('/ai/smart-leave', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  summarizeKPIs: (kpis: any) =>
    apiRequest<{ bullets: string[] }>('/ai/summarize', {
      method: 'POST',
      body: JSON.stringify({ kpis }),
    }),

  // Comms & Audit
  getAnnouncements: () => apiRequest<any[]>('/comms/announcements'),
  createAnnouncement: (data: { title: string; content: string; priority?: string }) =>
    apiRequest<any>('/comms/announcements', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getNotifications: () => apiRequest<any[]>('/comms/notifications'),
  markNotificationRead: (id: string) =>
    apiRequest<any>(`/comms/notifications/${id}/read`, {
      method: 'POST',
    }),
  getAuditLogs: () => apiRequest<any[]>('/comms/audit-logs'),
};
