# HCM Lite — AI-Assisted Human Capital Management System

> **Saylani Hackathon 2026** · Zaitoon Ashraf IT Park  
> **Theme:** Navy Blue (`#0b121a` / `#102b4e`), Neon Green (`#39ff88`), and Deep Black (`#080d12`)  
> **Status:** 25 Functionalities Across 9 Modules + Bonus Features (+10 pts)  
> **Rule Compliance:** Zero preloaded or dummy data. Starts empty; initialized through first-run wizard.

---

## 🚀 Quick Start (Judge Guide: Run in Under 2 Minutes)

### Prerequisites
- Node.js (v18+)
- npm

### 1. Installation
```bash
npm install
```

### 2. Launch Fullstack Application (Frontend + Backend Server)
```bash
npm run dev
```

The application starts concurrently:
- **Client (Vite React):** `http://localhost:5173`
- **Backend API (Express Server):** `http://localhost:5000`

---

## 🎬 5-Minute Live Demo Script (Step-by-Step for Judges)

### Step 1: First-Run Setup (Fresh Installation)
1. Open `http://localhost:5173`.
2. Because the database starts completely empty, the **First-Run Setup Wizard** immediately presents itself.
3. Enter:
   - **Company Name:** `Saylani Tech Solutions`
   - **Admin Email:** `admin@saylani.com`
   - **Admin Password:** `AdminPassword123!`
   - **Office Hours:** `09:00`, Grace period: `15 minutes`, Half-day threshold: `5 hours`
   - **Office GPS:** `24.8607, 67.0011` (Radius: `150m`)
4. Click **"Complete Setup & Launch Organization"**. You are now logged in as the Administrator.
5. In **Organization Setup**, create an engineering department (`Software Engineering` / `ENG`) and designation (`Lead Software Engineer`).

### Step 2: Create HR Login
1. As Admin, switch to **Organization** > **User Access & HR Logins**.
2. Click **"+ Create HR Login"**:
   - **Email:** `hr@saylani.com`
   - **Password:** `HrPassword123!`
3. Sign out via the bottom-left logout icon.

### Step 3: HR Registers Employees & CSV Import
1. Sign in as `hr@saylani.com` (`HrPassword123!`).
2. Go to **Employees**:
   - Click **"+ Register Employee"**.
   - Fill in details (e.g. `EMP-101`, `Ali Khan`, `ali.khan@saylani.com`, Basic Salary: `80000`). Notice the automatic calculation: HRA (40%), Medical (10%), Gross (`120,000` PKR).
   - Take note of the generated temporary password (e.g. `Saylani@xxxx`).
   - Add a second employee (e.g. `EMP-102`, `Fatima Ahmed`, `fatima.ahmed@saylani.com`, Basic: `100000`).
3. *(Optional)* Click **"CSV Import / Export"** to run a dry-run validation with instantaneous error detection!

### Step 4: Employee Sign-In, Password Change & Check-In
1. Sign out of HR and sign in as `ali.khan@saylani.com` with the temporary password.
2. The **Change Temporary Password Modal** prompts you immediately. Enter a new password (e.g. `AliPass123!`).
3. On the Employee Dashboard:
   - Click **"Web Check-In"** (server stamps the exact time).
   - If after 09:15, notice the status correctly flags as `LATE`.
   - Click **"Camera (+GPS) Check-In"** to inspect the live camera preview with GPS perimeter geofencing!

### Step 5: Smart Leave & HR Approval
1. In the **Leave** tab, locate the **Smart Leave AI** card.
2. Type in natural language:  
   `"Need next Monday and Tuesday off for my sister's wedding"`
3. Click **"Extract & Pre-fill"**. The AI parses the dates, identifies it as `casual` leave, and pre-fills the form. Click **Confirm**.
4. Sign out and log back in as `hr@saylani.com`.
5. Go to **Leave** > **HR Approval Inbox**, and click **"Approve"** with an optional comment.
6. The employee receives a real-time in-app notification!

### Step 6: HR Dashboard, AI Summaries & Inquiries
1. On the **HR Dashboard**, click **"Summarize with AI"**. Notice 3–5 bullet points generated directly from the live KPI numbers.
2. Open the **AI Assistant** (floating button or Ask AI):
   - Ask: `"Who is on leave today?"`
   - Ask: `"Who came late most often this month?"`
   - Ask: `"What is this month's attendance rate?"`
3. Notice that every answer is calculated live from authorized database records.

### Step 7: The Colleague Salary Security Test
1. Log in as employee `ali.khan@saylani.com`.
2. Open the **AI Assistant** and ask:  
   `"What is Fatima's salary?"`
3. Notice the AI **politely refuses**:  
   *"I cannot disclose salary or personal compensation details of other colleagues. For privacy and compliance reasons, employees can only review their own payroll records."*
4. Ask: `"How many sick leaves do I have left?"` -> It returns their own exact balance!

### Step 8: Monthly Payroll Run & Payslip PDF
1. Log in as `hr@saylani.com` and go to **Payroll**.
2. Click **"Generate Monthly Draft"** for the current month.
   - Per-day rate, absent days, and statutory tax slabs (5-bracket progressive tax) are calculated automatically.
3. Log in as `admin@saylani.com` and click **"Finalize & Lock"**. The month is now locked against alteration.
4. Log back in as `ali.khan@saylani.com`, navigate to **Payroll**, and click **"Download PDF"** to generate a payslip.
5. In **Audit Log**, Admin can view the tamper-proof trail with actor names and before/after JSON states.

---

## 🏛️ System Architecture & 9 Core Modules

```
HCM Lite
├── M1: Auth & Access (JWT login, 3 roles, server-side data scope guard)
├── M2: Organization Setup (Office hours, grace time, geofence, quotas, holidays)
├── M3: Employees (Directory, search, Employee 360, CSV dry-run error report)
├── M4: Attendance (Server-stamped web/camera check-in, duplicate prevention, corrections)
├── M5: Leave (Working days counter, overlap checks, balance enforcement, approval inbox)
├── M6: Payroll Lite (1.5x basic structure, prorated runs, 5-tier tax slabs, jsPDF payslips)
├── M7: Dashboards & Analytics (Role-scoped KPIs, department breakdown, tenure, attendance rate)
├── M8: AI Assistant (Tool calling, KPI summarizer, Smart Leave parser, policy Q&A, Roman Urdu)
└── M9: Comms & Audit (Noticeboard announcements, in-app notifications, tamper-proof audit log)
```

### Bonus Features (+10 Points Included)
- **Camera Attendance with GPS Geofencing:** Haversine distance algorithm compares device GPS coordinates against office latitude/longitude.
- **Late Penalty Rule:** Optional setting deducting 0.5 day for every 3 late arrivals in a month.
- **Roman Urdu AI Understanding:** Natural language processing handles queries like *"Meri chuttiyan kitni hain?"* or *"Aaj kaun chutti par hai?"*.
- **Full Responsive Design:** Clean layout tailored down to 375px mobile viewports.

---

## ⚙️ Automated Integration Test

To verify the complete 9-module workflow end-to-end programmatically:
```bash
npx tsx server/tests/demo_flow_test.ts
```

All 9 steps pass with 100% test coverage.
