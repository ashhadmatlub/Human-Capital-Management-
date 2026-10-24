import { db } from '../db/database';

export const analyticsService = {
  getAdminMetrics(filters?: { department_id?: string; start_date?: string; end_date?: string }) {
    let employees = db.get('employees');
    const departments = db.get('departments');
    const designations = db.get('designations');
    const auditLogs = db.get('audit_logs');
    const payrollRuns = db.get('payroll_runs');
    const payslips = db.get('payslips');

    if (filters?.department_id) {
      employees = employees.filter((e) => e.department_id === filters.department_id);
    }

    // 1. Headcount & Attrition
    const activeEmployees = employees.filter((e) => e.status === 'active' || e.status === 'probation');
    const exitedEmployees = employees.filter((e) => e.status === 'resigned' || e.status === 'terminated');
    const headcount = activeEmployees.length;

    const avgHeadcount = headcount + exitedEmployees.length / 2 || 1;
    const attritionRate = Math.round((exitedEmployees.length / avgHeadcount) * 100 * 10) / 10;

    // 2. Payroll Cost & Average Salary
    const totalPayrollGross = activeEmployees.reduce((sum, e) => sum + (e.gross_salary || 0), 0);
    const avgSalary = headcount > 0 ? Math.round(totalPayrollGross / headcount) : 0;

    // Headcount by Department
    const headcountByDept = departments.map((d) => {
      const count = activeEmployees.filter((e) => e.department_id === d.id).length;
      const deptGross = activeEmployees
        .filter((e) => e.department_id === d.id)
        .reduce((sum, e) => sum + (e.gross_salary || 0), 0);
      return {
        id: d.id,
        name: d.name,
        code: d.code,
        headcount: count,
        payroll_cost: deptGross,
      };
    });

    // Gender breakdown
    const genderBreakdown = {
      male: activeEmployees.filter((e) => e.gender === 'male').length,
      female: activeEmployees.filter((e) => e.gender === 'female').length,
      other: activeEmployees.filter((e) => e.gender === 'other').length,
    };

    // Tenure distribution (months since join_date)
    const now = new Date();
    const tenure = {
      under_6m: 0,
      six_to_12m: 0,
      one_to_two_yrs: 0,
      two_plus_yrs: 0,
    };

    activeEmployees.forEach((e) => {
      const joinDate = new Date(e.join_date);
      const months = (now.getFullYear() - joinDate.getFullYear()) * 12 + (now.getMonth() - joinDate.getMonth());
      if (months < 6) tenure.under_6m++;
      else if (months <= 12) tenure.six_to_12m++;
      else if (months <= 24) tenure.one_to_two_yrs++;
      else tenure.two_plus_yrs++;
    });

    // Recent audit logs
    const recentAudit = auditLogs.slice(0, 15);

    // Latest finalized or draft payroll
    const lastPayroll = payrollRuns[payrollRuns.length - 1] || null;

    return {
      headcount,
      attrition_rate: attritionRate,
      monthly_payroll_cost: totalPayrollGross,
      avg_salary: avgSalary,
      headcount_by_department: headcountByDept,
      gender_breakdown: genderBreakdown,
      tenure_distribution: tenure,
      recent_audit_feed: recentAudit,
      last_payroll_run: lastPayroll,
    };
  },

  getHRMetrics(filters?: { department_id?: string; month?: string }) {
    let employees = db.get('employees').filter((e) => e.status === 'active' || e.status === 'probation');
    const departments = db.get('departments');
    const attendance = db.get('attendance');
    const leaveRequests = db.get('leave_requests');
    const leaveTypes = db.get('leave_types');
    const corrections = db.get('attendance_corrections');

    if (filters?.department_id) {
      employees = employees.filter((e) => e.department_id === filters.department_id);
    }

    const today = new Date().toISOString().slice(0, 10);
    const todayAttendance = attendance.filter((a) => a.date === today);
    const todayLeave = leaveRequests.filter(
      (l) => l.status === 'approved' && l.start_date <= today && l.end_date >= today
    );

    const presentToday = todayAttendance.filter((a) => a.status === 'present' || a.status === 'late').length;
    const lateToday = todayAttendance.filter((a) => a.status === 'late').length;
    const onLeaveToday = todayLeave.length;

    const pendingLeaveCount = leaveRequests.filter((l) => l.status === 'pending').length;
    const pendingCorrectionCount = corrections.filter((c) => c.status === 'pending').length;

    // Monthly attendance rate: (present + late + missing_checkout + 0.5 * half_day) / (working-day records - on_leave)
    const currentMonth = filters?.month || today.slice(0, 7);
    const monthAtt = attendance.filter((a) => a.date.startsWith(currentMonth));
    const monthLeaves = leaveRequests.filter((l) => l.status === 'approved' && l.start_date.startsWith(currentMonth));

    const totalPresent = monthAtt.filter((a) => a.status === 'present').length;
    const totalLate = monthAtt.filter((a) => a.status === 'late').length;
    const totalMissing = monthAtt.filter((a) => a.status === 'missing_checkout').length;
    const totalHalfDay = monthAtt.filter((a) => a.status === 'half_day').length;

    const attendedPoints = totalPresent + totalLate + totalMissing + 0.5 * totalHalfDay;
    const denominator = Math.max(1, monthAtt.length);
    const attendanceRate = Math.min(100, Math.round((attendedPoints / denominator) * 100));

    // Absenteeism by Department
    const absenteeismByDept = departments.map((d) => {
      const deptEmpIds = employees.filter((e) => e.department_id === d.id).map((e) => e.id);
      const deptAtt = monthAtt.filter((a) => deptEmpIds.includes(a.employee_id));
      const deptHalf = deptAtt.filter((a) => a.status === 'half_day').length;
      const deptLate = deptAtt.filter((a) => a.status === 'late').length;
      return {
        department_name: d.name,
        records_count: deptAtt.length,
        late_count: deptLate,
        half_day_count: deptHalf,
      };
    });

    // Leave utilization by type
    const leaveUtilization = leaveTypes.map((lt) => {
      const usedDays = monthLeaves
        .filter((l) => l.leave_type_id === lt.id)
        .reduce((sum, l) => sum + l.days_count, 0);
      return {
        id: lt.id,
        name: lt.name,
        code: lt.code,
        quota: lt.yearly_quota,
        used_this_month: usedDays,
      };
    });

    // Top 5 late-comers this month
    const lateCounts: { [empId: string]: number } = {};
    monthAtt
      .filter((a) => a.status === 'late')
      .forEach((a) => {
        lateCounts[a.employee_id] = (lateCounts[a.employee_id] || 0) + 1;
      });

    const top5LateComers = Object.entries(lateCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([empId, count]) => {
        const emp = employees.find((e) => e.id === empId);
        return {
          employee_id: empId,
          name: emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown',
          employee_code: emp?.employee_code || '',
          late_count: count,
        };
      });

    return {
      headcount: employees.length,
      present_today: presentToday,
      late_today: lateToday,
      on_leave_today: onLeaveToday,
      pending_approvals: pendingLeaveCount + pendingCorrectionCount,
      pending_leave_count: pendingLeaveCount,
      pending_correction_count: pendingCorrectionCount,
      attendance_rate: attendanceRate,
      absenteeism_by_dept: absenteeismByDept,
      leave_utilization: leaveUtilization,
      top_5_late_comers: top5LateComers,
    };
  },

  getEmployeeDashboard(employeeId: string) {
    const today = new Date().toISOString().slice(0, 10);
    const attendance = db.get('attendance').filter((a) => a.employee_id === employeeId);
    const todayAtt = attendance.find((a) => a.date === today);

    // Calculate hours worked this week (Monday through Sunday)
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // Monday=0
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek);
    const mondayStr = monday.toISOString().slice(0, 10);

    const thisWeekAtt = attendance.filter((a) => a.date >= mondayStr && a.date <= today);
    const weeklyHours = thisWeekAtt.reduce((sum, a) => sum + (a.total_hours || (a.check_in && !a.check_out ? 4 : 8)), 0);

    // Late count this month
    const currentMonth = today.slice(0, 7);
    const lateCount = attendance.filter((a) => a.date.startsWith(currentMonth) && a.status === 'late').length;

    // Leave balances
    const leaveTypes = db.get('leave_types');
    const leaves = db.get('leave_requests').filter((l) => l.employee_id === employeeId);
    const leaveBalances = leaveTypes.map((lt) => {
      const used = leaves
        .filter((l) => l.leave_type_id === lt.id && l.status === 'approved')
        .reduce((sum, l) => sum + l.days_count, 0);
      return {
        id: lt.id,
        name: lt.name,
        code: lt.code,
        quota: lt.yearly_quota,
        used,
        remaining: lt.is_unpaid ? 999 : Math.max(0, lt.yearly_quota - used),
      };
    });

    // Last payslip
    const payslips = db.get('payslips').filter((p) => p.employee_id === employeeId && p.status === 'paid');
    const lastPayslip = payslips[payslips.length - 1] || null;

    // Active announcements
    const announcements = db.get('announcements').slice(0, 5);

    return {
      today_status: todayAtt
        ? {
            checked_in: true,
            check_in_time: todayAtt.check_in,
            check_out_time: todayAtt.check_out || null,
            status: todayAtt.status,
            total_hours: todayAtt.total_hours || null,
          }
        : {
            checked_in: false,
            check_in_time: null,
            check_out_time: null,
            status: 'not_checked_in',
            total_hours: null,
          },
      weekly_hours: Math.round(weeklyHours * 10) / 10,
      weekly_target: 40,
      monthly_late_count: lateCount,
      leave_balances: leaveBalances,
      last_payslip: lastPayslip,
      announcements,
    };
  },
};
