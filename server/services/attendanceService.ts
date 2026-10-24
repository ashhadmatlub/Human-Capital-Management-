import { randomUUID } from 'crypto';
import { db, AttendanceRecord, AttendanceCorrection, CompanySettings } from '../db/database';

// Haversine formula to calculate distance in meters between two lat/lng points
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export const attendanceService = {
  checkIn(data: {
    employee_id: string;
    source?: 'web' | 'camera';
    lat?: number;
    lng?: number;
    face_detected?: boolean;
  }): { record: AttendanceRecord; message: string } {
    const attendance = db.get('attendance');
    const settings = db.get('settings') || {
      office_start: '09:00',
      grace_minutes: 15,
      half_day_hours: 5,
      office_lat: 24.8607,
      office_lng: 67.0011,
      office_radius_meters: 150,
    };

    const now = new Date();
    const today = now.toISOString().slice(0, 10); // YYYY-MM-DD

    // 1. Enforce rule: One record per employee per day. Second check-in = 409
    const existing = attendance.find((a) => a.employee_id === data.employee_id && a.date === today);
    if (existing) {
      const error: any = new Error('Attendance already recorded for today. Second check-in is not permitted.');
      error.status = 409;
      throw error;
    }

    // 2. Geofence & camera check if source is camera or location provided
    if (data.source === 'camera') {
      if (!data.face_detected) {
        throw new Error('Camera check-in rejected: No valid face detected in frame.');
      }
      if (data.lat !== undefined && data.lng !== undefined) {
        const dist = calculateHaversineDistance(
          data.lat,
          data.lng,
          settings.office_lat,
          settings.office_lng
        );
        if (dist > settings.office_radius_meters) {
          throw new Error(
            `Location outside authorized office area. Distance is ${dist}m (Allowed radius: ${settings.office_radius_meters}m).`
          );
        }
      }
    }

    // 3. Determine if late (Office start 09:00 + grace 15 min = 09:15)
    const [startHour, startMinute] = (settings.office_start || '09:00').split(':').map(Number);
    const cutoffMinutes = startHour * 60 + startMinute + (settings.grace_minutes || 15);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const isLate = currentMinutes > cutoffMinutes;
    const status = isLate ? 'late' : 'present';

    const newRecord: AttendanceRecord = {
      id: randomUUID(),
      employee_id: data.employee_id,
      date: today,
      check_in: now.toISOString(),
      status,
      source: data.source || 'web',
      lat: data.lat,
      lng: data.lng,
      created_at: now.toISOString(),
    };

    attendance.push(newRecord);
    db.set('attendance', attendance);

    return {
      record: newRecord,
      message: isLate ? 'Check-in recorded as Late (arrived after grace period).' : 'Check-in successful (On-time).',
    };
  },

  checkOut(employee_id: string): AttendanceRecord {
    const attendance = db.get('attendance');
    const settings = db.get('settings') || { half_day_hours: 5 };
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    const record = attendance.find((a) => a.employee_id === employee_id && a.date === today);
    if (!record) {
      throw new Error('No check-in record found for today. Please check in first.');
    }
    if (record.check_out) {
      throw new Error('Check-out already marked for today.');
    }

    record.check_out = now.toISOString();

    // Calculate hours worked
    const inTime = new Date(record.check_in).getTime();
    const outTime = now.getTime();
    const totalHours = Math.round(((outTime - inTime) / (1000 * 60 * 60)) * 10) / 10;
    record.total_hours = totalHours;

    // Rule: half_day under 5 h
    if (totalHours < (settings.half_day_hours || 5)) {
      record.status = 'half_day';
    }

    db.set('attendance', attendance);
    return record;
  },

  getDailyBoard(date?: string) {
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const employees = db.get('employees').filter((e) => e.status === 'active' || e.status === 'probation');
    const attendance = db.get('attendance').filter((a) => a.date === targetDate);
    const leaveRequests = db.get('leave_requests').filter(
      (l) => l.status === 'approved' && l.start_date <= targetDate && l.end_date >= targetDate
    );
    const departments = db.get('departments');

    const board = employees.map((emp) => {
      const att = attendance.find((a) => a.employee_id === emp.id);
      const leave = leaveRequests.find((l) => l.employee_id === emp.id);
      const dept = departments.find((d) => d.id === emp.department_id);

      let status = 'absent';
      if (att) {
        status = att.status;
      } else if (leave) {
        status = 'on_leave';
      }

      return {
        employee_id: emp.id,
        employee_code: emp.employee_code,
        name: `${emp.first_name} ${emp.last_name}`,
        department_name: dept?.name || 'Unassigned',
        date: targetDate,
        check_in: att?.check_in || null,
        check_out: att?.check_out || null,
        total_hours: att?.total_hours || null,
        status,
        source: att?.source || null,
      };
    });

    const summary = {
      date: targetDate,
      total_employees: employees.length,
      present: board.filter((b) => b.status === 'present').length,
      late: board.filter((b) => b.status === 'late').length,
      half_day: board.filter((b) => b.status === 'half_day').length,
      on_leave: board.filter((b) => b.status === 'on_leave').length,
      absent: board.filter((b) => b.status === 'absent').length,
    };

    return { summary, records: board };
  },

  getEmployeeHistory(employee_id: string, month?: string) {
    const attendance = db.get('attendance').filter((a) => a.employee_id === employee_id);
    if (month) {
      return attendance.filter((a) => a.date.startsWith(month));
    }
    return attendance;
  },

  requestCorrection(data: {
    employee_id: string;
    date: string;
    requested_check_in: string;
    requested_check_out?: string;
    reason: string;
  }): AttendanceCorrection {
    const corrections = db.get('attendance_corrections');
    const existingPending = corrections.find(
      (c) => c.employee_id === data.employee_id && c.date === data.date && c.status === 'pending'
    );
    if (existingPending) {
      throw new Error('A correction request for this date is already awaiting review.');
    }

    const item: AttendanceCorrection = {
      id: randomUUID(),
      employee_id: data.employee_id,
      date: data.date,
      requested_check_in: data.requested_check_in,
      requested_check_out: data.requested_check_out,
      reason: data.reason.trim(),
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    corrections.unshift(item);
    db.set('attendance_corrections', corrections);
    return item;
  },

  reviewCorrection(
    correctionId: string,
    reviewerId: string,
    decision: 'approved' | 'rejected',
    comment?: string
  ): AttendanceCorrection {
    const corrections = db.get('attendance_corrections');
    const correction = corrections.find((c) => c.id === correctionId);
    if (!correction) {
      throw new Error('Attendance correction request not found.');
    }
    if (correction.status !== 'pending') {
      throw new Error(`This request has already been ${correction.status}.`);
    }

    correction.status = decision;
    correction.reviewer_id = reviewerId;
    correction.reviewer_comment = comment || '';
    correction.reviewed_at = new Date().toISOString();

    if (decision === 'approved') {
      const attendance = db.get('attendance');
      let attRecord = attendance.find(
        (a) => a.employee_id === correction.employee_id && a.date === correction.date
      );

      const inTime = new Date(correction.requested_check_in);
      let totalHours: number | undefined;
      let status: 'present' | 'late' | 'half_day' = 'present';

      if (correction.requested_check_out) {
        const outTime = new Date(correction.requested_check_out);
        totalHours = Math.round(((outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60)) * 10) / 10;
        if (totalHours < 5) {
          status = 'half_day';
        }
      }

      if (attRecord) {
        attRecord.check_in = correction.requested_check_in;
        attRecord.check_out = correction.requested_check_out;
        attRecord.total_hours = totalHours;
        attRecord.status = status;
      } else {
        attendance.push({
          id: randomUUID(),
          employee_id: correction.employee_id,
          date: correction.date,
          check_in: correction.requested_check_in,
          check_out: correction.requested_check_out,
          total_hours: totalHours,
          status,
          source: 'web',
          created_at: new Date().toISOString(),
        });
      }
      db.set('attendance', attendance);
    }

    db.set('attendance_corrections', corrections);
    return correction;
  },

  getCorrections(employeeId?: string) {
    const corrections = db.get('attendance_corrections');
    const employees = db.get('employees');

    let list = corrections.map((c) => {
      const emp = employees.find((e) => e.id === c.employee_id);
      return {
        ...c,
        employee_name: emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown',
        employee_code: emp?.employee_code || '',
      };
    });

    if (employeeId) {
      list = list.filter((c) => c.employee_id === employeeId);
    }

    return list;
  },
};
