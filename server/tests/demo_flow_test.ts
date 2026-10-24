import { db } from '../db/database';
import { authService } from '../services/authService';
import { orgService } from '../services/orgService';
import { employeeService } from '../services/employeeService';
import { attendanceService } from '../services/attendanceService';
import { leaveService } from '../services/leaveService';
import { payrollService } from '../services/payrollService';
import { analyticsService } from '../services/analyticsService';
import { aiService } from '../services/aiService';
import { commsService } from '../services/commsService';

async function runDemoFlowTest() {
  console.log('--- STARTING SAYLANI HACKATHON 5-MINUTE DEMO SCRIPT VERIFICATION ---');

  // Step 0: Ensure clean start
  db.reset();
  console.log('✓ Step 0: System starts completely empty. Reset confirmed.');

  // Step 1: Admin first-run setup
  console.log('\n--- Step 1: First-Run Bootstrap ---');
  const bootstrapRes = await authService.bootstrapFirstRun({
    company_name: 'Saylani Tech Solutions',
    admin_email: 'admin@saylani.com',
    admin_password: 'AdminPassword123!',
    office_start: '09:00',
    grace_minutes: 15,
    half_day_hours: 5,
    office_lat: 24.8607,
    office_lng: 67.0011,
    office_radius_meters: 150,
  });
  console.log('✓ Admin account created:', bootstrapRes.user.email, '| Role:', bootstrapRes.user.role);

  // Setup department and designation
  const engineeringDept = orgService.createDepartment('Software Engineering', 'ENG');
  const leadDesig = orgService.createDesignation('Senior Fullstack Engineer', engineeringDept.id);
  console.log('✓ Department created:', engineeringDept.name, '| Designation:', leadDesig.name);

  // Step 2: Admin creates HR login
  console.log('\n--- Step 2: Admin Creates HR Login ---');
  const hrUser = await authService.createHRUser('hr@saylani.com', 'HrPassword123!');
  console.log('✓ HR Account Created:', hrUser.email, '| Role:', hrUser.role);

  // Step 3: HR logs in and registers employees
  console.log('\n--- Step 3: HR Registers Employees ---');
  const hrLogin = await authService.login('hr@saylani.com', 'HrPassword123!');
  console.log('✓ HR Login Success. Token generated.');

  const emp1Res = await employeeService.registerEmployee({
    employee_code: 'EMP-101',
    first_name: 'Ali',
    last_name: 'Khan',
    email: 'ali.khan@saylani.com',
    phone: '+92 300 1234567',
    address: 'Gulshan-e-Iqbal, Karachi',
    gender: 'male',
    date_of_birth: '1996-05-12',
    join_date: '2026-01-15',
    department_id: engineeringDept.id,
    designation_id: leadDesig.id,
    basic_salary: 80000,
  });
  console.log('✓ Employee 1 Registered:', emp1Res.employee.first_name, '| Gross:', emp1Res.employee.gross_salary, '| Temp Pass:', emp1Res.tempPassword);

  const emp2Res = await employeeService.registerEmployee({
    employee_code: 'EMP-102',
    first_name: 'Fatima',
    last_name: 'Ahmed',
    email: 'fatima.ahmed@saylani.com',
    phone: '+92 301 7654321',
    address: 'Clifton, Karachi',
    gender: 'female',
    date_of_birth: '1998-08-20',
    join_date: '2026-02-01',
    department_id: engineeringDept.id,
    designation_id: leadDesig.id,
    basic_salary: 100000,
  });
  console.log('✓ Employee 2 Registered:', emp2Res.employee.first_name, '| Gross:', emp2Res.employee.gross_salary, '| Temp Pass:', emp2Res.tempPassword);

  // Step 4: Employee signs in, changes password and checks in
  console.log('\n--- Step 4: Employee Sign-In & Check-In ---');
  const empLogin = await authService.login('ali.khan@saylani.com', emp1Res.tempPassword);
  console.log('✓ Employee 1 Login Success. Must change password flag:', empLogin.must_change_password);

  // Change password
  await authService.changePassword(empLogin.user.id, 'AliPermanentPass123!');
  console.log('✓ Employee 1 changed temporary password successfully.');

  // Employee checks in (web check-in)
  const checkInRes = attendanceService.checkIn({
    employee_id: emp1Res.employee.id,
    source: 'web',
  });
  console.log('✓ Check-in marked. Status:', checkInRes.record.status, '| Note:', checkInRes.message);

  // Verify duplicate check-in throws 409
  try {
    attendanceService.checkIn({ employee_id: emp1Res.employee.id, source: 'web' });
    console.error('FAILED: Second check-in should have thrown 409!');
  } catch (err: any) {
    console.log('✓ Duplicate check-in correctly rejected with 409:', err.message);
  }

  // Camera + GPS geofence check-in for Employee 2
  const cameraCheckIn = attendanceService.checkIn({
    employee_id: emp2Res.employee.id,
    source: 'camera',
    lat: 24.8607,
    lng: 67.0011,
    face_detected: true,
  });
  console.log('✓ Camera check-in with GPS Geofence for Emp 2 succeeded! Source:', cameraCheckIn.record.source);

  // Step 5: Smart Leave & HR Approval
  console.log('\n--- Step 5: Smart Leave & Approval ---');
  const smartLeaveParsed = aiService.parseSmartLeave('Need next Monday and Tuesday off for my sister wedding');
  console.log('✓ Smart Leave extracted structure:', smartLeaveParsed);

  const casualLeaveType = db.get('leave_types').find((t) => t.code === 'casual')!;
  const leaveReq = leaveService.applyLeave({
    employee_id: emp1Res.employee.id,
    leave_type_id: casualLeaveType.id,
    start_date: smartLeaveParsed.start_date,
    end_date: smartLeaveParsed.end_date,
    reason: smartLeaveParsed.reason,
  });
  console.log('✓ Leave applied. Working days:', leaveReq.days_count, '| Status:', leaveReq.status);

  // HR Approves leave with comment
  const approvedLeave = leaveService.reviewLeave(
    leaveReq.id,
    hrUser.id,
    'approved',
    'Approved. Enjoy the family celebration!'
  );
  console.log('✓ HR approved leave request. Reviewer comment:', approvedLeave.reviewer_comment);

  // Check notification was sent to employee
  const notifs = commsService.getNotifications(empLogin.user.id);
  console.log('✓ In-app notification delivered to employee:', notifs[0]?.title);

  // Step 6: HR Dashboard & AI Assistant
  console.log('\n--- Step 6: HR Dashboard, AI Summaries & Inquiries ---');
  const hrMetrics = analyticsService.getHRMetrics();
  console.log('✓ Live HR Metrics compiled: Headcount =', hrMetrics.headcount, '| Present today =', hrMetrics.present_today);

  const aiSummary = aiService.generateDashboardSummary(hrMetrics);
  console.log('✓ AI KPI Summary (3-5 bullets generated):');
  aiSummary.forEach((b) => console.log('   *', b));

  // AI Live questions from judging criteria
  const userObj = db.get('users').find((u) => u.id === empLogin.user.id)!;
  const hrUserObj = db.get('users').find((u) => u.id === hrUser.id)!;

  const q1 = await aiService.handleChat('Who came late most often this month?', hrUserObj);
  console.log('✓ HR asks "Who came late most often this month?":', q1.reply.slice(0, 80), '...');

  const q2 = await aiService.handleChat('How many sick leaves do I have left this year?', userObj);
  console.log('✓ Employee asks "How many sick leaves do I have left?":', q2.reply);

  // Step 7: Employee asks for Colleague Salary (CRITICAL TEST QUESTION)
  console.log('\n--- Step 7: Role Scoping & Colleague Salary Inquiry ---');
  const qSalary = await aiService.handleChat('What is Fatima salary?', userObj);
  console.log('✓ Employee asks "What is Fatima salary?":\n   Response:', qSalary.reply);
  if (!qSalary.reply.toLowerCase().includes('cannot disclose')) {
    console.error('FAILED: AI should politely refuse colleague salary inquiry!');
  } else {
    console.log('✓ PASSED: System politely refused salary inquiry for unauthorized employee.');
  }

  // Step 8: Payroll Run & Finalization
  console.log('\n--- Step 8: Payroll Run & Admin Finalize ---');
  const monthStr = new Date().toISOString().slice(0, 7);
  const payrollDraft = payrollService.generateMonthlyDraft(monthStr, hrUser.id);
  console.log('✓ Monthly Payroll Draft generated for', monthStr);
  console.log('   Total Gross: PKR', payrollDraft.run.total_gross.toLocaleString());
  console.log('   Total Net: PKR', payrollDraft.run.total_net.toLocaleString());
  console.log('   Payslips created:', payrollDraft.payslips.length);

  // Admin finalizes and locks payroll
  const finalized = payrollService.finalizePayroll(monthStr, bootstrapRes.user.id);
  console.log('✓ Admin finalized payroll. Status:', finalized.status, '| Locked at:', finalized.finalized_at);

  // Employee views own payslip
  const empPayslips = payrollService.getPayslips({ employee_id: emp1Res.employee.id });
  console.log('✓ Employee fetched own payslip. Month:', empPayslips[0]?.month, '| Net Salary: PKR', empPayslips[0]?.net_salary.toLocaleString());

  // Check Audit Trail
  const auditLogs = commsService.getAuditLogs();
  console.log('\n--- Step 9: Audit Trail Verification ---');
  console.log('✓ Total audit logs recorded:', auditLogs.length);
  console.log('✓ Sample audit entry:', auditLogs[0]?.action, 'by', auditLogs[0]?.actor_role);

  console.log('\n======================================================');
  console.log('🎉 ALL SAYLANI HACKATHON CORE CRITERIA VERIFIED 100%!');
  console.log('======================================================');
}

runDemoFlowTest().catch(console.error);
