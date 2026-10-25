# HCM Lite — AI-Assisted Human Capital Management System

> **Saylani Hackathon 2026** · Zaitoon Ashraf IT Park  
> **Color Palette:** Navy Blue (`#0b121a` / `#102b4e`), Neon Green (`#39ff88`), and Deep Slate (`#080d12`)  
> **Scope:** 25 Required Functionalities Across 9 Core Modules + 4 Evaluated Bonus Features (+10 pts)  
> **Rule Compliance:** Zero pre-seeded / mock data. System starts 100% empty; initialized cleanly via the First-Run Bootstrap Wizard.

---

## 📌 Executive Overview

**HCM Lite** is a high-performance, production-ready Human Capital Management web application engineered for modern enterprises. It combines strict server-side **Role-Based Access Control (RBAC)** across three distinct portals (**Admin**, **HR**, and **Employee**) with automated compliance calculations and deep **Google Gemini AI** integrations.

### Key Highlights
- **Zero Dummy Data Guarantee:** Follows the hackathon's strictest compliance rule — starts completely empty and provisions through an interactive setup wizard.
- **Enterprise RBAC Boundaries:** Admin, HR, and Employee roles with automated landing view redirection and server-side route guards.
- **Google Gemini AI Assistant:** Tool-calling enabled chat, natural language Smart Leave parser, executive KPI summarizer, company policy Q&A, and Roman Urdu understanding.
- **Privacy & Security Enforcement:** Built-in safeguards that politely refuse unauthorized data queries (such as cross-colleague salary inquiries) while allowing authorized self-service.
- **Automated Payroll & Geofenced Attendance:** Progressive 5-tier tax calculations, downloadable jsPDF payslips, and GPS Haversine perimeter verification.

---

## 🚀 Quick Start Guide (Run in Under 2 Minutes)

### Prerequisites
- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone <repository-url>
cd hcm-lite
npm install
```

### 2. Environment Configuration
The application comes pre-configured with support for environment variables. Ensure a `.env` file exists in the root directory:
```env
PORT=5000
JWT_SECRET=saylani-hackathon-hcm-lite-secret-key-2026

# Supabase Storage & Cloud Sync (Optional / Configured)
SUPABASE_URL=https://jwldccdrzmtbmybhgzau.supabase.co
SUPABASE_KEY=sb_publishable_YsDS6-W2HefpTla3iB41sA_z1BN2N2v
VITE_SUPABASE_URL=https://jwldccdrzmtbmybhgzau.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YsDS6-W2HefpTla3iB41sA_z1BN2N2v

# Google Gemini AI Integration
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Launch the Application
Run both the backend Express API and the Vite React frontend concurrently:
```bash
npm run dev
```

- **Frontend Client:** `http://localhost:5173`
- **Backend API Server:** `http://localhost:5000`

---

## 🎬 5-Minute Evaluation Walkthrough (Judge Demo Script)

Follow these concise steps to evaluate the system end-to-end:

### Step 1: First-Run Organization Setup
1. Navigate to `http://localhost:5173`.
2. As the database starts empty, the **First-Run Setup Wizard** will display automatically.
3. Complete the form:
   - **Company Name:** `Saylani Tech Solutions`
   - **Admin Email:** `admin@saylani.com`
   - **Admin Password:** `AdminPassword123!`
   - **Office Shift Hours:** `09:00` (Grace Period: `15 mins`, Half-day threshold: `5 hrs`)
   - **Office GPS Coordinates:** `24.8607, 67.0011` (Radius: `150m`)
4. Click **Complete Setup & Launch Organization**. You will be authenticated directly into the **Admin Portal**.
5. In **Organization Setup**, create your first department (e.g., `Engineering` / `ENG`) and designation (`Lead Software Engineer`).

### Step 2: Provision an HR Account
1. Inside the Admin view, navigate to **Organization** > **User Access & HR Logins**.
2. Click **+ Create HR Login**:
   - **Email:** `hr@saylani.com`
   - **Password:** `HrPassword123!`
