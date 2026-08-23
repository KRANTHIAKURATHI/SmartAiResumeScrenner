# 📄 Smart AI Resume Screener — Full Documentation

> An editorial, analytics-first resume screening workspace powered by **React 19**, **TanStack Start**, **Supabase**, and **Google Gemini 2.5 Flash**.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Key Features](#2-key-features)
3. [Tech Stack](#3-tech-stack)
4. [Project Structure](#4-project-structure)
5. [Architecture](#5-architecture)
6. [Data Model](#6-data-model)
7. [API Documentation](#7-api-documentation)
   - [Internal Server Functions](#71-internal-server-functions)
   - [Supabase APIs](#72-supabase-apis-server-side-only)
   - [Lovable AI Gateway](#73-lovable-ai-gateway-external)
   - [Resume Text Extraction](#74-resume-text-extraction)
8. [Environment Variables](#8-environment-variables)
9. [Rate Limiting](#9-rate-limiting)
10. [Security Model](#10-security-model)
11. [AI Screening Pipeline](#11-ai-screening-pipeline)
12. [Score System](#12-score-system)
13. [Local Development](#13-local-development)
14. [Testing](#14-testing)

---

## 1. Project Overview

**Smart AI Resume Screener** is a recruiter-focused SaaS workspace that streamlines the hiring pipeline using AI. Recruiters publish job roles, candidates submit resumes (PDF / DOCX / TXT), and an LLM automatically screens every resume against the role — producing a structured, explainable match score along with strengths, skill gaps, and a hiring verdict.

The platform is built with a **security-first, server-centric architecture**: the browser never touches the database directly, and all sensitive operations are gated behind typed, rate-limited server functions.

---

## 2. Key Features

### 🗂️ Job Management
- Create roles with rich metadata: description, required skills, preferred skills, requirements, min/max experience, location, and employment type.
- **Lifecycle:** `draft` → `active` → `closed`. Only `active` roles appear on the public apply page.
- Job detail view with a ranked candidate table sorted by AI match score.

### 📋 Applications & Resumes
- **Public apply page** — candidates fill in their details and upload a resume (PDF, DOCX, TXT).
- Resumes are stored in a **private** Supabase Storage bucket; access is exclusively via short-lived signed URLs — never publicly exposed.
- **Server-side text extraction:** `unpdf` for PDF, `fflate` for DOCX (`word/document.xml`), plain UTF-8 decode for TXT.

### 🤖 AI Screening
- **Pass 1 — Extraction:** LLM extracts structured candidate data: name, email, phone, years of experience, skills, education, and a professional summary.
- **Pass 2 — Evaluation:** LLM scores the resume against the job (1–10 scale) and produces strengths, gaps, matched/missing skills, and a verdict.
- Scores are displayed on a **100-point scale** with a hover-card **score breakdown** explaining the weighting.

### 🏆 Ranking, Filtering & Review
- Ranked candidate lists per job, a cross-job candidate index, and a shortlist view.
- Structured filters: score band, experience range, skills, status.
- **Duplicate detection** via normalized email/phone matching — flagged inline.
- **Status workflow:** `new` → `screened` → `shortlisted` / `rejected`.
- Recruiter notes per application.
- Adaptive polling refreshes rows only while screening is pending.

### 🛡️ Platform & Security
- All DB and storage access runs through server functions using the service role key.
- No table is exposed to `anon` or `authenticated` Supabase roles.
- In-memory rate limiting on all public endpoints.
- Light/dark theme with a pre-hydration anti-flash script.
- Unit tests (Vitest + Testing Library) and E2E scripts (Playwright).

---

## 3. Tech Stack

| Layer | Technology | Version / Notes |
|---|---|---|
| **Framework** | TanStack Start | v1 — React 19, SSR + server functions |
| **Router** | TanStack Router | File-based routing under `src/routes/` |
| **Build Tool** | Vite | v7 |
| **Data Fetching** | TanStack Query | v5 — `staleTime` 30s, preload on intent |
| **Styling** | Tailwind CSS | v4 — theme tokens in `src/styles.css` |
| **UI Primitives** | shadcn/ui + Radix UI | Accessible, headless component system |
| **Icons** | lucide-react | v0.575.0 |
| **Type Safety** | TypeScript + Zod | Zod validates every server function input |
| **Database** | Supabase Postgres | RLS enabled, no permissive public policies |
| **File Storage** | Supabase Storage | Private `resumes` bucket, signed URLs |
| **AI / LLM** | Lovable AI Gateway → Gemini 2.5 Flash | OpenAI-compatible, JSON-mode, temperature 0.1 |
| **PDF Parsing** | unpdf | v1.8.1 |
| **DOCX Parsing** | fflate | v0.8.3 — unzip → parse `word/document.xml` |
| **Forms** | react-hook-form + @hookform/resolvers | Zod-integrated validation |
| **Charts** | recharts | v2.15.4 |
| **Toasts** | sonner | v2.0.7 |
| **Date Utils** | date-fns | v4.1.0 |
| **Testing** | Vitest, @testing-library/react, Playwright | Unit + E2E |
| **Runtime** | Edge / Worker (Nitro) | Cloudflare Workers compatible |
| **Package Manager** | Bun / npm | `bun.lock` present |
| **Linting** | ESLint v9 + Prettier | `eslint.config.js`, `.prettierrc` |

**Typography & Palette:**
> Instrument Serif for headings and numerals, Work Sans for body/UI. Warm paper surfaces, near-black ink text, and a single deep ink-red accent.

---

## 4. Project Structure

```
SmartAiResumeScreener/
├── src/
│   ├── routes/
│   │   ├── __root.tsx              # Root layout, head metadata, theme script
│   │   ├── index.tsx               # Public landing page
│   │   └── _app/                   # App shell layout (pathless)
│   │       ├── overview.tsx        # Metrics + recent activity dashboard
│   │       ├── jobs/
│   │       │   ├── index.tsx       # Jobs table
│   │       │   ├── new.tsx         # Create job form
│   │       │   └── $jobId.tsx      # Job detail + ranked candidates
│   │       ├── applications/
│   │       │   └── $applicationId.tsx  # Candidate profile + score breakdown
│   │       ├── candidates.tsx      # Cross-job candidate index
│   │       ├── shortlist.tsx       # Shortlisted candidates view
│   │       ├── apply.tsx           # Public candidate portal
│   │       └── settings.tsx        # App settings
│   ├── lib/
│   │   ├── data.functions.ts       # CRUD server functions (jobs, applications, candidates, uploads)
│   │   ├── candidate.functions.ts  # Public application submission
│   │   ├── screening.functions.ts  # Screening trigger + signed resume URL
│   │   ├── screening.server.ts     # Screening pipeline orchestration
│   │   ├── llm.server.ts           # AI gateway client + Zod schemas
│   │   ├── resume-extract.server.ts # PDF/DOCX/TXT text extraction
│   │   ├── rate-limit.server.ts    # In-memory rate limiter
│   │   ├── queries.ts              # TanStack Query options
│   │   ├── screening-filters.ts    # Filter logic (unit tested)
│   │   └── domain.ts               # Shared types, score formatting
│   ├── components/app/             # AppShell, ResumeUpload, ScoreBreakdown, ScreeningFilters
│   ├── hooks/                      # Custom React hooks
│   ├── integrations/supabase/      # Supabase client (browser + server)
│   ├── styles.css                  # Tailwind v4 theme tokens + global styles
│   └── routeTree.gen.ts            # Auto-generated route tree
├── supabase/
│   ├── migrations/                 # SQL migrations (apply in filename order)
│   └── config.toml                 # Supabase project config
├── docs/
│   ├── DOCUMENTATION.md            # This file — full project documentation
│   ├── ARCHITECTURE.md             # Architecture deep-dive
│   ├── API.md                      # API reference
│   └── DATA-MODEL.md               # Database schema reference
├── public/                         # Static assets
├── package.json
├── vite.config.ts
├── tsconfig.json
├── vitest.config.ts
└── .env                            # Environment variables (never commit secrets)
```

---

## 5. Architecture

```
+-------------------------------------------------------------+
|         Browser  (React 19 / TanStack Router + Query)       |
|                                                             |
|  * No direct DB credentials                                 |
|  * Calls server functions via typed RPC                     |
+---------------------------+---------------------------------+
                            |  createServerFn (typed RPC)
                            v
+-------------------------------------------------------------+
|     TanStack Start -- Server Runtime (Edge / Worker)        |
|                                                             |
|  * Zod input validation on every endpoint                   |
|  * In-memory rate limiting                                  |
|  * Service-role Supabase client (never sent to browser)     |
+-------------+-------------------------------+---------------+
              |  service-role client          |  HTTPS
              v                               v
+---------------------+       +------------------------------+
|  Supabase Postgres  |       |   Lovable AI Gateway         |
|  + Storage Bucket   |       |   -> google/gemini-2.5-flash |
|                     |       |                              |
|  * RLS enabled      |       |  * OpenAI-compatible API     |
|  * No public rules  |       |  * JSON-mode responses       |
|  * Private bucket   |       |  * Zod-validated output      |
+---------------------+       +------------------------------+
```

### Key Design Decisions

| Decision | Rationale |
|---|---|
| Server functions for all DB access | Browser never holds a service-role key; `anon` role can't read any table |
| RLS enabled with no permissive policies | Defense-in-depth — even if server code has a bug, DB enforces no access |
| Adaptive polling instead of Realtime | Prevents broadcasting row data; simpler, no WebSocket overhead |
| Two-pass LLM screening | Separation of concerns — extraction vs. evaluation; each pass has focused Zod schema |
| Column projections on list queries | Avoids shipping resume text and full AI fields to table views |
| SSR route loaders | Primes TanStack Query cache server-side; no client-side fetch waterfall |

---

## 6. Data Model

```
jobs 1 ------------- * applications * ------------- 1 candidates
                         (unique job_id + candidate_id)
```

### `jobs`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `user_id` | `uuid` | Nullable (shared workspace) |
| `title` | `text` | Required |
| `department` | `text` | Optional |
| `location` | `text` | Optional |
| `employment_type` | `text` | Optional |
| `description` | `text` | Default `''` |
| `minimum_experience` | `numeric` | Default `0` |
| `required_skills` | `text[]` | Default `{}` |
| `preferred_skills` | `text[]` | Default `{}` |
| `status` | `text` | `draft` or `active` or `closed` |
| `created_at` | `timestamptz` | Auto-set on insert |
| `updated_at` | `timestamptz` | Maintained by trigger |

Indexes: `(user_id, created_at DESC)`, `(user_id, status)`

---

### `candidates`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` | Default `'Unknown candidate'` |
| `email` | `text` | Extracted by LLM; used for dedup |
| `phone` | `text` | Extracted by LLM; used for dedup |
| `location` | `text` | Extracted by LLM |
| `current_role` | `text` | |
| `current_company` | `text` | |
| `years_experience` | `numeric` | |
| `skills` | `text[]` | |
| `education` | `jsonb` | Default `[]` |
| `certifications` | `jsonb` | Default `[]` |
| `experience` | `jsonb` | Default `[]` |
| `parsed_resume` | `text` | Full extracted resume text |
| `resume_path` | `text` | Object path in private `resumes` bucket |
| `resume_filename` | `text` | Original file name |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | Maintained by trigger |

> Duplicate detection normalises `email` and `phone` via `normalizeEmail` / `normalizePhone` (in `data.functions.ts`) and flags matches in the UI.

---

### `applications`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `job_id` | `uuid` FK -> `jobs` | On delete cascade |
| `candidate_id` | `uuid` FK -> `candidates` | On delete cascade |
| `match_score` | `numeric` | 1-10 from LLM; displayed as 100-point |
| `match_label` | `text` | Verdict label (e.g., "Strong Match") |
| `match_summary` | `text` | Human-readable rationale |
| `matching_skills` | `text[]` | |
| `missing_skills` | `text[]` | |
| `experience_analysis` | `text` | |
| `education_analysis` | `text` | |
| `requirement_coverage` | `jsonb` | Per-requirement met/unmet detail |
| `status` | `text` | `uploaded` -> `screened` -> `shortlisted` / `rejected` / `failed` |
| `error_message` | `text` | Set when a screening run fails |
| `recruiter_notes` | `text` | |
| `source_filename` | `text` | |
| `screened_at` | `timestamptz` | |
| `shortlisted_at` | `timestamptz` | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

Unique constraint: `(job_id, candidate_id)`.
Indexes: `(job_id, match_score DESC NULLS LAST)` for ranking, `(user_id, status)` for filters.

---

### Storage

| Bucket | Visibility | Access Pattern |
|---|---|---|
| `resumes` | Private | Upload via signed upload URL (browser -> Supabase directly); read via service-role or short-lived signed URL (5 min) |

---

## 7. API Documentation

Three API surfaces are involved:

1. **Internal** — TanStack `createServerFn` typed RPC
2. **Supabase** — PostgREST + Storage (server-side only)
3. **Lovable AI Gateway** — External LLM endpoint

---

### 7.1 Internal Server Functions

All server functions are defined with `createServerFn` and invoked from the browser as typed RPC. Every input is validated with **Zod**. The Supabase service-role client is dynamically imported inside each handler so it is never included in the client bundle.

---

#### `src/lib/data.functions.ts` — Data CRUD

| Function | HTTP | Input | Returns |
|---|---|---|---|
| `listJobs` | GET | — | Up to 500 jobs, newest first (list projection) |
| `listOpenJobs` | GET | — | Up to 200 `active` jobs (used by public apply page) |
| `getJob` | GET | `{ jobId: uuid }` | Full job row |
| `listApplications` | GET | `{ jobId?: uuid, status?: string }` | Applications joined with candidate + job (list projection) |
| `getApplication` | GET | `{ applicationId: uuid }` | Full application, candidate, and job |
| `listCandidates` | GET | — | Candidate index across all jobs |
| `createJob` | POST | `{ title, description, required_skills, preferred_skills, requirements, minimum_experience, maximum_experience, location, employment_type, status }` | Created job row |
| `setJobStatus` | POST | `{ jobId: uuid, status: 'draft' or 'active' or 'closed' }` | Updated job row |
| `deleteJob` | POST | `{ jobId: uuid }` | `{ ok: true }` |
| `setApplicationStatus` | POST | `{ applicationId: uuid, status: string }` | Updated application row |
| `saveRecruiterNotes` | POST | `{ applicationId: uuid, notes: string }` | `{ ok: true }` |
| `createResumeUpload` | POST | `{ filename: string, contentType: string }` | `{ path, signedUrl, token }` — signed upload URL for direct browser upload |
| `listDuplicateCandidates` | GET | — | Candidate groups sharing a normalised email or phone |

---

#### `src/lib/candidate.functions.ts` — Public Application

| Function | HTTP | Input | Behaviour |
|---|---|---|---|
| `applyToJob` | POST | `{ jobId: uuid, resumePath: string, filename: string, fullName?: string }` | Rate-limited (5 / 10 min). Verifies the job is `active`, creates/deduplicates the candidate row, creates the application with status `uploaded`, then triggers screening. Returns `{ ok: false, error: string }` instead of throwing on user-facing failures. |

---

#### `src/lib/screening.functions.ts` — Screening & Resume URL

| Function | HTTP | Input | Behaviour |
|---|---|---|---|
| `screenApplication` | POST | `{ applicationId: uuid }` | Rate-limited (20 / 10 min). Runs the full extraction + evaluation pipeline and persists results. Returns `{ ok: true, score: number }` or `{ ok: false, error: string }`. |
| `getResumeUrl` | POST | `{ candidateId: uuid }` | Returns a 5-minute signed download URL for the candidate's resume, or `null` if no resume is stored. |

---

### 7.2 Supabase APIs (Server-Side Only)

Called through `@supabase/supabase-js` with `SUPABASE_SERVICE_ROLE_KEY`.

#### PostgREST (Data API)

| Table | Operations |
|---|---|
| `jobs` | select, insert, update, delete |
| `candidates` | select, insert, update (upsert on dedup) |
| `applications` | select, insert, update |

> **Security:** RLS is enabled on every table with **no permissive policies**. `anon` and `authenticated` roles hold no table grants.

#### Storage API

| Method | Usage |
|---|---|
| `createSignedUploadUrl(path)` | Browser uploads the file directly; no credential is exposed to the client |
| `download(path)` | Server-side download during screening pipeline |
| `createSignedUrl(path, 300)` | Generates a 5-minute download link for recruiters to view resumes |

> Supabase Realtime is **not** enabled for `applications`. The UI polls `listApplications` while any row is pending, then stops.

---

### 7.3 Lovable AI Gateway (External)

**Source file:** `src/lib/llm.server.ts`

#### Endpoint

```
POST https://ai.gateway.lovable.dev/v1/chat/completions
```

#### Request Headers

```
Authorization: Bearer ${LOVABLE_API_KEY}
Content-Type: application/json
```

#### Request Body

```json
{
  "model": "google/gemini-2.5-flash",
  "temperature": 0.1,
  "response_format": { "type": "json_object" },
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user",   "content": "..." }
  ]
}
```

#### Two Calls Per Screening Run

**Call 1 — Resume Extraction**

Expected JSON response:
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+1-555-0100",
  "location": "San Francisco, CA",
  "current_role": "Senior Engineer",
  "current_company": "Acme Corp",
  "years_experience": 5,
  "skills": ["TypeScript", "React", "Node.js"],
  "education": [
    { "degree": "B.Sc Computer Science", "institution": "MIT", "year": 2018 }
  ],
  "summary": "Experienced full-stack engineer..."
}
```

**Call 2 — Job Evaluation**

Expected JSON response:
```json
{
  "match_score": 8,
  "match_label": "Strong Match",
  "match_summary": "Candidate demonstrates strong alignment...",
  "strengths": ["5 years React experience", "TypeScript proficiency"],
  "gaps": ["No cloud infrastructure experience"],
  "matching_skills": ["React", "TypeScript"],
  "missing_skills": ["AWS", "Kubernetes"]
}
```

#### Error Handling

| HTTP Status | Surfaced Message |
|---|---|
| `429` | "Screening is rate limited right now. Try again shortly." |
| `402` | "Screening credits are exhausted for this workspace." |
| Other non-2xx | Generic failure message; status + body logged server-side |

> `LOVABLE_API_KEY` is read via `process.env` inside the server handler and is **never** sent to the browser.

---

### 7.4 Resume Text Extraction

**Source file:** `src/lib/resume-extract.server.ts`

| File Type | Extraction Method |
|---|---|
| `.pdf` | `unpdf` -> `extractText()` |
| `.docx` | `fflate` -> unzip -> parse `word/document.xml` text nodes |
| `.txt` | UTF-8 decode |

Unsupported types and empty extractions fail the run with a readable error message rather than passing garbage to the LLM.

---

## 8. Environment Variables

### Client-Visible (Safe — prefixed `VITE_`)

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
VITE_SUPABASE_PROJECT_ID=<project-ref>
```

### Server-Only (Secret — never commit to source control)

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # Full DB access — keep secret
LOVABLE_API_KEY=...                # Authorizes AI gateway screening calls
```

> **Where to get keys:**
> - Supabase keys: Dashboard -> Project Settings -> API
> - `LOVABLE_API_KEY`: Only works on Lovable hosting. For self-hosting, replace `src/lib/llm.server.ts` with a direct Gemini or OpenAI key.

---

## 9. Rate Limiting

**Source file:** `src/lib/rate-limit.server.ts`

In-memory sliding windows, keyed by caller fingerprint. Resets on deploy or cold start.

| Bucket | Limit | Applied To |
|---|---|---|
| `apply` | 5 requests / 10 minutes | `applyToJob` (public endpoint) |
| `screen` | 20 requests / 10 minutes | `screenApplication` |

Exceeding a limit returns a friendly, user-facing message with a retry hint — never a raw HTTP 429 error.

---

## 10. Security Model

| Area | Implementation |
|---|---|
| **Database access** | All reads/writes go through server functions using `SUPABASE_SERVICE_ROLE_KEY`. Browser never holds a key capable of reading data. |
| **Row Level Security** | RLS enabled on every table with **no permissive policies**. `anon` and `authenticated` hold no table grants. |
| **File storage** | `resumes` bucket is private. Uploads use signed upload URLs. Downloads use 5-minute signed URLs. |
| **Realtime** | Not enabled on `applications`. UI polls instead — no row data broadcast over WebSocket. |
| **Input validation** | Every server function validates input with **Zod** before any DB operation. |
| **Public rate limiting** | In-memory sliding window limits prevent abuse of the apply and screening endpoints. |
| **API key exposure** | `LOVABLE_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-only; Vite's `VITE_` prefix convention prevents accidental client bundle inclusion. |

---

## 11. AI Screening Pipeline

```
Candidate submits form
        |
        v
createResumeUpload  ------>  signed upload URL
        |                           |
        |                           v
        |                  Browser PUTs resume file
        |                  directly to private Supabase bucket
        |
        v
applyToJob
  +-- Verify job is `active`
  +-- Deduplicate candidate (normalise email/phone)
  +-- Insert candidate row (or reuse existing)
  +-- Insert application row (status: `uploaded`)
        |
        v
screenApplication  (async, rate-limited)
  +-- Download resume from private bucket (service-role)
  +-- Extract text  (unpdf / fflate / UTF-8)
  +-- LLM Pass 1:  Resume Extraction  -> Zod validate -> persist to candidates
  +-- LLM Pass 2:  Job Evaluation     -> Zod validate -> persist to applications
  +-- Update application status -> `screened`
        |
        v
UI polls listApplications
  +-- Stops polling when no row has status `uploaded`
```

---

## 12. Score System

| Dimension | Weight | Source |
|---|---|---|
| Required skills coverage | **40%** | `matching_skills` vs `required_skills` |
| Requirement coverage | **30%** | `requirement_coverage` jsonb (met/unmet) |
| Experience match | **20%** | `years_experience` vs `minimum_experience` |
| Preferred skills coverage | **10%** | `matching_skills` vs `preferred_skills` |

- **Raw score:** 1–10 (stored in `applications.match_score`)
- **Display scale:** multiplied by 10 via `formatScore100` in `src/lib/domain.ts` — shown as `/100`
- **ScoreBreakdown component:** Frosted hover card that explains each dimension; positioned to the right with collision padding to stay on-screen.

---

## 13. Local Development

### Prerequisites
- Node.js >= 18 or Bun
- Supabase project with schema applied from `supabase/migrations/`
- A Lovable API key (or a self-hosted LLM key)

### Steps

```sh
# 1. Clone the repository
git clone <this-repository-url>
cd SmartAiResumeScreener

# 2. Install dependencies
npm install
# or: bun install

# 3. Configure environment
cp .env.example .env
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY,
# SUPABASE_SERVICE_ROLE_KEY, LOVABLE_API_KEY

# 4. Apply database schema
# Run supabase/migrations/ files in filename order via Supabase Dashboard
# or: supabase db push  (if using Supabase CLI)

# 5. Start the dev server
npm run dev
# -> http://localhost:8080
```

### Available Scripts

| Script | Command | Description |
|---|---|---|
| Dev server | `npm run dev` | Starts Vite dev server at `localhost:8080` |
| Production build | `npm run build` | Builds for production |
| Dev build | `npm run build:dev` | Builds in development mode |
| Preview | `npm run preview` | Previews the production build |
| Unit tests | `npm run test` | Runs Vitest in run mode |
| Watch tests | `npm run test:watch` | Runs Vitest in watch mode |
| Lint | `npm run lint` | ESLint across the whole project |
| Format | `npm run format` | Prettier format in place |

---

## 14. Testing

### Unit Tests (Vitest + Testing Library)

```sh
npm run test
```

Covered modules:
- `src/lib/domain.ts` — `formatScore100` and shared type utilities
- `src/lib/screening-filters.ts` — filter predicate logic
- `src/components/app/ScoreBreakdown.tsx` — score hover card rendering
- `src/components/app/ThemeToggle.tsx` — theme switching

### E2E Tests (Playwright)

Playwright scripts drive the running dev server across core flows. Run with the dev server active (`npm run dev`).

Core flows covered:
- Recruiter creates a job and publishes it
- Candidate submits an application with a resume upload
- AI screening completes and score is displayed
- Recruiter shortlists / rejects a candidate

---

*Last updated: August 2026 — Smart AI Resume Screener v1*
