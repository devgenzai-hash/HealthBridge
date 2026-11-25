# HealthBridge - Session Changes & Setup Documentation

## What Was Fixed

### 1. Database Tables Created
- All tables created in Supabase via SQL Editor: `clinics`, `doctors`, `patients`, `appointments`, `medical_records`, `health_journal_entries`, `prescriptions`, `patient_vitals`, `care_plans`, `shared_links`, `audit_logs`, `user_roles`
- pgvector extension enabled with 1024-dimension vectors
- RPC functions for vector similarity search (`match_medical_records`, `match_journal_entries`)

### 2. NVIDIA NIM LLM Configuration
- **Provider**: `nvidia-nim` via OpenAI-compatible API
- **LLM Model**: `meta/llama-3.1-8b-instruct`
- **Embedding Model**: `nvidia/nv-embedqa-e5-v5` (1024 dimensions)
- **Base URL**: `https://integrate.api.nvidia.com/v1`
- Configured in `.env.local`

### 3. RAG (Retrieval-Augmented Generation) Working
- Embeddings generated for all medical records and journal entries
- Vector similarity search via pgvector RPC functions
- Chat endpoint (`/api/ai/chat`) retrieves relevant patient data and generates contextual responses
- Uses NVIDIA embedding with `input_type: 'query'` for search and `input_type: 'passage'` for storage

### 4. RLS Recursion Fix
- **Problem**: RLS policies called `get_user_role()` which queried `user_roles` table, which itself had RLS that called `get_user_role()` → infinite recursion → "stack depth limit exceeded"
- **Fix Applied**: 
  - Added `SECURITY DEFINER` to helper functions in `schema.sql`
  - Created `supabase/fix-rls-recursion.sql` migration
  - Created API routes that bypass RLS using admin client
  - Updated patient pages to use API routes instead of direct Supabase queries

### 5. Pages Fixed (Client → API Migration)
- `src/app/(patient)/home/page.tsx` → uses `/api/patient/data?section=home`
- `src/app/(patient)/journal/page.tsx` → uses `/api/patient/data?section=journal`
- `src/app/(patient)/reports/page.tsx` → uses `/api/patient/data?section=reports`
- `src/app/(patient)/appointments/page.tsx` → uses `/api/patient/data?section=appointments`
- `src/hooks/use-auth.ts` → uses `/api/auth/context`

### 6. New API Routes Created
| Route | Purpose |
|-------|---------|
| `GET /api/auth/context` | Returns user role, patientId, doctorId (bypasses RLS) |
| `GET /api/patient/data?section=home\|journal\|reports\|appointments` | Patient data fetching |
| `GET /api/doctor/queue` | Doctor's today queue |
| `POST /api/ai/chat` | RAG chat (was existing, fixed to use admin client) |

### 7. AI Chat Feature
- Full RAG pipeline: embed query → vector search → context assembly → LLM response
- Accessible at `/ai-chat` route
- Added "Ask AI about your health" CTA on patient home page
- System prompt prevents diagnosis, references actual numbers, warm tone

### 8. Seed Data
- Script: `scripts/seed-data.mjs`
- Created: clinic, doctor, patient, 2 appointments, 10 journal entries, 2 medical records, vitals, prescription, care plan
- All embeddings pre-generated for RAG

---

## How to Run

```bash
# Start dev server
npm run dev

# Open browser
http://localhost:3000
```

## Test Accounts (Dev Auth)
| Role | Phone | OTP | Dashboard |
|------|-------|-----|-----------|
| Patient | 9000000001 | 111111 | /home |
| Doctor | 9000000002 | 111111 | /queue |
| Admin | 9000000003 | 111111 | /dashboard |
| Super Admin | 9000000000 | 111111 | /dashboard |

---

## REQUIRED: Run This SQL in Supabase Dashboard

**Go to**: https://supabase.com/dashboard/project/uajlbqcyxaobnyaykvpx/sql/new

Paste the contents of `supabase/fix-rls-recursion.sql`:

```sql
CREATE OR REPLACE FUNCTION get_user_role(uid UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role FROM user_roles WHERE user_id = uid;
$$;

CREATE OR REPLACE FUNCTION get_user_clinic(uid UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT clinic_id FROM user_roles WHERE user_id = uid;
$$;

CREATE OR REPLACE FUNCTION get_patient_id(uid UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT id FROM patients WHERE user_id = uid AND deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION get_doctor_id(uid UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT id FROM doctors WHERE user_id = uid AND deleted_at IS NULL;
$$;
```

**Why**: Without this, client-side direct Supabase queries (doctor queue page, profile page, etc.) will fail with "stack depth limit exceeded". The main patient pages already work via API routes but this fixes everything.

---

## Architecture Summary

```
Browser → Next.js App Router → API Routes → Supabase (admin client, bypasses RLS)
                              → AI Chat Route → NVIDIA NIM (embed + LLM)
                                             → Supabase pgvector (RAG search)
```

## Files Modified This Session
- `.env.local` - NVIDIA NIM config
- `supabase/schema.sql` - vector(1024), SECURITY DEFINER
- `supabase/fix-rls-recursion.sql` - NEW migration
- `scripts/seed-data.mjs` - NEW seed script
- `src/lib/ai/embeddings.ts` - NVIDIA model name + input_type
- `src/lib/ai/client.ts` - Provider-aware params (no `store` for NVIDIA)
- `src/hooks/use-auth.ts` - Uses /api/auth/context
- `src/app/(patient)/home/page.tsx` - API-based data fetching + AI chat CTA
- `src/app/(patient)/journal/page.tsx` - API-based
- `src/app/(patient)/reports/page.tsx` - API-based
- `src/app/(patient)/appointments/page.tsx` - API-based
- `src/app/api/auth/context/route.ts` - NEW
- `src/app/api/patient/data/route.ts` - NEW
- `src/app/api/doctor/queue/route.ts` - NEW
- `src/app/api/ai/chat/route.ts` - Uses admin client for patient lookup