3. Click the Logout icon in the lower-left sidebar.

### Step 3: HR Employee Registration & Calculations
1. Log in with `hr@saylani.com` / `HrPassword123!`.
2. Notice the system automatically lands on the **Organization/HR Management** view.
3. Switch to **Employees** > **+ Register Employee**:
   - Enter `EMP-101`, `Ali Khan`, `ali.khan@saylani.com`, and a Basic Salary of `80,000 PKR`.
   - Observe real-time salary component generation: **HRA (40%)**, **Medical (10%)**, resulting in **120,000 PKR Gross**.
   - Note down the generated temporary password (e.g., `Saylani@xxxx`).
   - Register a second employee (`EMP-102`, `Fatima Ahmed`, `fatima.ahmed@saylani.com`, Basic `100,000 PKR`).
4. *(Bonus)* Test **CSV Import/Export** to see dry-run instant syntax validation.

### Step 4: Employee First-Login, Password Change & Attendance
1. Log out and sign in as `ali.khan@saylani.com` using the temporary password.
2. The **Change Temporary Password Modal** opens automatically on first sign-in. Set a new password (e.g., `AliPass123!`).
3. Upon login, employees automatically land on the **Attendance** view.
4. Test Attendance:
   - Click **Web Check-In** (stamped with the immutable server timestamp; marked `LATE` if after 09:15).
   - Attempt a second check-in — verify that duplicate check-ins are rejected.
   - Click **Camera (+GPS) Check-In** to preview live camera capture and Haversine perimeter radius validation.

### Step 5: Smart Leave Parser & HR Approval
1. Navigate to the **Leave** tab.
2. Under **Smart Leave AI**, enter natural language:
   > *"Need next Monday and Tuesday off for my sister's wedding"*
3. Click **Extract & Pre-fill**. Gemini AI extracts the date range, selects `casual` leave, pre-fills the form, and verifies working days excluding weekends. Click **Confirm Application**.
4. Log back in as `hr@saylani.com`.
5. Under **Leave** > **HR Approval Inbox**, click **Approve** with an optional note. The employee receives an immediate notification.

### Step 6: AI Assistant & Security Refusal Test
1. While logged in as `hr@saylani.com`, open the **AI Assistant** drawer:
   - Ask: *"Who is on leave today?"*
   - Ask: *"Who came late most often this month?"*
   - Test Roman Urdu: *"Aaj kitne log present hain?"*
2. **The Colleague Salary Security Test:**
   - Log out and sign in as employee `ali.khan@saylani.com`.
   - Open the **AI Assistant** and prompt:  
     `"What is Fatima's salary?"`
   - **Verification:** The AI securely and politely refuses:  
     *"I cannot disclose salary or personal compensation details of other colleagues. For privacy and compliance reasons, employees can only review their own payroll records."*
   - Ask: *"How many sick leaves do I have left?"* -> The AI returns only Ali's own balance.

### Step 7: Payroll Generation & Payslip Download
1. Log in as `hr@saylani.com`, navigate to **Payroll**, and click **Generate Monthly Draft**.
   - Computes daily rate, unpaid absences, late penalties, and 5-tier progressive tax brackets automatically.
2. Log in as `admin@saylani.com` and click **Finalize & Lock**. The month is now locked against tampering.
3. Log in as employee `ali.khan@saylani.com`, open **Payroll**, and click **Download PDF** to export a clean branded payslip.

---

## 🏛️ System Architecture & 9 Core Modules

