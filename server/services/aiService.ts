import { randomUUID } from 'crypto';
import { db, AiLog, User } from '../db/database';
import { analyticsService } from './analyticsService';
import { employeeService } from './employeeService';
import { leaveService } from './leaveService';
import { payrollService } from './payrollService';

// ─── Gemini API Config ─────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// ─── Rate Limiter (25 req/hour per user) ──────────────────────────────────
const rateLimitMap = new Map<string, number[]>();

export function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const timestamps = (rateLimitMap.get(userId) || []).filter((t) => t > oneHourAgo);
  if (timestamps.length >= 25) return false;
  timestamps.push(now);
  rateLimitMap.set(userId, timestamps);
  return true;
}

// ─── Gemini API call ──────────────────────────────────────────────────────
async function callGemini(systemPrompt: string, userMessage: string): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;
  try {
    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\nUser: ${userMessage}` }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 512,
      },
    };

    const res = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error('[Gemini] API error:', res.status, await res.text());
      return null;
    }

    const data: any = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text || null;
  } catch (err) {
    console.error('[Gemini] fetch error:', err);
    return null;
  }
}

// ─── Build context-aware system prompt from live DB ───────────────────────
function buildSystemPrompt(user: User): string {
  const settings = db.get('settings');
  const employees = db.get('employees').filter((e) => e.status === 'active' || e.status === 'probation');
  const leaveTypes = db.get('leave_types');
  const today = new Date().toISOString().slice(0, 10);

  // Build user context
  let userContext = `You are an intelligent HCM (Human Capital Management) AI Assistant for ${settings?.company_name || 'this organization'}.
You are talking to: ${user.email} (Role: ${user.role.toUpperCase()}).
Today's date: ${today}.

ORGANIZATION DATA (live):
- Active employees: ${employees.length}
- Office start: ${settings?.office_start || '09:00'}, Grace: ${settings?.grace_minutes || 15} min
- Half-day threshold: ${settings?.half_day_hours || 5} hours
- Weekends: Saturday & Sunday
- Currency: ${settings?.currency || 'PKR'}
- Leave types: ${leaveTypes.map((lt) => `${lt.name} (${lt.yearly_quota === 999999 ? 'Unlimited' : lt.yearly_quota + ' days/year'})`).join(', ')}

STRICT RULES:
1. Employees CANNOT see other employees' salaries or personal data.
2. Payroll summaries are only for Admin and HR roles.
3. Always answer concisely with bullet points when listing data.
4. If asked something outside HCM scope, politely redirect to HCM topics.
5. Respond in the same language the user uses (Urdu or English).

CAPABILITIES:
- Attendance queries, leave balances, payroll info (role-gated)
- Company policy questions (office hours, tax slabs, leave rules)
- Employee lookup (name, department, designation)
- Analytics & KPI summaries (admin/hr only)
`;

  // Add role-specific live data
  if (user.role === 'employee' && user.employee_id) {
    const emp = employees.find((e) => e.id === user.employee_id);
    const myLeaves = db.get('leave_requests').filter(
      (l) => l.employee_id === user.employee_id && l.status === 'approved'
    );
    const myAtt = db.get('attendance').filter(
      (a) => a.employee_id === user.employee_id && a.date.startsWith(today.slice(0, 7))
    );
    const lateCount = myAtt.filter((a) => a.status === 'late').length;
    const balances = leaveService.getLeaveBalances(user.employee_id);

    userContext += `\nYOUR PROFILE:
- Name: ${emp ? `${emp.first_name} ${emp.last_name}` : 'N/A'}
- Employee Code: ${emp?.employee_code || 'N/A'}
- Department: ${db.get('departments').find((d) => d.id === emp?.department_id)?.name || 'N/A'}
- Late arrivals this month: ${lateCount}
- Leave balances: ${balances.map((b) => `${b.name}: ${b.is_unpaid ? 'Unlimited' : b.remaining + ' remaining'}`).join(', ')}
`;
  } else if (user.role === 'admin' || user.role === 'hr') {
    const hrMetrics = analyticsService.getHRMetrics();
    const todayLeave = db.get('leave_requests').filter(
      (l) => l.status === 'approved' && l.start_date <= today && l.end_date >= today
    );
    userContext += `\nLIVE HR METRICS:
- Present today: ${hrMetrics.present_today}
- Late today: ${hrMetrics.late_today}
- On leave today: ${todayLeave.length}
- Pending leave approvals: ${hrMetrics.pending_leave_count}
- Pending attendance corrections: ${hrMetrics.pending_correction_count}
- Monthly attendance rate: ${hrMetrics.attendance_rate}%
`;
  }

  return userContext;
}

export const aiService = {
  // Execute named tools (used by AI)
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
          on_leave_today: hrMetrics.on_leave_today,
          monthly_attendance_rate: `${hrMetrics.attendance_rate}%`,
        };
      }

      case 'get_late_comers': {
        const hrMetrics = analyticsService.getHRMetrics({ month: args?.month });
        return { top_late_comers: hrMetrics.top_5_late_comers };
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
        if (!user.employee_id) return { error: 'No employee profile linked to current account.' };
        const balances = leaveService.getLeaveBalances(user.employee_id);
        return { balances };
      }

      case 'get_payroll_summary': {
        if (user.role === 'employee') {
          return { error: 'ACCESS_DENIED: Employees cannot view general payroll summaries.' };
        }
        const runs = payrollService.getPayrollRuns();
        return { latest_run: runs[0] || null, total_runs: runs.length };
      }

      case 'search_employees': {
        const { data } = employeeService.getEmployees({ search: args?.query, limit: 10 });
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
        reply: 'You have reached the AI assistant rate limit (25 requests/hour). Please try again shortly.',
      };
    }

    const cleanPrompt = prompt.trim();
    const lower = cleanPrompt.toLowerCase();

    // ── SECURITY: Block salary inquiries about others by employees ────────
    if (user.role === 'employee') {
      const salaryKws = ['salary', 'pay', 'compensation', 'package', 'income', 'tankhwah', 'paisa'];
      const hasSalaryInquiry = salaryKws.some((w) => lower.includes(w));
      const isAboutOther = !lower.includes('my salary') && !lower.includes('meri salary') && !lower.includes('my payslip');
      if (hasSalaryInquiry && isAboutOther) {
        this.logAiCall(user, prompt, 'refuse_colleague_salary', 'Refused colleague salary inquiry');
        return {
          reply: 'I cannot disclose salary or personal compensation details of other colleagues. For privacy and compliance, employees can only review their own payroll records.',
        };
      }
    }

    // ── Try Gemini API first ──────────────────────────────────────────────
    if (GEMINI_API_KEY) {
      const systemPrompt = buildSystemPrompt(user);
      const geminiReply = await callGemini(systemPrompt, cleanPrompt);
      if (geminiReply) {
        this.logAiCall(user, prompt, 'gemini_api', 'Gemini AI response');
        return { reply: geminiReply, tool_called: 'gemini_api' };
      }
      console.warn('[AI] Gemini API call failed, falling back to rule-based engine.');
    }

    // ── Rule-based fallback ────────────────────────────────────────────────

    // Sick leave / leave balance
    if (
      lower.includes('sick leave') ||
      lower.includes('leave left') ||
      lower.includes('chuttiyan') ||
      lower.includes('leave balance') ||
      lower.includes('how many sick') ||
      lower.includes('kitni chutti')
    ) {
      if (user.role === 'employee' && user.employee_id) {
        const balances = leaveService.getLeaveBalances(user.employee_id);
        const sick = balances.find((b) => b.code === 'sick');
        const annual = balances.find((b) => b.code === 'annual');
        const casual = balances.find((b) => b.code === 'casual');
        this.logAiCall(user, prompt, 'get_my_leave_balance', 'Returned own leave balance');
        return {
          reply: `You currently have **${sick?.remaining ?? 0} sick leave(s)** remaining this year.\n\nOther balances:\n• Casual: **${casual?.remaining ?? 0}** days\n• Annual: **${annual?.remaining ?? 0}** days`,
          tool_called: 'get_my_leave_balance',
        };
      }
    }

    // Who is on leave today?
    if (lower.includes('who is on leave') || lower.includes('on leave today') || lower.includes('chutti par')) {
      const today = new Date().toISOString().slice(0, 10);
      const leaveRequests = db
        .get('leave_requests')
        .filter((l) => l.status === 'approved' && l.start_date <= today && l.end_date >= today);
      const employees = db.get('employees');
      const leaveTypes = db.get('leave_types');

      if (leaveRequests.length === 0) {
        return {
          reply: 'No employees are on approved leave today. All active personnel are expected to be present.',
          tool_called: 'get_leave_summary',
        };
      }

      const names = leaveRequests.map((l) => {
        const emp = employees.find((e) => e.id === l.employee_id);
        const lt = leaveTypes.find((t) => t.id === l.leave_type_id);
        return `• **${emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown'}** (${lt?.name || 'Leave'})`;
      });

      return {
        reply: `**${leaveRequests.length}** employee(s) on approved leave today:\n${names.join('\n')}`,
        tool_called: 'get_leave_summary',
      };
    }

    // Late comers
    if (lower.includes('late most') || lower.includes('top late') || lower.includes('late comers') || lower.includes('der se')) {
      const hrMetrics = analyticsService.getHRMetrics();
      const topLate = hrMetrics.top_5_late_comers;
      if (topLate.length === 0) {
        return {
          reply: 'No employees have recorded late check-ins this month.',
          tool_called: 'get_late_comers',
        };
      }
      const list = topLate.map((e, idx) => `${idx + 1}. **${e.name}** (${e.employee_code}) — ${e.late_count}x late`);
      return {
        reply: `Top late arrivals this month:\n\n${list.join('\n')}`,
        tool_called: 'get_late_comers',
      };
    }

    // Attendance rate
    if (lower.includes('attendance rate') || lower.includes('hazri rate') || lower.includes('how many present')) {
      const hrMetrics = analyticsService.getHRMetrics();
      return {
        reply: `Monthly attendance rate: **${hrMetrics.attendance_rate}%**\n\n• Present today: **${hrMetrics.present_today}**\n• Late today: **${hrMetrics.late_today}**\n• On leave today: **${hrMetrics.on_leave_today}**`,
        tool_called: 'get_attendance_summary',
      };
    }

    // Headcount
    if (lower.includes('how many') && (lower.includes('employee') || lower.includes('headcount') || lower.includes('staff'))) {
      const metrics = analyticsService.getAdminMetrics();
      const deptDetails = metrics.headcount_by_department
        .map((d) => `• **${d.name}**: ${d.headcount}`)
        .join('\n');
      return {
        reply: `Total active headcount: **${metrics.headcount}** employees.\n\nBy department:\n${deptDetails || '(No departments configured)'}`,
        tool_called: 'get_headcount',
      };
    }

    // Office policy
    if (lower.includes('office tim') || lower.includes('grace period') || lower.includes('working hours') || lower.includes('office start')) {
      const settings = db.get('settings');
      return {
        reply: `**Company Working Hours Policy:**\n• Office Start: **${settings?.office_start || '09:00'}**\n• Grace Period: **${settings?.grace_minutes || 15} minutes**\n• Half-day if under: **${settings?.half_day_hours || 5} hours**\n• Weekends: Saturday & Sunday`,
      };
    }

    // Tax
    if (lower.includes('tax') && (lower.includes('slab') || lower.includes('policy') || lower.includes('deduction'))) {
      return {
        reply: `**Pakistan Annual Income Tax Slabs:**\n• Up to PKR 600,000: **0%**\n• PKR 600k–1.2M: **5%** of excess\n• PKR 1.2M–2.4M: **PKR 30k + 15%** of excess\n• PKR 2.4M–3.6M: **PKR 210k + 25%** of excess\n• Above PKR 3.6M: **PKR 510k + 35%** of excess\n\nMonthly deduction = Annual Tax ÷ 12`,
      };
    }

    // Default guidance
    this.logAiCall(user, prompt, 'general_qna', 'Shown guidance menu');
    return {
      reply: `I'm your **HCM Lite AI Assistant**. I can answer questions like:\n\n• "Who is on leave today?"\n• "Who came late most often this month?"\n• "What is the attendance rate this month?"\n• "How many sick leaves do I have left?"\n• "What are the company office hours?"\n• "Show me the tax slabs"\n• "How many active employees are there?"`,
    };
  },

  // Smart Leave Parser (NLP → structured leave data)
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

    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    if (lower.includes('tomorrow') || lower.includes('kal')) {
      startDate.setDate(now.getDate() + 1);
      endDate.setDate(now.getDate() + 1);
    } else if (lower.includes('next monday')) {
      const daysUntilMonday = (1 + 7 - now.getDay()) % 7 || 7;
      startDate.setDate(now.getDate() + daysUntilMonday);
      endDate = new Date(startDate);
      if (lower.includes('tuesday') || lower.includes('two days') || lower.includes('2 days')) {
        endDate.setDate(startDate.getDate() + 1);
      }
    } else {
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

  // Dashboard KPI Summarizer
  generateDashboardSummary(kpis: any): string[] {
    const bullets: string[] = [];

    if (kpis.headcount !== undefined) {
      bullets.push(`Active organization headcount: **${kpis.headcount}** employees.`);
    }
    if (kpis.present_today !== undefined) {
      const rate = kpis.headcount > 0 ? Math.round((kpis.present_today / kpis.headcount) * 100) : 0;
      bullets.push(`**${kpis.present_today}** present today (${rate}% turnout). **${kpis.late_today || 0}** late.`);
    }
    if (kpis.on_leave_today !== undefined && kpis.on_leave_today > 0) {
      bullets.push(`**${kpis.on_leave_today}** employee(s) on approved leave today.`);
    }
    if (kpis.pending_approvals !== undefined && kpis.pending_approvals > 0) {
      bullets.push(`**${kpis.pending_approvals}** pending approvals require HR attention.`);
    }
    if (kpis.monthly_payroll_cost !== undefined) {
      bullets.push(`Monthly gross payroll: **PKR ${kpis.monthly_payroll_cost.toLocaleString()}** (avg **PKR ${kpis.avg_salary?.toLocaleString() || 0}**).`);
    }
    if (kpis.attendance_rate !== undefined) {
      bullets.push(`Monthly attendance consistency index: **${kpis.attendance_rate}%**.`);
    }

    return bullets.length > 0
      ? bullets
      : ['Organization ready. Add employees and record check-ins to activate live metrics.'];
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
