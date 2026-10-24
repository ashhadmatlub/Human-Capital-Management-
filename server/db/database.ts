import fs from 'fs';
import path from 'path';

export interface CompanySettings {
  company_name: string;
  office_start: string; // e.g. "09:00"
  grace_minutes: number; // e.g. 15
  half_day_hours: number; // e.g. 5
  weekend_days: number[]; // e.g. [0, 6] (Sunday=0, Saturday=6)
  office_lat: number; // e.g. 24.8607
  office_lng: number; // e.g. 67.0011
  office_radius_meters: number; // e.g. 150
  currency: string; // e.g. "PKR"
  setup_completed: boolean;
  late_penalty_enabled?: boolean; // bonus: 3 lates = 0.5 day
}

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'hr' | 'employee';
  employee_id?: string;
  must_change_password?: boolean;
  is_active: boolean;
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  created_at: string;
}

export interface Designation {
  id: string;
  name: string;
  department_id: string;
  created_at: string;
}

export interface LeaveType {
  id: string;
  name: string;
  code: 'annual' | 'sick' | 'casual' | 'unpaid';
  yearly_quota: number;
  is_unpaid: boolean;
  created_at: string;
}

export interface PublicHoliday {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  created_at: string;
}

export interface Employee {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  gender: 'male' | 'female' | 'other';
  date_of_birth: string;
  join_date: string; // YYYY-MM-DD
  exit_date?: string; // YYYY-MM-DD
  status: 'active' | 'probation' | 'resigned' | 'terminated';
  department_id: string;
  designation_id: string;
  basic_salary: number;
  hra: number; // 40% of basic
  medical_allowance: number; // 10% of basic
  gross_salary: number; // 1.5 * basic
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string; // YYYY-MM-DD
  check_in: string; // ISO string
  check_out?: string; // ISO string
  total_hours?: number;
  status: 'present' | 'late' | 'half_day' | 'absent' | 'missing_checkout';
  source: 'web' | 'camera';
  lat?: number;
  lng?: number;
  created_at: string;
}

export interface AttendanceCorrection {
  id: string;
  employee_id: string;
  attendance_id?: string;
  date: string;
  requested_check_in: string;
  requested_check_out?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewer_id?: string;
  reviewer_comment?: string;
  created_at: string;
  reviewed_at?: string;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  days_count: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reviewer_id?: string;
  reviewer_comment?: string;
  created_at: string;
  reviewed_at?: string;
}

export interface PayrollRun {
  id: string;
  month: string; // YYYY-MM
  status: 'draft' | 'finalized';
  total_gross: number;
  total_deductions: number;
  total_tax: number;
  total_net: number;
  working_days: number;
  created_by: string;
  finalized_by?: string;
  finalized_at?: string;
  created_at: string;
}

export interface Payslip {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  month: string;
  basic_salary: number;
  hra: number;
  medical_allowance: number;
  gross_salary: number;
  absent_days: number;
  unpaid_leave_days: number;
  half_days: number;
  worked_days: number;
  deductions: number;
  taxable_income: number;
  tax: number;
  net_salary: number;
  status: 'draft' | 'paid';
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'normal' | 'important' | 'urgent';
  author_id: string;
  author_name: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'leave' | 'payroll' | 'system';
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  action: string;
  entity: string;
  entity_id?: string;
  before_state?: any;
  after_state?: any;
  created_at: string;
}

export interface AiLog {
  id: string;
  user_id: string;
  user_role: string;
  prompt: string;
  tool_called?: string;
  result_summary?: string;
  created_at: string;
}

export interface DatabaseSchema {
  settings: CompanySettings | null;
  users: User[];
  departments: Department[];
  designations: Designation[];
  leave_types: LeaveType[];
  public_holidays: PublicHoliday[];
  employees: Employee[];
  attendance: AttendanceRecord[];
  attendance_corrections: AttendanceCorrection[];
  leave_requests: LeaveRequest[];
  payroll_runs: PayrollRun[];
  payslips: Payslip[];
  announcements: Announcement[];
  notifications: Notification[];
  audit_logs: AuditLog[];
  ai_logs: AiLog[];
}

const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
const DATA_FILE = path.join(DATA_DIR, 'hcm_database.json');

const emptyDatabase: DatabaseSchema = {
  settings: null,
  users: [],
  departments: [],
  designations: [],
  leave_types: [],
  public_holidays: [],
  employees: [],
  attendance: [],
  attendance_corrections: [],
  leave_requests: [],
  payroll_runs: [],
  payslips: [],
  announcements: [],
  notifications: [],
  audit_logs: [],
  ai_logs: [],
};

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        return { ...emptyDatabase, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.error('Failed to load database file, starting clean:', e);
    }
    return { ...emptyDatabase };
  }

  public save(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save database file:', e);
    }
  }

  public get<K extends keyof DatabaseSchema>(key: K): DatabaseSchema[K] {
    return this.data[key];
  }

  public set<K extends keyof DatabaseSchema>(key: K, value: DatabaseSchema[K]): void {
    this.data[key] = value;
    this.save();
  }

  public reset(): void {
    this.data = { ...emptyDatabase };
    this.save();
  }
}

export const db = new Database();
