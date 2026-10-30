# Hosting Vulcan Admin on Render

This guide outlines how to deploy **Vulcan Admin** (`Admin_Haloween`) as a continuous Node.js Web Service on **Render** to eliminate serverless timeout constraints.

---

## Why Render?

| Feature | Vercel Hobby (Free) | Render Web Service |
| :--- | :--- | :--- |
| **Backend Runtime** | Serverless function (10s timeout, cold starts) | Persistent Node.js process (No timeout limit) |
| **Heavy Operations** | Can fail on large exports or bulk imports | Runs smoothly without execution cutoffs |
| **Build & Routing** | Split between static frontend and `/api/*` lambdas | Self-contained Node server serving Vite frontend & API routes |
| **Pricing** | Free tier restricts backend duration | Free / Starter tier runs standard long-lived process |

---

## Method 1: Web Service Setup (Recommended - 2 Minutes)

1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository:
   - **Repository:** `https://github.com/VulcanMSOT/Admin_Haloween`
   - **Branch:** `main`
4. Configure service settings:
   - **Name:** `vulcan-admin`
   - **Region:** `Singapore` (or region closest to your Supabase DB)
   - **Runtime:** `Node`
   - **Build Command:**
     ```bash
     npm install && npm run build
     ```
   - **Start Command:**
     ```bash
     npm start
     ```
   - **Plan:** `Free` (or `Starter` for no spin-down)

5. Expand **Advanced** → **Health Check Path**:
   - Set to `/healthz`

6. Add **Environment Variables** in the Environment tab:

| Variable Name | Value / Description | Example |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | `production` |
| `DATABASE_URL` | Supabase connection string (Port 6543 pooler) | `postgresql://postgres...:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | Supabase direct connection string (Port 5432) | `postgresql://postgres...:5432/postgres?sslmode=require` |
| `SUPABASE_URL` | Supabase project URL | `https://ryotqaievumejewpdzmr.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anonymous public key | `eyJhbGci...` |
| `VITE_SUPABASE_URL` | Supabase project URL (Frontend) | `https://ryotqaievumejewpdzmr.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (Frontend) | `eyJhbGci...` |
| `ORGANISER_PASSCODE` | Admin entry passcode | `vulcan2026` |
| `ORGANISER_SESSION_SECRET` | 32+ character random secret string | e.g. 64 hex characters |
| `ADMIN_EMAILS` | Comma-separated admin emails | `nexcell_rathinam@msot.org,sapnilbiswas010506@gmail.com` |
| `SITE_URL` | Public registration site URL | `https://vulcan-club.vercel.app` |
| `VITE_PUBLIC_SITE_URL` | Public site URL for frontend links | `https://vulcan-club.vercel.app` |
| `ALLOWED_ORIGINS` | Allowed CORS origins (optional) | `https://vulcan-club.vercel.app` |

*(Optional email keys if sending via Resend API: `RESEND_API_KEY`, `RESEND_FROM`)*

7. Click **Create Web Service**. Render will install dependencies, build the frontend (`dist/`), and start `server.js`.

---

## Method 2: Render Blueprint (`render.yaml`)

Because `render.yaml` is included in the repository, you can alternatively use Render's Blueprint:
1. In Render, click **New +** → **Blueprint**.
2. Select repository `VulcanMSOT/Admin_Haloween`.
3. Render reads `render.yaml` automatically and prompts for the sensitive environment variables (`DATABASE_URL`, `ORGANISER_PASSCODE`, etc.).
4. Click **Apply**.

---

## Verification Checklist

Once Render deploys your URL (e.g. `https://vulcan-admin.onrender.com`):
1. **Health Check:** Open `https://vulcan-admin.onrender.com/healthz` → should return `{"ok":true,"status":"healthy"}`.
2. **Dashboard:** Open `https://vulcan-admin.onrender.com/` → login page appears.
3. **Login:** Enter your admin passcode (`vulcan2026`) and admin email → successfully enters dashboard.
4. **Operations:**
   - Review pending UPI payment references.
   - Edit coupons and referral settings.
   - Scan tickets via mobile check-in.
   - Export attendee CSV without timeout errors.