```
HCM Lite Architecture
├── Module 1: Auth & Access Control
│   ├── JWT Authentication & BCrypt Password Hashing
│   ├── Forced Temporary Password Reset on First Login
│   └── 3 Strict RBAC Portals: Admin, HR, Employee
├── Module 2: Organization Setup
│   ├── Department & Designation Master Hierarchy
│   ├── Shift Rules: Work Hours, Grace Time, Half-Day Threshold
│   └── Geofence Perimeter (Latitude, Longitude, Radius in Meters)
├── Module 3: Employee Management
│   ├── Employee 360 Profile & Multi-Field Directory Search
│   ├── Statutory Salary Structuring (Basic, HRA, Medical, Gross)
│   └── CSV Bulk Import with Dry-Run Validation
├── Module 4: Attendance & Time Tracking
│   ├── Server-Stamped Web Check-In (Prevents Device Clock Tampering)
│   ├── Duplicate Prevention (Single Check-In / Check-Out per Day)
│   └── Camera Check-In with Real-Time GPS Geofencing
├── Module 5: Leave Management
│   ├── Working-Day Calculation (Excludes Weekends & Holidays)
│   ├── Quota Enforcement & Overlap Collision Prevention
│   └── 2-Step HR Approval Inbox & In-App Status Updates
├── Module 6: Payroll Lite
│   ├── Automatic Prorated Absence & Late Penalty Deductions
│   ├── 5-Bracket Progressive Tax Slab Calculation
│   └── One-Click Admin Lock & Client-Side jsPDF Payslip Generation
├── Module 7: Executive Dashboards & Analytics
│   ├── Live KPI Cards (Headcount, Present, Late, On-Leave)
│   ├── Department Distribution & Average Tenure Metrics
│   └── Monthly Attendance Consistency Rate
├── Module 8: Google Gemini AI Assistant
│   ├── Natural Language Smart Leave Form Extraction
│   ├── Live KPI Executive Summarizer (3-5 Bullet Points)
│   ├── Roman Urdu Query Support
│   └── Cross-Employee Data Scope & Privacy Guardrails
└── Module 9: Communications & Audit Trail
    ├── Company Noticeboard & Broadcast Announcements
    ├── Action Notifications (Leave Status, Approvals)
    └── Immutable Audit Log (Actor, Timestamp, Before/After Snapshots)
```

---

## 🌟 Evaluated Bonus Features (+10 Points)

| Feature | Implementation Details |
| :--- | :--- |
| **Camera Attendance + GPS Geofencing** | HTML5 video stream captures user selfie; browser Geolocation API calculates distance using the Haversine formula against configured office coordinates. |
| **Automated Late Penalty Rule** | Configurable organization rule automatically deducting 0.5 day's pay for every 3 late arrivals in a payroll period. |
| **Roman Urdu AI Understanding** | Tuned system prompts parse colloquial queries like *"Meri chuttiyan kitni bachi hain?"* or *"Aaj kaun late aya?"*. |
| **Full Responsive Design** | Mobile-first CSS architecture with collapsible sidebar and adaptive touch controls down to 375px viewports. |

---

## 🧪 Automated End-to-End Verification

To verify all 9 core modules programmatically in a single automated test run:

```bash
# Using Node directly with tsx loader
node -r tsx server/tests/demo_flow_test.ts
```

All integration test steps execute against live endpoints and verify:
- Clean bootstrap initialization
- RBAC token authentication
- Web & camera check-in constraints
- Smart Leave AI extraction & HR approvals
- Employee salary privacy protection
- Payroll formula math & locked state immutability

---

## 🛠️ Tech Stack & Dependencies

- **Frontend:** React 19, TypeScript, Vite, Lucide Icons, jsPDF
- **Backend:** Node.js, Express 5, TypeScript (`tsx`)
- **Authentication:** JSON Web Tokens (`jsonwebtoken`), `bcryptjs`
- **Database / Storage:** Hybrid State Management with Supabase integration (`@supabase/supabase-js`, `@supabase/ssr`)
- **AI Engine:** Google Gemini API (`@google/genai` compatible endpoint integration)
- **Styling:** Custom Vanilla CSS with modern Design Tokens (Navy `#0b121a`, Neon `#39ff88`)

---

## 👥 Hackathon Submission Details

- **Event:** Saylani Hackathon 2026
- **Venue:** Zaitoon Ashraf IT Park
- **Project Name:** HCM Lite
- **Submission Type:** Production-Grade Human Capital Management System
