# HealthBridge — Local Development Guide

## Quick Start

```bash
cd c:\Users\aranjan\Documents\Projects\healthBridge
npm run dev
# Open http://localhost:3000
```

To run the stage-1 dedicated API server alongside Next.js:

```bash
npm run api:dev
# API health check: http://localhost:4000/api/health
```

The existing Next.js `/api/*` routes remain active. The Node.js server exposes the same routes on port `4000` for the later cutover.

To make the existing Next.js `/api/*` routes use the dedicated Node.js server, add this to `.env.local` and run both servers:

```env
USE_DEDICATED_API=true
DEDICATED_API_BASE_URL=http://localhost:4000
```

Set `USE_DEDICATED_API=false` or remove it to run the shared API handlers inside Next.js again.

---

## Login (Dev Mode)

In development (`NODE_ENV=development`), the phone OTP is bypassed:

1. Go to http://localhost:3000/login
2. Enter any 10-digit phone number (e.g., `9876543210`)
3. Click "Send OTP"
4. Enter OTP: **`111111`**
5. You're logged in as a **patient** (default role)

### How it works

- Instead of real SMS OTP, a dev user is created with email `{phone}@dev.healthbridge.local`
- Password is always `dev-healthbridge-2024!`
- First login creates the user automatically

---

## Change User Role (Dev Commands)

### Set user to DOCTOR:
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/auth/dev-set-role" `
  -Method POST -ContentType "application/json" `
  -Body '{"phone": "+919876543210", "role": "doctor"}'
```

### Set user to ADMIN:
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/auth/dev-set-role" `
  -Method POST -ContentType "application/json" `
  -Body '{"phone": "+919876543210", "role": "admin"}'
```

### Set user back to PATIENT:
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/auth/dev-set-role" `
  -Method POST -ContentType "application/json" `
  -Body '{"phone": "+919876543210", "role": "patient"}'
```

### curl equivalents (Git Bash / WSL):
```bash
# Doctor
curl -X POST http://localhost:3000/api/auth/dev-set-role \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210", "role": "doctor"}'

# Admin
curl -X POST http://localhost:3000/api/auth/dev-set-role \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210", "role": "admin"}'

# Patient (reset to normal)
curl -X POST http://localhost:3000/api/auth/dev-set-role \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210", "role": "patient"}'
```

After changing role, **log out and log back in** for changes to take effect.

---

## Supabase Setup (Required)

### 1. Get your Service Role Key

1. Go to https://supabase.com/dashboard → your project → Settings → API
2. Copy the `service_role` key (secret)
3. Add to `.env.local`:

```env
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 2. Disable Email Confirmation (for dev)

1. Go to Supabase Dashboard → Authentication → Providers → Email
2. **Turn OFF** "Confirm email" toggle
3. This lets dev-login create users without email verification

### 3. Create the database tables

Run the SQL from `src/types/database.ts` comments, or use the Supabase SQL editor to create:
- `clinics`
- `doctors`
- `patients`
- `appointments`
- `medical_records`
- `health_journal_entries`
- `prescriptions`
- `patient_vitals`
- `care_plans`
- `shared_links`
- `audit_logs`
- `user_roles`

---

## What Pages Look Like Per Role

| Role | Main Screen | Navigation |
|------|-------------|-----------|
| **Patient** | `/home` | Home, Journal, Reports, Appointments, Profile |
| **Doctor** | `/queue` | Queue, Patients, Schedule |
| **Admin** | `/dashboard` | Dashboard, Patients, Payments, Analytics, Settings |

---

## What Was Changed for Local Dev

### Files ADDED (dev-only):
| File | Purpose |
|------|---------|
| `src/app/api/auth/dev-login/route.ts` | Creates users via email/password instead of phone OTP |
| `src/app/api/auth/dev-set-role/route.ts` | Changes user role (patient/doctor/admin) |

### Files MODIFIED:
| File | Change |
|------|--------|
| `src/app/(auth)/login/page.tsx` | In dev mode: skips real OTP, accepts "111111", uses dev-login API |
| `src/lib/logger.ts` | Removed pino-pretty transport (caused worker.js errors in Next.js) |

---

## How to Revert to Production Mode

### Option A: Deploy to Vercel (automatic)
In production (`NODE_ENV=production`), all dev bypasses are automatically disabled:
- Dev-login and dev-set-role APIs return 404
- Login page uses real Supabase phone OTP
- No changes needed — just deploy

### Option B: Remove dev code manually

1. **Delete these files:**
   ```
   src/app/api/auth/dev-login/route.ts
   src/app/api/auth/dev-set-role/route.ts
   ```

2. **Revert login page** — In `src/app/(auth)/login/page.tsx`:
   - Remove the `const isDev = ...` line
   - In `handleSendOTP`: Remove the `if (isDev)` block, keep only the `else` branch
   - In `handleVerifyOTP`: Remove the `if (isDev)` block, keep only the `else` branch
   - Remove `isDev` from dependency arrays
   - Remove the dev mode OTP hint text

3. **Enable Phone Provider in Supabase:**
   - Dashboard → Authentication → Providers → Phone
   - Enable it and configure an SMS provider (Twilio, MessageBird, etc.)

### Option C: Keep dev code (recommended)
The dev code is safe in production — it checks `NODE_ENV` and returns 404.
No cleanup needed. Just ensure your SMS provider is configured for production.

---

## Environment Variables

```env
# Required for all environments
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# Required for dev-set-role and admin features
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI (optional — features work without it, just return errors)
AI_PROVIDER=openai
AI_API_KEY=sk-...
AI_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIMENSIONS=3072

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=HealthBridge

# API routing mode
USE_DEDICATED_API=false
DEDICATED_API_BASE_URL=http://localhost:4000
API_PORT=4000
API_HOST=0.0.0.0
API_CORS_ORIGIN=http://localhost:3000
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Phone provider not supported" | You're in dev mode, this is bypassed. Use OTP `111111` |
| "Dev login failed" | Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`, OR disable email confirmation in Supabase dashboard |
| "Invalid login credentials" | The dev user may not be confirmed. Disable email confirmation in Supabase |
| Pages redirect to login | You need to be logged in. Use any 10-digit phone + OTP `111111` |
| API returns 401 | Route requires authentication. Login first |
| API returns 500 | Check if `AI_API_KEY` is set (needed for AI features) |
| Worker.js MODULE_NOT_FOUND | Run `Remove-Item -Recurse -Force .next` then `npm run dev` |
