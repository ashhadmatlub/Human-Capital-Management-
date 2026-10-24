import { randomUUID } from 'crypto';
import { db, CompanySettings, Department, Designation, LeaveType, PublicHoliday } from '../db/database';

export const orgService = {
  getSettings(): CompanySettings | null {
    return db.get('settings');
  },

  updateSettings(data: Partial<CompanySettings>): CompanySettings {
    const current = db.get('settings') || {
      company_name: 'HCM Lite Demo Corp',
      office_start: '09:00',
      grace_minutes: 15,
      half_day_hours: 5,
      weekend_days: [0, 6], // Sunday, Saturday
      office_lat: 24.8607,
      office_lng: 67.0011,
      office_radius_meters: 150,
      currency: 'PKR',
      setup_completed: true,
      late_penalty_enabled: true,
    };

    const updated: CompanySettings = {
      ...current,
      ...data,
      setup_completed: true,
    };
    db.set('settings', updated);
    return updated;
  },

  getDepartments(): Department[] {
    return db.get('departments');
  },

  createDepartment(name: string, code: string): Department {
    const departments = db.get('departments');
    const existing = departments.find(
      (d) => d.code.toLowerCase() === code.toLowerCase() || d.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      throw new Error(`Department with code "${code}" or name "${name}" already exists.`);
    }

    const dept: Department = {
      id: randomUUID(),
      name,
      code: code.toUpperCase(),
      created_at: new Date().toISOString(),
    };
    departments.push(dept);
    db.set('departments', departments);
    return dept;
  },

  getDesignations(departmentId?: string): Designation[] {
    const desigs = db.get('designations');
    if (departmentId) {
      return desigs.filter((d) => d.department_id === departmentId);
    }
    return desigs;
  },

  createDesignation(name: string, department_id: string): Designation {
    const desigs = db.get('designations');
    const item: Designation = {
      id: randomUUID(),
      name,
      department_id,
      created_at: new Date().toISOString(),
    };
    desigs.push(item);
    db.set('designations', desigs);
    return item;
  },

  getLeaveTypes(): LeaveType[] {
    return db.get('leave_types');
  },

  createLeaveType(name: string, code: 'annual' | 'sick' | 'casual' | 'unpaid', yearly_quota: number): LeaveType {
    const types = db.get('leave_types');
    const existing = types.find((t) => t.code === code);
    if (existing) {
      throw new Error(`Leave type with code "${code}" already exists.`);
    }
    const leaveType: LeaveType = {
      id: randomUUID(),
      name,
      code,
      yearly_quota: code === 'unpaid' ? 999999 : yearly_quota,
      is_unpaid: code === 'unpaid',
      created_at: new Date().toISOString(),
    };
    types.push(leaveType);
    db.set('leave_types', types);
    return leaveType;
  },

  getPublicHolidays(): PublicHoliday[] {
    return db.get('public_holidays');
  },

  createPublicHoliday(name: string, date: string): PublicHoliday {
    const holidays = db.get('public_holidays');
    const holiday: PublicHoliday = {
      id: randomUUID(),
      name,
      date,
      created_at: new Date().toISOString(),
    };
    holidays.push(holiday);
    db.set('public_holidays', holidays);
    return holiday;
  },
};
