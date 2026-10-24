import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { db, Employee, User, Department, Designation } from '../db/database';

export interface EmployeeFilterQuery {
  search?: string;
  department_id?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export const employeeService = {
  async registerEmployee(data: {
    employee_code: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address: string;
    gender: 'male' | 'female' | 'other';
    date_of_birth: string;
    join_date: string;
    department_id: string;
    designation_id: string;
    basic_salary: number;
    temporary_password?: string;
  }): Promise<{ employee: Employee; tempPassword: string }> {
    const employees = db.get('employees');
    const users = db.get('users');

    const cleanCode = data.employee_code.trim().toUpperCase();
    const cleanEmail = data.email.trim().toLowerCase();

    // Check unique employee_code
    if (employees.some((e) => e.employee_code.toUpperCase() === cleanCode)) {
      throw new Error(`Employee with code "${cleanCode}" already exists.`);
    }

    // Check unique email in employees and users
    if (employees.some((e) => e.email.toLowerCase() === cleanEmail)) {
      throw new Error(`Employee with email "${cleanEmail}" already exists.`);
    }
    if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      throw new Error(`User account with email "${cleanEmail}" already exists.`);
    }

    // Salary calculations (spec: Gross = 1.5 * basic; HRA 40%, Medical 10%)
    const basic = Number(data.basic_salary);
    if (isNaN(basic) || basic <= 0) {
      throw new Error('Basic salary must be greater than 0.');
    }
    const hra = Math.round(basic * 0.4);
    const medical = Math.round(basic * 0.1);
    const gross = Math.round(basic * 1.5);

    const empId = randomUUID();
    const newEmployee: Employee = {
      id: empId,
      employee_code: cleanCode,
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      email: cleanEmail,
      phone: data.phone.trim(),
      address: data.address.trim(),
      gender: data.gender,
      date_of_birth: data.date_of_birth,
      join_date: data.join_date,
      status: 'active',
      department_id: data.department_id,
      designation_id: data.designation_id,
      basic_salary: basic,
      hra,
      medical_allowance: medical,
      gross_salary: gross,
      created_at: new Date().toISOString(),
    };

    employees.push(newEmployee);
    db.set('employees', employees);

    // Create user login with temporary password (change on first sign-in)
    const tempPassword = data.temporary_password || `Saylani@${Math.floor(1000 + Math.random() * 9000)}`;
    const password_hash = await bcrypt.hash(tempPassword, 10);

    const empUser: User = {
      id: randomUUID(),
      email: cleanEmail,
      password_hash,
      role: 'employee',
      employee_id: empId,
      must_change_password: true,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    users.push(empUser);
    db.set('users', users);

    return { employee: newEmployee, tempPassword };
  },

  getEmployees(query: EmployeeFilterQuery) {
    const employees = db.get('employees');
    const departments = db.get('departments');
    const designations = db.get('designations');

    let filtered = employees.map((emp) => {
      const dept = departments.find((d) => d.id === emp.department_id);
      const desig = designations.find((d) => d.id === emp.designation_id);
      return {
        ...emp,
        department_name: dept ? dept.name : 'Unknown',
        designation_name: desig ? desig.name : 'Unknown',
      };
    });

    if (query.search) {
      const s = query.search.toLowerCase().trim();
      filtered = filtered.filter(
        (e) =>
          e.first_name.toLowerCase().includes(s) ||
          e.last_name.toLowerCase().includes(s) ||
          e.employee_code.toLowerCase().includes(s) ||
          e.email.toLowerCase().includes(s) ||
          e.department_name.toLowerCase().includes(s)
      );
    }

    if (query.department_id) {
      filtered = filtered.filter((e) => e.department_id === query.department_id);
    }

    if (query.status) {
      filtered = filtered.filter((e) => e.status === query.status);
    }

    // Sort newest first
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = filtered.length;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    const data = filtered.slice(offset, offset + limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  getEmployee360(employeeId: string) {
    const employees = db.get('employees');
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) {
      throw new Error('Employee not found.');
    }

    const departments = db.get('departments');
    const designations = db.get('designations');
    const dept = departments.find((d) => d.id === emp.department_id);
    const desig = designations.find((d) => d.id === emp.designation_id);

    // Attendance records for this employee
    const allAttendance = db.get('attendance').filter((a) => a.employee_id === employeeId);
    // Leave requests
    const leaveRequests = db.get('leave_requests').filter((l) => l.employee_id === employeeId);
    // Payslips
    const payslips = db.get('payslips').filter((p) => p.employee_id === employeeId);

    // Leave balance calculation
    const leaveTypes = db.get('leave_types');
    const balances = leaveTypes.map((lt) => {
      const usedDays = leaveRequests
        .filter((l) => l.leave_type_id === lt.id && l.status === 'approved')
        .reduce((sum, l) => sum + l.days_count, 0);

      return {
        id: lt.id,
        name: lt.name,
        code: lt.code,
        quota: lt.yearly_quota,
        used: usedDays,
        remaining: lt.is_unpaid ? 999 : Math.max(0, lt.yearly_quota - usedDays),
      };
    });

    return {
      employee: {
        ...emp,
        department_name: dept?.name || 'Unassigned',
        designation_name: desig?.name || 'Unassigned',
      },
      leave_balances: balances,
      recent_attendance: allAttendance.slice(-10).reverse(),
      leave_history: leaveRequests.slice(-10).reverse(),
      payslips: payslips.slice(-6).reverse(),
    };
  },

  updateEmployee(
    employeeId: string,
    updates: Partial<Employee>,
    callerRole: 'admin' | 'hr' | 'employee',
    callerEmpId?: string
  ) {
    const employees = db.get('employees');
    const index = employees.findIndex((e) => e.id === employeeId);
    if (index === -1) {
      throw new Error('Employee not found.');
    }

    const current = employees[index];

    // Business rule: Employee can only edit own phone and address!
    if (callerRole === 'employee') {
      if (callerEmpId !== employeeId) {
        throw new Error('Forbidden: Employees can only edit their own profile.');
      }
      current.phone = updates.phone !== undefined ? updates.phone.trim() : current.phone;
      current.address = updates.address !== undefined ? updates.address.trim() : current.address;
    } else {
      // HR or Admin
      if (updates.basic_salary && updates.basic_salary !== current.basic_salary) {
        const basic = Number(updates.basic_salary);
        current.basic_salary = basic;
        current.hra = Math.round(basic * 0.4);
        current.medical_allowance = Math.round(basic * 0.1);
        current.gross_salary = Math.round(basic * 1.5);
      }
      if (updates.first_name) current.first_name = updates.first_name.trim();
      if (updates.last_name) current.last_name = updates.last_name.trim();
      if (updates.phone) current.phone = updates.phone.trim();
      if (updates.address) current.address = updates.address.trim();
      if (updates.department_id) current.department_id = updates.department_id;
      if (updates.designation_id) current.designation_id = updates.designation_id;
      if (updates.status) current.status = updates.status;
      if (updates.gender) current.gender = updates.gender;
      if (updates.exit_date) current.exit_date = updates.exit_date;
    }

    employees[index] = current;
    db.set('employees', employees);
    return current;
  },

  async dryRunCSV(csvText: string) {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      return {
        valid: false,
        summary: { total: 0, validRows: 0, invalidRows: 0 },
        errors: [{ row: 0, field: 'file', reason: 'CSV file is empty or missing headers.' }],
        preview: [],
      };
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const employees = db.get('employees');
    const departments = db.get('departments');
    const designations = db.get('designations');

    const errors: Array<{ row: number; field: string; reason: string }> = [];
    const validData: any[] = [];

    const seenCodes = new Set(employees.map((e) => e.employee_code.toUpperCase()));
    const seenEmails = new Set(employees.map((e) => e.email.toLowerCase()));

    for (let i = 1; i < lines.length; i++) {
      const rowNum = i + 1;
      const values = lines[i].split(',').map((v) => v.trim());
      const rowObj: any = {};
      headers.forEach((h, idx) => {
        rowObj[h] = values[idx] || '';
      });

      let hasRowError = false;

      // 1. Employee Code
      const code = (rowObj.employee_code || rowObj.code || '').toUpperCase();
      if (!code) {
        errors.push({ row: rowNum, field: 'employee_code', reason: 'Employee code is required.' });
        hasRowError = true;
      } else if (seenCodes.has(code)) {
        errors.push({ row: rowNum, field: 'employee_code', reason: `Employee code "${code}" is duplicate.` });
        hasRowError = true;
      }

      // 2. Names
      const firstName = rowObj.first_name || rowObj.firstname;
      const lastName = rowObj.last_name || rowObj.lastname;
      if (!firstName || !lastName) {
        errors.push({ row: rowNum, field: 'name', reason: 'First and last name are required.' });
        hasRowError = true;
      }

      // 3. Email
      const email = (rowObj.email || '').toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        errors.push({ row: rowNum, field: 'email', reason: 'Valid email address is required.' });
        hasRowError = true;
      } else if (seenEmails.has(email)) {
        errors.push({ row: rowNum, field: 'email', reason: `Email "${email}" is duplicate.` });
        hasRowError = true;
      }

      // 4. Department
      const deptVal = rowObj.department_code || rowObj.department || '';
      const matchedDept = departments.find(
        (d) => d.code.toLowerCase() === deptVal.toLowerCase() || d.name.toLowerCase() === deptVal.toLowerCase()
      );
      if (!matchedDept) {
        errors.push({ row: rowNum, field: 'department', reason: `Department "${deptVal}" not found.` });
        hasRowError = true;
      }

      // 5. Basic Salary
      const basic = Number(rowObj.basic_salary || rowObj.salary);
      if (isNaN(basic) || basic <= 0) {
        errors.push({ row: rowNum, field: 'basic_salary', reason: 'Salary must be a positive number.' });
        hasRowError = true;
      }

      // 6. Join date ISO
      const joinDate = rowObj.join_date || new Date().toISOString().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(joinDate)) {
        errors.push({ row: rowNum, field: 'join_date', reason: 'Join date must be in ISO format (YYYY-MM-DD).' });
        hasRowError = true;
      }

      if (!hasRowError) {
        seenCodes.add(code);
        seenEmails.add(email);
        validData.push({
          employee_code: code,
          first_name: firstName,
          last_name: lastName,
          email,
          phone: rowObj.phone || 'N/A',
          address: rowObj.address || 'N/A',
          gender: (rowObj.gender?.toLowerCase() || 'other') as 'male' | 'female' | 'other',
          date_of_birth: rowObj.date_of_birth || '1995-01-01',
          join_date: joinDate,
          department_id: matchedDept!.id,
          designation_id: designations[0]?.id || '',
          basic_salary: basic,
        });
      }
    }

    return {
      valid: errors.length === 0,
      summary: {
        total: lines.length - 1,
        validRows: validData.length,
        invalidRows: errors.length > 0 ? lines.length - 1 - validData.length : 0,
      },
      errors,
      preview: validData.slice(0, 5),
      validData,
    };
  },

  async commitCSVImport(validData: any[]) {
    const results: any[] = [];
    for (const item of validData) {
      const res = await this.registerEmployee(item);
      results.push(res.employee);
    }
    return results;
  },

  exportCSV() {
    const { data } = this.getEmployees({ limit: 10000 });
    const headers = [
      'employee_code',
      'first_name',
      'last_name',
      'email',
      'phone',
      'department',
      'designation',
      'status',
      'basic_salary',
      'gross_salary',
      'join_date',
    ];

    const rows = data.map((e) =>
      [
        e.employee_code,
        `"${e.first_name}"`,
        `"${e.last_name}"`,
        e.email,
        e.phone,
        `"${e.department_name}"`,
        `"${e.designation_name}"`,
        e.status,
        e.basic_salary,
        e.gross_salary,
        e.join_date,
      ].join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  },
};
