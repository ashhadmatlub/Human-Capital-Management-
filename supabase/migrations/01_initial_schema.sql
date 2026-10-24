-- HCM Lite Database Schema (PostgreSQL / Supabase compatible)

-- 1. Company Settings
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  office_start TIME DEFAULT '09:00',
  grace_minutes INT DEFAULT 15,
  half_day_hours INT DEFAULT 5,
  weekend_days INT[] DEFAULT '{0, 6}',
  office_lat DOUBLE PRECISION DEFAULT 24.8607,
  office_lng DOUBLE PRECISION DEFAULT 67.0011,
  office_radius_meters INT DEFAULT 150,
  currency TEXT DEFAULT 'PKR',
  setup_completed BOOLEAN DEFAULT true,
  late_penalty_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Departments
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Designations
CREATE TABLE IF NOT EXISTS designations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Leave Types
CREATE TABLE IF NOT EXISTS leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL, -- annual, sick, casual, unpaid
  yearly_quota INT DEFAULT 0,
  is_unpaid BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Public Holidays
CREATE TABLE IF NOT EXISTS public_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Employees
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  address TEXT,
  gender TEXT DEFAULT 'other',
  date_of_birth DATE,
  join_date DATE NOT NULL,
  exit_date DATE,
  status TEXT DEFAULT 'active', -- active, probation, resigned, terminated
  department_id UUID REFERENCES departments(id),
  designation_id UUID REFERENCES designations(id),
  basic_salary NUMERIC NOT NULL,
  hra NUMERIC NOT NULL,
  medical_allowance NUMERIC NOT NULL,
  gross_salary NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL, -- admin, hr, employee
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  must_change_password BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Attendance
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in TIMESTAMPTZ NOT NULL,
  check_out TIMESTAMPTZ,
  total_hours NUMERIC,
  status TEXT NOT NULL, -- present, late, half_day, absent, missing_checkout
  source TEXT DEFAULT 'web',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (employee_id, date)
);

-- 9. Attendance Corrections
CREATE TABLE IF NOT EXISTS attendance_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  requested_check_in TIMESTAMPTZ NOT NULL,
  requested_check_out TIMESTAMPTZ,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  reviewer_id UUID REFERENCES users(id),
  reviewer_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

-- 10. Leave Requests
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id UUID REFERENCES leave_types(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected, cancelled
  reviewer_id UUID REFERENCES users(id),
  reviewer_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

-- 11. Payroll Runs
CREATE TABLE IF NOT EXISTS payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month TEXT UNIQUE NOT NULL, -- YYYY-MM
  status TEXT DEFAULT 'draft', -- draft, finalized
  total_gross NUMERIC DEFAULT 0,
  total_deductions NUMERIC DEFAULT 0,
  total_tax NUMERIC DEFAULT 0,
  total_net NUMERIC DEFAULT 0,
  working_days INT NOT NULL,
  created_by UUID REFERENCES users(id),
  finalized_by UUID REFERENCES users(id),
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. Payslips
CREATE TABLE IF NOT EXISTS payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  basic_salary NUMERIC NOT NULL,
  hra NUMERIC NOT NULL,
  medical_allowance NUMERIC NOT NULL,
  gross_salary NUMERIC NOT NULL,
  absent_days NUMERIC DEFAULT 0,
  unpaid_leave_days NUMERIC DEFAULT 0,
  half_days NUMERIC DEFAULT 0,
  worked_days NUMERIC NOT NULL,
  deductions NUMERIC DEFAULT 0,
  taxable_income NUMERIC NOT NULL,
  tax NUMERIC DEFAULT 0,
  net_salary NUMERIC NOT NULL,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 13. Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  author_id UUID REFERENCES users(id),
  author_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 14. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'system',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 15. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  before_state JSONB,
  after_state JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 16. AI Logs
CREATE TABLE IF NOT EXISTS ai_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_role TEXT NOT NULL,
  prompt TEXT NOT NULL,
  tool_called TEXT,
  result_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
