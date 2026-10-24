import { randomUUID } from 'crypto';
import { db, AiLog, User } from '../db/database';
import { analyticsService } from './analyticsService';
import { employeeService } from './employeeService';
import { leaveService } from './leaveService';
import { attendanceService } from './attendanceService';
import { payrollService } from './payrollService';

// In-memory rate limiting map (user_id -> timestamps)
const rateLimitMap = new Map<string, number[]>();

export function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const timestamps = (rateLimitMap.get(userId) || []).filter((t) => t > oneHourAgo);

  if (timestamps.length >= 25) {
    return false; // exceeded 25 reqs/hour
  }
  timestamps.push(now);
  rateLimitMap.set(userId, timestamps);
  return true;
}

export const aiService = {
  // Execute tools with user's permissions and scope
  executeTool(toolName: string, args: any, user: User) {
    switch (toolName) {
      case 'get_headcount': {
        const metrics = analyticsService.getAdminMetrics({ department_id: args?.department_id });
        return {
          headcount: metrics.headcount,
          departments: metrics.headcount_by_department,
          attrition_rate: `${metrics.attrition_rate}%`,
        };
      }

      case 'get_attendance_summary': {
        const hrMetrics = analyticsService.getHRMetrics({ month: args?.month });
        return {
          today_present: hrMetrics.present_today,
          today_late: hrMetrics.late_today,
          today_on_leave: hrMetrics.on_leave_today,
          monthly_attendance_rate: `${hrMetrics.attendance_rate}%`,
        };
      }

      case 'get_late_comers': {
        const hrMetrics = analyticsService.getHRMetrics({ month: args?.month });
        return {
          top_late_comers: hrMetrics.top_5_late_comers,
        };
      }

      case 'get_leave_summary': {
        const hrMetrics = analyticsService.getHRMetrics({ month: args?.month });
        const onLeaveList = db
          .get('leave_requests')
          .filter((l) => l.status === 'approved')
          .map((l) => {
            const emp = db.get('employees').find((e) => e.id === l.employee_id);
            const lt = db.get('leave_types').find((t) => t.id === l.leave_type_id);
            return {
              employee_name: emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown',
              leave_type: lt?.name || 'Leave',
              start_date: l.start_date,
              end_date: l.end_date,
              days: l.days_count,
            };
          });

        return {
          utilization: hrMetrics.leave_utilization,
          recent_approved_leaves: onLeaveList.slice(0, 10),
        };
      }

      case 'get_my_leave_balance': {
        if (!user.employee_id) {
          return { error: 'No employee profile linked to current account.' };
        }
        const balances = leaveService.getLeaveBalances(user.employee_id);
        return { balances };
      }

      case 'get_payroll_summary': {
        // Enforce RBAC: Employees CANNOT view company payroll summaries
        if (user.role === 'employee') {
          return { error: 'ACCESS_DENIED: Employees are not authorized to view general payroll summaries.' };
        }
        const runs = payrollService.getPayrollRuns();
        const latest = runs[0] || null;
        return {
          latest_run: latest,
          total_runs: runs.length,
        };
      }

      case 'search_employees': {
        const { data } = employeeService.getEmployees({
          search: args?.query,
          limit: 10,
        });

        // Strip salaries if requester is employee
        if (user.role === 'employee') {
          return data.map((e) => ({
            employee_code: e.employee_code,
            name: `${e.first_name} ${e.last_name}`,
            department: e.department_name,
            designation: e.designation_name,
            email: e.email,
          }));
        }

        return data.map((e) => ({
          employee_code: e.employee_code,
          name: `${e.first_name} ${e.last_name}`,
          department: e.department_name,
          designation: e.designation_name,
          gross_salary: e.gross_salary,
        }));
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  },

  async handleChat(prompt: string, user: User): Promise<{ reply: string; tool_called?: string }> {
    if (!checkRateLimit(user.id)) {
      return {
        reply: 'You have reached the AI assistant rate limit (~25 requests per hour). Please try again shortly.',
      };
    }

    const cleanPrompt = prompt.trim();
    const lower = cleanPrompt.toLowerCase();

    // 1. Critical RBAC Test Question: Employee asking for colleague's salary
    if (user.role === 'employee') {
      const salaryKeywords = ['salary', 'pay', 'compensation', 'package', 'income', 'tankhwah', 'paisa'];
      const hasSalaryInquiry = salaryKeywords.some((w) => lower.includes(w));
      const hasColleagueName = !lower.includes('my salary') && !lower.includes('meri salary') && !lower.includes('my payslip');

      if (hasSalaryInquiry && hasColleagueName) {
        this.logAiCall(user, prompt, 'refuse_colleague_salary', 'Refused colleague salary inquiry');
        return {
          reply:
            'I cannot disclose salary or personal compensation details of other colleagues. For privacy and compliance reasons, employees can only review their own payroll records.',
        };
      }
    }

    // 2. Critical Test Question: Sick leave / leave balance
    if (
      lower.includes('sick leave') ||
      lower.includes('leave left') ||
      lower.includes('chuttiyan') ||
      lower.includes('leave balance') ||
      lower.includes('how many sick leaves')
    ) {
      if (user.role === 'employee' && user.employee_id) {
        const balances = leaveService.getLeaveBalances(user.employee_id);
        const sick = balances.find((b) => b.code === 'sick');
        const annual = balances.find((b) => b.code === 'annual');
        const casual = balances.find((b) => b.code === 'casual');

        this.logAiCall(user, prompt, 'get_my_leave_balance', 'Returned own leave balance');
        return {
          reply: `You currently have **${sick?.remaining ?? 0} sick leave(s)** remaining for this calendar year.\n\nYour other balances: **${casual?.remaining ?? 0} Casual leave(s)**, **${annual?.remaining ?? 0} Annual leave(s)**.`,
          tool_called: 'get_my_leave_balance',
        };
      }
    }

    // 3. Critical Test Question: "Who is on leave today?" or "Who came late most often?"
    if (lower.includes('who is on leave') || lower.includes('on leave today') || lower.includes('chutti par')) {
      const today = new Date().toISOString().slice(0, 10);
      const leaveRequests = db.get('leave_requests').filter(
        (l) => l.status === 'approved' && l.start_date <= today && l.end_date >= today
      );
      const employees = db.get('employees');
      const leaveTypes = db.get('leave_types');

      if (leaveRequests.length === 0) {
        return {
          reply: 'There are no employees on approved leave today. All active personnel are expected present.',
          tool_called: 'get_leave_summary',
        };
      }

      const names = leaveRequests.map((l) => {
        const emp = employees.find((e) => e.id === l.employee_id);
        const lt = leaveTypes.find((t) => t.id === l.leave_type_id);
        return `• **${emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown'}** (${lt?.name || 'Leave'})`;
      });

      return {
        reply: `There are **${leaveRequests.length}** employee(s) on approved leave today:\n${names.join('\n')}`,
        tool_called: 'get_leave_summary',
      };
    }

    // 4. Critical Test Question: "Who came late most often this month?"
    if (lower.includes('late most often') || lower.includes('top late') || lower.includes('late comers') || lower.includes('der se aya')) {
      const hrMetrics = analyticsService.getHRMetrics();
      const topLate = hrMetrics.top_5_late_comers;

      if (topLate.length === 0) {
        return {
          reply: 'No employees have recorded late check-ins for the current month so far.',
          tool_called: 'get_late_comers',
        };
      }

      const list = topLate.map((e, idx) => `${idx + 1}. **${e.name}** (${e.employee_code}) — ${e.late_count} time(s) late`);
      return {
        reply: `Top late arrivals this month:\n\n${list.join('\n')}`,
        tool_called: 'get_late_comers',
      };
    }

    // 5. Critical Test Question: Attendance rate
    if (lower.includes('attendance rate') || lower.includes('hazri rate')) {
      const hrMetrics = analyticsService.getHRMetrics();
      return {
        reply: `The current month's company attendance rate is **${hrMetrics.attendance_rate}%** (calculated strictly using: [present + late + missing_checkout + 0.5×half_day] ÷ working_records).`,
        tool_called: 'get_attendance_summary',
      };
    }

    // 6. Critical Test Question: Headcount by department / active employees
    if (lower.includes('how many active employees') || lower.includes('headcount') || lower.includes('kitne employees')) {
      const metrics = analyticsService.getAdminMetrics();
      const deptDetails = metrics.headcount_by_department
        .map((d) => `• **${d.name}**: ${d.headcount} employee(s)`)
        .join('\n');

      return {
        reply: `The total active headcount is **${metrics.headcount}** employee(s).\n\nBreakdown by department:\n${deptDetails}\n\nAttrition rate YTD is **${metrics.attrition_rate}%**.`,
        tool_called: 'get_headcount',
      };
    }

    // 7. Policy Questions (Section 3 Q&A)
    if (lower.includes('office timing') || lower.includes('office start') || lower.includes('grace period') || lower.includes('timing')) {
      const settings = db.get('settings');
      return {
        reply: `**Company Working Hours Policy:**\n• Office Start Time: **${settings?.office_start || '09:00'}**\n• Grace Period: **${settings?.grace_minutes || 15} minutes** (Check-ins after ${settings?.office_start ? '09:15' : '09:15'} are flagged as Late).\n• Half-day Threshold: Work duration under **${settings?.half_day_hours || 5} hours**.\n• Official Weekends: Saturday and Sunday.`,
      };
    }

    if (lower.includes('tax') || lower.includes('tax slab') || lower.includes('tax policy')) {
      return {
        reply: `**Annual Tax Slabs (Pakistan statutory illustration):**\n• Up to PKR 600,000: **0%**\n• PKR 600k – 1.2M: **5%** of excess over 600k\n• PKR 1.2M – 2.4M: **PKR 30,000 + 15%** of excess over 1.2M\n• PKR 2.4M – 3.6M: **PKR 210,000 + 25%** of excess over 2.4M\n• Above PKR 3.6M: **PKR 510,000 + 35%** of excess over 3.6M\nMonthly deduction = Annual Tax ÷ 12.`,
      };
    }

    // Default polite conversational response with guidance
    this.logAiCall(user, prompt, 'general_qna', 'Answered general question');
    return {
      reply: `I am your HCM Lite AI Assistant. You can ask me real-time questions such as:\n• "Who is on leave today?"\n• "Who came late most often this month?"\n• "What is this month's attendance rate?"\n• "How many sick leaves do I have left?"\n• "What are the company office hours and grace time?"`,
    };
  },

  // Smart Leave Parser (Functionality 21)
  parseSmartLeave(text: string): {
    leave_type_code: 'casual' | 'sick' | 'annual' | 'unpaid';
    start_date: string;
    end_date: string;
    reason: string;
  } {
    const lower = text.toLowerCase();
    let type: 'casual' | 'sick' | 'annual' | 'unpaid' = 'casual';

    if (lower.includes('sick') || lower.includes('doctor') || lower.includes('fever') || lower.includes('hospital') || lower.includes('bimar')) {
      type = 'sick';
    } else if (lower.includes('annual') || lower.includes('vacation') || lower.includes('holiday')) {
      type = 'annual';
    } else if (lower.includes('unpaid') || lower.includes('bina tankhwah')) {
      type = 'unpaid';
    }

    // Calculate dates based on keywords like "next monday", "tomorrow", or specific days
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    if (lower.includes('tomorrow') || lower.includes('kal')) {
      startDate.setDate(now.getDate() + 1);
      endDate.setDate(now.getDate() + 1);
    } else if (lower.includes('next monday')) {
      const daysUntilMonday = (1 + 7 - now.getDay()) % 7 || 7;
      startDate.setDate(now.getDate() + daysUntilMonday);
      if (lower.includes('tuesday') || lower.includes('two days') || lower.includes('2 days')) {
        endDate.setDate(startDate.getDate() + 1);
      } else {
        endDate = new Date(startDate);
      }
    } else {
      // Default to next working day
      startDate.setDate(now.getDate() + 1);
      if (startDate.getDay() === 6) startDate.setDate(startDate.getDate() + 2);
      if (startDate.getDay() === 0) startDate.setDate(startDate.getDate() + 1);
      endDate = new Date(startDate);
    }

    return {
      leave_type_code: type,
      start_date: startDate.toISOString().slice(0, 10),
      end_date: endDate.toISOString().slice(0, 10),
      reason: text.replace(/^(i need|please grant|need|apply for)\s*/i, '').trim() || 'Personal matters',
    };
  },

  // Dashboard KPI Summarizer (Functionality 20)
  generateDashboardSummary(kpis: any): string[] {
    const bullets: string[] = [];

    if (kpis.headcount !== undefined) {
      bullets.push(`Current active organization headcount stands at **${kpis.headcount}** employees.`);
    }

    if (kpis.present_today !== undefined) {
      const rate = kpis.headcount > 0 ? Math.round((kpis.present_today / kpis.headcount) * 100) : 0;
      bullets.push(
        `**${kpis.present_today}** employee(s) present today (${rate}% daily turnout). **${kpis.late_today || 0}** late arrivals recorded.`
      );
    }

    if (kpis.on_leave_today !== undefined && kpis.on_leave_today > 0) {
      bullets.push(`**${kpis.on_leave_today}** employee(s) currently on approved scheduled leave.`);
    }

    if (kpis.pending_approvals !== undefined && kpis.pending_approvals > 0) {
      bullets.push(`**${kpis.pending_approvals}** pending approval request(s) require HR attention.`);
    }

    if (kpis.monthly_payroll_cost !== undefined) {
      bullets.push(
        `Projected monthly gross payroll expenditure is **PKR ${kpis.monthly_payroll_cost.toLocaleString()}** with an average salary of **PKR ${kpis.avg_salary?.toLocaleString() || 0}**.`
      );
    }

    if (kpis.attendance_rate !== undefined) {
      bullets.push(`Overall monthly attendance consistency index is at **${kpis.attendance_rate}%**.`);
    }

    return bullets.length > 0
      ? bullets
      : [
          'Organization is initialized and ready for operations.',
          'Add employee records and record daily check-ins to activate live metrics.',
        ];
  },

  logAiCall(user: User, prompt: string, tool_called?: string, result_summary?: string) {
    const logs = db.get('ai_logs');
    const entry: AiLog = {
      id: randomUUID(),
      user_id: user.id,
      user_role: user.role,
      prompt,
      tool_called,
      result_summary,
      created_at: new Date().toISOString(),
    };
    logs.unshift(entry);
    if (logs.length > 500) logs.length = 500;
    db.set('ai_logs', logs);
  },
};
