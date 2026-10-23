# Vulcan Operations Console (Hack-O-Lantern Admin)

Event operations, manual UPI payment verification, ticketing, manual Gmail delivery, and gate check-in console for **Hack-O-Lantern** (`Vulcan Club`).

---

## 1. Architecture & Free-Tier Design

- **Frontend**: Vite + React 18, responsive dark-mode operations dashboard, `html5-qrcode` mobile camera scanner.
- **Backend**: Node.js Vercel Serverless Functions (`/api/*`).
- **Database**: Shared Supabase PostgreSQL with [Vulcan Public Site](https://github.com/VulcanMSOT/Vulcan).
- **Storage**: Supabase Storage private bucket `payment-screenshots` with temporary signed URLs for verification.
- **Email Delivery Model**: **100% Free Manual Workflow**.
  - No paid email services (e.g. Resend, SendGrid) are required.
  - Admins send official attendee communications directly from `nexcell_rathinam@msot.org` using pre-filled one-click Gmail links and copyable templates.
  - System logs "Mark as sent" status, admin username, and timestamp to database `AuditLog`.
- **Payment Verification**: Manual UPI bank statement reconciliation for payee `himangshuyadav2@oksbi`.

---

## 2. Key Modules & Features

### 1. Live Dashboard & Statistics
- Real-time counters:
  - Total registered teams.
  - Confirmed revenue (`₹300 * confirmed`).
  - Pending review queue.
  - Tickets issued and door check-ins.
  - Quick badge for **Confirmed but email not yet sent**.

### 2. Event Settings Manager
- Live controls editable without redeploying:
  - Toggle registrations **Open / Closed**.
  - Maximum team capacity limit.
  - Registration fee per team (INR).
  - UPI Payee ID and Payee Name.
  - Event Start/End dates, venue, and rules link.

### 3. Payment Review Queue
- Displays Team Name, College, Members, submitted 12-digit UTR, and upload timestamp.
- **Duplicate UTR Alert**: Warns admins if the same bank reference was submitted across multiple teams.
- **Private Screenshot Viewer**: Safely renders payment receipts via temporary signed URLs.
- **Idempotent Approval**: Issues unique Ticket ID (`VULCAN-XXXX-XXXX`) and compound token (`VHK-XXXX:token`).
- **Rejection with Reason**: Preserves existing `team_id` and `payment_ref` while marking status as rejected, allowing the attendee to resubmit without losing their place.

### 4. Manual Email Dispatcher (Gmail Workflow)
- Click **"Send Email"** next to any registration to open the manual email modal:
  - Choose template: **Confirmed + Ticket Pass**, **Payment Rejected**, or **Payment Reminder**.
  - Shows attendee name, team, email, and auto-generated body.
  - **Open in Gmail**: Launches Gmail web draft pre-addressed to the attendee, with sender context `nexcell_rathinam@msot.org`, subject line, and formatted body.
  - **Copy Message**: Copies plain-text email with one click for manual pasting.
  - **Mark as Sent**: Updates `emailStatus = 'sent'`, increments `emailSentCount`, records timestamp and admin email in `AuditLog`.
- **Bulk Email BCC Copier**: Copy all emails in current filter with one click to send announcements via Gmail BCC.

### 5. Mobile Door Check-in Desk
- Real-time camera QR reader powered by `html5-qrcode`.
- Scans QR passes containing compound tokens (`teamId:ticketToken`).
- **Double-Scan & Fraud Prevention**:
  - Valid first scan: Green badge with admission confirmation and team details.
  - Already admitted: Amber alert with previous check-in timestamp.
  - Invalid/revoked ticket: Red warning blocking entry.

### 6. Attendee Directory & CSV Export
- Search across Team Name, Member, College, Email, Phone, Team ID, Payment Ref, UTR, and Ticket ID.
- One-click CSV export with complete details, tickets, and email delivery metadata.

---

## 3. Environment Variables

Create `.env.local` in `Vulcan-admin`:

```bash
# Supabase PostgreSQL Database (Shared with public site)
DATABASE_URL="postgresql://postgres.ryotqaievumejewpdzmr:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=no-verify"
DIRECT_URL="postgresql://postgres.ryotqaievumejewpdzmr:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require"

# Supabase API
SUPABASE_URL="https://ryotqaievumejewpdzmr.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
VITE_SUPABASE_URL="https://ryotqaievumejewpdzmr.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Supabase Service Role Key (Used for signed URLs on private screenshot bucket)
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Organiser Auth & Security
ORGANISER_PASSCODE="vulcan2026"
ORGANISER_SESSION_SECRET="7a9f82d1c5e4b3a20192837465f6e7d8c9b0a123456789abcdef0123456789ab"
ADMIN_EMAILS="nexcell_rathinam@msot.org,sapnilbiswas010506@gmail.com,himangshuyadav2@oksbi"

# Public Site Reference URL
SITE_URL="https://vulcan-club.vercel.app"
VITE_PUBLIC_SITE_URL="https://vulcan-club.vercel.app"

# CORS Origin Allow-list
ALLOWED_ORIGINS="http://localhost:5173,http://localhost:5174,https://vulcan-club.vercel.app,https://vulcan-admin.vercel.app"
```

---

## 4. Local Development

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma Client
npx prisma generate

# 3. Start development server
npm run dev
```

---

## 5. Production Deployment (Vercel Free Tier)

1. Import repository `https://github.com/VulcanMSOT/Admin_Haloween.git` into [Vercel](https://vercel.com).
2. Framework Preset: **Vite**.
3. Build Command: `npm run build` (runs `prisma generate && vite build`).
4. Output Directory: `dist`.
5. Add all environment variables listed above under Project Settings -> Environment Variables.
6. Deploy!
