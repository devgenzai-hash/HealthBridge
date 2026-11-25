# HealthBridge

AI-powered clinic management PWA for small Indian clinics.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and configure
cp .env.example .env.local
# Edit .env.local with your Supabase and AI keys

# 3. Set up Supabase
# - Create a project in ap-south-1 (Mumbai)
# - Run supabase/schema.sql in the SQL editor

# 4. Start dev server
npm run dev
```

## Environment Variables

See `.env.example` for all required variables. At minimum you need:

- `NEXT_PUBLIC_SUPABASE_URL` — Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server only)
- One AI provider key (e.g., `OPENAI_API_KEY` or `OPENROUTER_API_KEY`)

## Tech Stack

- **Frontend:** Next.js 15 App Router, React 19, Tailwind CSS v4, PWA
- **Backend:** Supabase (Auth, Postgres + pgvector, Storage, RLS)
- **AI:** Pluggable provider architecture (OpenAI, OpenRouter, Groq, Anthropic, Ollama, etc.)
- **Embedding:** text-embedding-3-large (3072 dims) with RAG retrieval

## Architecture

```
src/
├── app/                    # Next.js App Router pages
│   ├── (patient)/         # Patient portal routes
│   ├── (doctor)/          # Doctor portal routes
│   ├── (admin)/           # Admin portal routes
│   └── api/               # Stage-1 Next wrappers for API routes
├── api/                   # Shared fetch-style API handlers
├── server/                # Dedicated Node.js API server
├── components/            # Shared UI components
├── hooks/                 # Custom React hooks
├── lib/                   # Core utilities
│   ├── ai/               # AI client, embeddings, prompts
│   └── supabase/         # Supabase client helpers
└── types/                 # TypeScript type definitions
```

## Features (MVP)

- Phone OTP authentication
- Patient health record upload + AI analysis (OCR)
- AI chat with RAG over medical records
- Doctor live queue management
- AI-generated patient briefings
- Admin analytics dashboard
- Offline-first PWA with Workbox caching
- i18n support (English + Hindi stubs)
- DPDP Act 2023 compliant (data in India)

## Scripts

```bash
npm run dev        # Next.js development server
npm run api:dev    # Dedicated Node.js API server on port 4000
npm run build      # Production build
npm run start      # Production server
npm run lint       # Lint check
```

## Dedicated API Server

Stage 1 keeps the existing `/api/*` Next.js routes active, but their logic now lives in shared handlers under `src/api`. The standalone Node.js server in `src/server` mounts the same handlers at the same paths, so stage 2 can switch clients or a reverse proxy to the Node server without another route migration.

```bash
npm run api:dev
# http://localhost:4000/api/health
```

Useful API server environment variables:

- `USE_DEDICATED_API` - set to `true` to make Next.js `/api/*` routes proxy to the dedicated Node.js server
- `DEDICATED_API_BASE_URL` - defaults to `http://localhost:4000`
- `API_PORT` - defaults to `4000`
- `API_HOST` - defaults to `0.0.0.0`
- `API_CORS_ORIGIN` - comma-separated allowed origins, defaults to `NEXT_PUBLIC_APP_URL` or `http://localhost:3000`

Stage-1 default keeps `USE_DEDICATED_API=false`, so the existing Next.js route stays active and runs the shared handler locally. To test the dedicated server behind the same `/api/*` URLs:

```env
USE_DEDICATED_API=true
DEDICATED_API_BASE_URL=http://localhost:4000
```

Then run both servers:

```bash
npm run api:dev
npm run dev
```
