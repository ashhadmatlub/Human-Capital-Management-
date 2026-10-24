import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { db, User, CompanySettings } from '../db/database';
import { generateToken } from '../middleware/auth';
import { orgService } from './orgService';

export const authService = {
  isSetupCompleted(): boolean {
    const settings = db.get('settings');
    const users = db.get('users');
    const hasAdmin = users.some((u) => u.role === 'admin' && u.is_active);
    return Boolean(settings?.setup_completed && hasAdmin);
  },

  async bootstrapFirstRun(data: {
    company_name: string;
    admin_email: string;
    admin_password: string;
    office_start?: string;
    grace_minutes?: number;
    half_day_hours?: number;
    office_lat?: number;
    office_lng?: number;
    office_radius_meters?: number;
  }): Promise<{ user: Omit<User, 'password_hash'>; token: string }> {
    const users = db.get('users');
    const existingAdmin = users.find((u) => u.role === 'admin');
    if (existingAdmin) {
      throw new Error('Organization and Admin already established.');
    }

    // 1. Setup company settings
    orgService.updateSettings({
      company_name: data.company_name,
      office_start: data.office_start || '09:00',
      grace_minutes: data.grace_minutes ?? 15,
      half_day_hours: data.half_day_hours ?? 5,
      weekend_days: [0, 6],
      office_lat: data.office_lat ?? 24.8607,
      office_lng: data.office_lng ?? 67.0011,
      office_radius_meters: data.office_radius_meters ?? 150,
      currency: 'PKR',
      setup_completed: true,
      late_penalty_enabled: true,
    });

    // 2. Setup standard leave quotas if not present
    const existingLeaveTypes = db.get('leave_types');
    if (existingLeaveTypes.length === 0) {
      orgService.createLeaveType('Annual Leave', 'annual', 14);
      orgService.createLeaveType('Sick Leave', 'sick', 8);
      orgService.createLeaveType('Casual Leave', 'casual', 10);
      orgService.createLeaveType('Unpaid Leave', 'unpaid', 0);
    }

    // 3. Create Admin User
    const password_hash = await bcrypt.hash(data.admin_password, 10);
    const adminUser: User = {
      id: randomUUID(),
      email: data.admin_email.toLowerCase().trim(),
      password_hash,
      role: 'admin',
      is_active: true,
      must_change_password: false,
      created_at: new Date().toISOString(),
    };

    users.push(adminUser);
    db.set('users', users);

    const token = generateToken(adminUser);
    const { password_hash: _, ...safeUser } = adminUser;
    return { user: safeUser, token };
  },

  async login(
    email: string,
    password: string
  ): Promise<{
    user: Omit<User, 'password_hash'> & { employee?: any };
    token: string;
    must_change_password: boolean;
  }> {
    const users = db.get('users');
    const normalizedEmail = email.toLowerCase().trim();
    const user = users.find((u) => u.email.toLowerCase() === normalizedEmail);

    if (!user) {
      throw new Error('Invalid email or password.');
    }

    if (!user.is_active) {
      throw new Error('This account has been deactivated. Contact an administrator.');
    }

    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) {
      throw new Error('Invalid email or password.');
    }

    let employeeInfo: any = null;
    if (user.employee_id) {
      const employees = db.get('employees');
      employeeInfo = employees.find((e) => e.id === user.employee_id);
    }

    const token = generateToken(user);
    const { password_hash: _, ...safeUser } = user;

    return {
      user: { ...safeUser, employee: employeeInfo },
      token,
      must_change_password: Boolean(user.must_change_password),
    };
  },

  async changePassword(userId: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    const users = db.get('users');
    const user = users.find((u) => u.id === userId);
    if (!user) {
      throw new Error('User not found.');
    }

    user.password_hash = await bcrypt.hash(newPassword, 10);
    user.must_change_password = false;
    db.set('users', users);
  },

  async createHRUser(email: string, password: string): Promise<Omit<User, 'password_hash'>> {
    const users = db.get('users');
    const normalizedEmail = email.toLowerCase().trim();
    if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      throw new Error(`User with email "${email}" already exists.`);
    }

    const password_hash = await bcrypt.hash(password, 10);
    const hrUser: User = {
      id: randomUUID(),
      email: normalizedEmail,
      password_hash,
      role: 'hr',
      is_active: true,
      must_change_password: false,
      created_at: new Date().toISOString(),
    };

    users.push(hrUser);
    db.set('users', users);

    const { password_hash: _, ...safeUser } = hrUser;
    return safeUser;
  },

  async listUsers(): Promise<Array<Omit<User, 'password_hash'> & { employee_name?: string }>> {
    const users = db.get('users');
    const employees = db.get('employees');

    return users.map((u) => {
      const { password_hash, ...safe } = u;
      let employee_name: string | undefined;
      if (u.employee_id) {
        const emp = employees.find((e) => e.id === u.employee_id);
        if (emp) {
          employee_name = `${emp.first_name} ${emp.last_name}`;
        }
      }
      return { ...safe, employee_name };
    });
  },

  async toggleUserActive(userId: string, is_active: boolean): Promise<void> {
    const users = db.get('users');
    const user = users.find((u) => u.id === userId);
    if (!user) {
      throw new Error('User not found.');
    }
    if (user.role === 'admin' && !is_active) {
      const activeAdmins = users.filter((u) => u.role === 'admin' && u.is_active);
      if (activeAdmins.length <= 1) {
        throw new Error('Cannot deactivate the sole active Administrator.');
      }
    }
    user.is_active = is_active;
    db.set('users', users);
  },

  async resetPassword(userId: string, tempPassword: string): Promise<void> {
    const users = db.get('users');
    const user = users.find((u) => u.id === userId);
    if (!user) {
      throw new Error('User not found.');
    }
    user.password_hash = await bcrypt.hash(tempPassword, 10);
    user.must_change_password = true;
    db.set('users', users);
  },
};
