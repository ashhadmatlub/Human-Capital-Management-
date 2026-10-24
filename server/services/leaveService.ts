import { randomUUID } from 'crypto';
import { db, LeaveRequest, Notification } from '../db/database';

export const leaveService = {
  // Helper to compute working days between two dates, excluding weekends and public holidays
  calculateWorkingDays(startDateStr: string, endDateStr: string): number {
    const settings = db.get('settings');
    const weekendDays = settings?.weekend_days || [0, 6]; // Sun, Sat
    const holidays = db.get('public_holidays').map((h) => h.date);

    let count = 0;
    const cur = new Date(startDateStr);
    const end = new Date(endDateStr);

    while (cur <= end) {
      const dayOfWeek = cur.getDay();
      const dateStr = cur.toISOString().slice(0, 10);

      // Check if weekend or holiday
      const isWeekend = weekendDays.includes(dayOfWeek);
      const isHoliday = holidays.includes(dateStr);

      if (!isWeekend && !isHoliday) {
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }

    return count;
  },

  getLeaveBalances(employeeId: string) {
    const leaveTypes = db.get('leave_types');
    const requests = db.get('leave_requests').filter((l) => l.employee_id === employeeId);

    return leaveTypes.map((lt) => {
      const used = requests
        .filter((l) => l.leave_type_id === lt.id && l.status === 'approved')
        .reduce((sum, l) => sum + l.days_count, 0);

      const pending = requests
        .filter((l) => l.leave_type_id === lt.id && l.status === 'pending')
        .reduce((sum, l) => sum + l.days_count, 0);

      const remaining = lt.is_unpaid ? 9999 : Math.max(0, lt.yearly_quota - used);

      return {
        id: lt.id,
        name: lt.name,
        code: lt.code,
        quota: lt.yearly_quota,
        used,
        pending,
        remaining,
        is_unpaid: lt.is_unpaid,
      };
    });
  },

  applyLeave(data: {
    employee_id: string;
    leave_type_id: string;
    start_date: string;
    end_date: string;
    reason: string;
  }): LeaveRequest {
    if (data.start_date > data.end_date) {
      const err: any = new Error('Start date cannot be after end date.');
      err.status = 422;
      throw err;
    }

    const leaveTypes = db.get('leave_types');
    const leaveType = leaveTypes.find((lt) => lt.id === data.leave_type_id);
    if (!leaveType) {
      const err: any = new Error('Invalid leave type specified.');
      err.status = 422;
      throw err;
    }

    // 1. Calculate working days
    const daysCount = this.calculateWorkingDays(data.start_date, data.end_date);
    if (daysCount <= 0) {
      const err: any = new Error('The selected date range contains no working days (only weekends or holidays).');
      err.status = 422;
      throw err;
    }

    // 2. Overlap check with existing non-cancelled/non-rejected requests
    const requests = db.get('leave_requests').filter(
      (l) => l.employee_id === data.employee_id && (l.status === 'approved' || l.status === 'pending')
    );

    const hasOverlap = requests.some((r) => {
      return (
        (data.start_date >= r.start_date && data.start_date <= r.end_date) ||
        (data.end_date >= r.start_date && data.end_date <= r.end_date) ||
        (data.start_date <= r.start_date && data.end_date >= r.end_date)
      );
    });

    if (hasOverlap) {
      const err: any = new Error('Leave request overlaps with an existing pending or approved leave record.');
      err.status = 422;
      throw err;
    }

    // 3. Balance check (Rule: Over-balance = 422)
    if (!leaveType.is_unpaid) {
      const balances = this.getLeaveBalances(data.employee_id);
      const balance = balances.find((b) => b.id === data.leave_type_id);
      if (balance && daysCount > balance.remaining) {
        const err: any = new Error(
          `Insufficient leave balance. You requested ${daysCount} day(s), but only have ${balance.remaining} day(s) remaining for ${leaveType.name}.`
        );
        err.status = 422;
        throw err;
      }
    }

    const newRequest: LeaveRequest = {
      id: randomUUID(),
      employee_id: data.employee_id,
      leave_type_id: data.leave_type_id,
      start_date: data.start_date,
      end_date: data.end_date,
      days_count: daysCount,
      reason: data.reason.trim(),
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    const allRequests = db.get('leave_requests');
    allRequests.unshift(newRequest);
    db.set('leave_requests', allRequests);

    return newRequest;
  },

  cancelLeave(leaveId: string, employeeId: string): LeaveRequest {
    const requests = db.get('leave_requests');
    const req = requests.find((r) => r.id === leaveId);
    if (!req) {
      throw new Error('Leave request not found.');
    }
    if (req.employee_id !== employeeId) {
      throw new Error('Forbidden: You can only cancel your own leave requests.');
    }
    if (req.status === 'cancelled') {
      throw new Error('Leave request is already cancelled.');
    }

    req.status = 'cancelled';
    db.set('leave_requests', requests);
    return req;
  },

  reviewLeave(
    leaveId: string,
    reviewerId: string,
    decision: 'approved' | 'rejected',
    comment?: string
  ): LeaveRequest {
    const requests = db.get('leave_requests');
    const req = requests.find((r) => r.id === leaveId);
    if (!req) {
      throw new Error('Leave request not found.');
    }
    if (req.status !== 'pending') {
      throw new Error(`Leave request has already been ${req.status}.`);
    }

    req.status = decision;
    req.reviewer_id = reviewerId;
    req.reviewer_comment = comment || '';
    req.reviewed_at = new Date().toISOString();

    db.set('leave_requests', requests);

    // Create in-app notification for the employee
    const users = db.get('users');
    const empUser = users.find((u) => u.employee_id === req.employee_id);
    if (empUser) {
      const notifs = db.get('notifications');
      notifs.unshift({
        id: randomUUID(),
        user_id: empUser.id,
        title: `Leave Request ${decision === 'approved' ? 'Approved' : 'Rejected'}`,
        message: `Your leave request for ${req.days_count} day(s) from ${req.start_date} to ${req.end_date} was ${decision}.${comment ? ` Note: "${comment}"` : ''}`,
        type: 'leave',
        is_read: false,
        created_at: new Date().toISOString(),
      });
      db.set('notifications', notifs);
    }

    return req;
  },

  getLeaveRequests(filter?: { employee_id?: string; status?: string }) {
    const requests = db.get('leave_requests');
    const employees = db.get('employees');
    const leaveTypes = db.get('leave_types');
    const departments = db.get('departments');

    let list = requests.map((r) => {
      const emp = employees.find((e) => e.id === r.employee_id);
      const lt = leaveTypes.find((l) => l.id === r.leave_type_id);
      const dept = departments.find((d) => d.id === emp?.department_id);

      return {
        ...r,
        employee_name: emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown',
        employee_code: emp?.employee_code || '',
        department_name: dept?.name || '',
        leave_type_name: lt?.name || 'Leave',
        leave_type_code: lt?.code || '',
      };
    });

    if (filter?.employee_id) {
      list = list.filter((r) => r.employee_id === filter.employee_id);
    }
    if (filter?.status) {
      list = list.filter((r) => r.status === filter.status);
    }

    return list;
  },
};
