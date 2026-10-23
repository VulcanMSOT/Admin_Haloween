# Vulcan Operations Console (Hack-O-Lantern Admin)

Event operations, manual UPI payment verification, ticketing, email delivery, and gate check-in console for **Hack-O-Lantern** (`Vulcan Club`).

---

## 1. Architecture & Tech Stack

- **Frontend**: Vite + React 18, dark-mode operations dashboard, `html5-qrcode` camera scanner.
- **Backend**: Node.js Vercel Serverless Functions (`/api/*`).
- **Database**: Shared Supabase PostgreSQL with [Vulcan Public Site](https://github.com/VulcanMSOT/Vulcan).
- **Storage**: Supabase Storage private bucket `payment-screenshots` with 1-hour signed URL viewing.
- **Email Delivery**: Resend (Free Tier: 100 emails/day, 3,000/month).
- **Payment Model**: 100% Free Tiers. Manual UPI verification (payee: `himangshuyadav2@oksbi`).

---

## 2. Key Features

1. **Live Dashboard Overview**: Real-time counter of total registered teams, confirmed revenue (`₹300 * confirmed`), pending review queue, tickets issued, and door check-ins.
2. **Manual Payment Review Queue**:
   - Inspect team name, colleges, members, and 12-digit UTR reference.
   - **Duplicate UTR Detection**: Highlights if the same UTR was submitted across multiple teams to prevent fraud.
   - **Screenshot Proof Lightbox**: View private uploaded receipt screenshots securely via temporary signed URLs.
   - **One-Click Approval**: Idempotently generates a unique Ticket ID (`VULCAN-XXXX-XXXX`), high-entropy `ticketToken`, logs the action to `AuditLog`, and sends a branded confirmation email with an embedded QR code pass.
   - **Rejection with Reason**: Requires an admin reason (e.g. "UTR not found in bank statement"), records status, and sends a rejection email with a direct link for the team leader to resubmit payment details.
3. **Ticketing Desk**:
   - View all issued tickets and email delivery statuses (`sent`, `failed`, `pending`).
   - **One-click Resend**: Re-triggers Resend ticket delivery with auto-retry.
   - **Retry Failed Emails**: Batch retries all registrations with failed email attempts with exponential backoff awareness.
   - **Complimentary Passes (Comp Ticket)**: Issue official tickets for sponsors, speakers, or organizers without requiring payment.
   - **Revoke Ticket**: Invalidate compromised passes with a recorded reason; instantly blocked at door scanner.
4. **Door Check-in Desk**:
   - **Camera QR Scanner**: Real-time camera QR reader (`html5-qrcode`) scanning the ticket QR pass.
   - **Manual Lookup**: Instant verification by Ticket ID, Ticket Token, or Order Reference (`VLC-XXXXXX`).
   - **Double-Scan Prevention**: Green banner on first entry, amber alert with admission timestamp if already checked in, red alert if invalid or revoked. Displays team members and college names.
5. **Attendee Directory & Editor**:
   - Filterable, searchable table across all fields (Team, Member, College, Email, Phone, Order Ref, UTR, Ticket ID).
   - Inline Attendee Editor: Correct typos or change teammate details with automatic `AuditLog` recording.
   - **CSV Export**: Comprehensive export of all registration, payment, and ticketing data.

---

## 3. Environment Variables

Create `.env.local` in `Vulcan-admin`:

```bash
# Supabase PostgreSQL Database (Shared with public site)
DATABASE_URL="postgresql://postgres.ryotqaievumejewpdzmr:[PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=no-verify"
DIRECT_URL="postgresql://postgres.ryotqaievumejewpdzmr:[PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require"

# Supabase API
SUPABASE_URL="https://ryotqaievumejewpdzmr.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
VITE_SUPABASE_URL="https://ryotqaievumejewpdzmr.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Organiser Auth & Allow-list
ORGANISER_PASSCODE="vulcan2026"
ORGANISER_SESSION_SECRET="7a9f82d1c5e4b3a20192837465f6e7d8c9b0a123456789abcdef0123456789ab"
ADMIN_EMAILS="nexcell_rathinam@msot.org,sapnilbiswas010506@gmail.com,himangshuyadav2@oksbi"

# Resend Transactional Email
RESEND_API_KEY="re_..."
RESEND_FROM="onboarding@resend.dev"      # In production: nexcell_rathinam@msot.org
RESEND_REPLY_TO="nexcell_rathinam@msot.org"

# Public site URL
SITE_URL="https://vulcan-club.vercel.app"
```

---

## 4. Resend DNS Configuration for `msot.org`

To send emails directly from `nexcell_rathinam@msot.org` without sandbox restrictions, add these DNS records to `msot.org`'s DNS provider (e.g. Cloudflare, GoDaddy, Route53):

| Type | Name / Host | Value / Target | Priority | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **TXT** | `resend._domainkey.msot.org` | *Provided in Resend dashboard* (`p=...`) | - | DKIM Signature |
| **MX** | `feedback.msot.org` | `feedback-smtp.resend.com` | 10 | Return-Path |
| **TXT** | `feedback.msot.org` | `v=spf1 include:amazonses.com ~all` | - | SPF Alignment |
| **TXT** | `_dmarc.msot.org` | `v=DMARC1; p=none;` | - | DMARC Policy |

> **Development Note**: Until domain DNS verification is complete, Resend allows sending free test emails using `RESEND_FROM="onboarding@resend.dev"` to your Resend account's registered email address.

---

## 5. Local Development & Deployment

### Run locally:
```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma Client
npx prisma generate

# 3. Start development server
npm run dev
```

### Production Deployment (Vercel Free Tier):
1. Import repository `https://github.com/VulcanMSOT/Admin_Haloween.git` into Vercel.
2. Framework Preset: **Vite**.
3. Build Command: `npm run build` (runs `prisma generate && vite build`).
4. Output Directory: `dist`.
5. Add all environment variables listed above under Project Settings -> Environment Variables.
6. Deploy!
