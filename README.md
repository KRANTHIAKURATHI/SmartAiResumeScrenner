# Smart Resume Screener

An editorial, analytics-first resume screening workspace. Recruiters publish roles, candidates submit PDF/DOCX resumes, and an LLM screens every resume against the role and produces a structured, explainable match score.

Built with TanStack Start (React 19 + Vite 7), Supabase (Postgres + Storage), and the Lovable AI Gateway (Gemini).

- [Architecture](docs/ARCHITECTURE.md)
- [APIs & server functions](docs/API.md)
- [Data model](docs/DATA-MODEL.md)

---

## Features

**Jobs**
- Create roles with description, required skills, preferred skills, requirement list, min/max experience, location and employment type.
- Draft / active / closed lifecycle; only `active` roles appear on the public apply page.
- Job detail view with a ranked candidate table.

**Applications & resumes**
- Public apply page: candidate details + resume upload (PDF, DOCX, TXT).
- Resumes are stored in a **private** Supabase Storage bucket; access is only ever through short-lived signed URLs.
- Server-side text extraction: `unpdf` for PDF, `fflate` for DOCX (`word/document.xml`), plain read for TXT.

**AI screening**
- One LLM pass extracts structured candidate data (name, email, phone, years of experience, skills, education, summary).
- A second pass scores the resume against the job: match score 1–10, plus strengths, gaps, matched/missing skills and a verdict.
- Scores are surfaced on a 100-point scale (`formatScore100`) with a hover-card **score breakdown** explaining the weighting: required skills 40%, requirement coverage 30%, experience 20%, preferred skills 10%.

**Ranking, filtering, review**
- Ranked candidate lists per job, plus a cross-job candidate index and a shortlist view.
- Structured screening filters: score band, experience range, skills, status.
- Duplicate candidate detection via normalized email/phone matching, flagged inline.
- Status workflow (new → screened → shortlisted / rejected) and recruiter notes per application.
- Adaptive polling refreshes application rows only while screening work is pending.

**Platform**
- All database and storage access runs through server functions using the service role — the browser never talks to Postgres directly, and no table is exposed to `anon`.
- In-memory rate limiting on public endpoints (applications: 5 / 10 min, screening: 20 / 10 min).
- Light/dark theme with a pre-hydration anti-flash script.
- Unit tests with Vitest + Testing Library.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | TanStack Start v1 (React 19, SSR + server functions) |
| Router | TanStack Router (file-based, `src/routes`) |
| Build | Vite 7 |
| Data fetching | TanStack Query v5 |
| Styling | Tailwind CSS v4 (`src/styles.css` theme tokens) |
| UI primitives | shadcn/ui + Radix UI, lucide-react icons |
| Type safety | TypeScript, Zod validation on every server function input |
| Database | Supabase Postgres (RLS enabled, no public policies) |
| File storage | Supabase Storage — private `resumes` bucket, signed URLs |
| AI | Lovable AI Gateway → `google/gemini-2.5-flash`, JSON-mode, temperature 0.1 |
| Resume parsing | `unpdf` (PDF), `fflate` (DOCX) |
| Testing | Vitest, @testing-library/react, Playwright (E2E scripts) |
| Runtime | Edge/Worker runtime (Cloudflare Workers compatible) |

**Typography & palette:** Instrument Serif for headings and numerals, Work Sans for body/UI; warm paper surfaces, near-black ink text, a single deep ink-red accent.

---

## AI model

- **Model:** `google/gemini-2.5-flash`
- **Endpoint:** `https://ai.gateway.lovable.dev/v1/chat/completions` (OpenAI-compatible chat completions)
- **Settings:** `temperature: 0.1`, `response_format: { type: "json_object" }`
- **Two prompts:** resume extraction, then job-vs-resume evaluation. Both responses are parsed and validated with Zod before anything is written to the database.
- **Failure handling:** gateway `429` → "rate limited", `402` → "credits exhausted"; all other failures are logged server-side and returned as a safe message.

---

## Project structure

```
src/
  routes/
    __root.tsx              root layout, head metadata, theme script
    index.tsx               public landing page
    _app/                   app shell layout (pathless)
      overview.tsx          metrics + recent activity
      jobs/index.tsx        jobs table
      jobs/new.tsx          create job form
      jobs/$jobId.tsx       job detail + ranked candidates
      applications/$applicationId.tsx   candidate profile + score breakdown
      candidates.tsx        cross-job candidate index
      shortlist.tsx         shortlisted candidates
      apply.tsx             public candidate portal
      settings.tsx
  lib/
    data.functions.ts       CRUD server functions (jobs, applications, candidates, uploads)
    candidate.functions.ts  public application submission
    screening.functions.ts  screening trigger + signed resume URL
    screening.server.ts     screening pipeline orchestration
    llm.server.ts           AI gateway client + Zod schemas
    resume-extract.server.ts PDF/DOCX/TXT text extraction
    rate-limit.server.ts    in-memory rate limiter
    queries.ts              TanStack Query options
    screening-filters.ts    filter logic (unit tested)
    domain.ts               shared types, score formatting
  components/app/           AppShell, ResumeUpload, ScoreBreakdown, ScreeningFilters, primitives
supabase/migrations/        SQL migrations (schema, RLS lockdown, storage policies)
docs/                       architecture, API and data-model documentation
```

---

## Environment variables

Client-visible (safe):

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
```

Server-only (secret — never commit):

```
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
LOVABLE_API_KEY          # authorizes AI gateway screening calls
```

Supabase keys come from Supabase Dashboard → Project Settings → API. `LOVABLE_API_KEY` only works on Lovable hosting; self-hosting elsewhere means swapping `src/lib/llm.server.ts` for a direct Gemini/OpenAI key.

---

## Local development

```sh
git clone <this-repository-url>
cd <repository-name>
npm install
cp .env.example .env   # then fill in the values above
npm run dev            # http://localhost:8080
```

Other scripts:

```sh
npm run build      # production build
npm run test       # unit tests (Vitest)
npm run lint       # ESLint
```

Database schema is applied from `supabase/migrations/` in filename order.

---

## Security model

- RLS is enabled on every table with **no permissive policies**; `anon` and `authenticated` have no table grants. Reads and writes only happen inside server functions using the service-role client.
- The `resumes` bucket is private. Uploads use signed upload URLs; downloads use short-lived signed URLs.
- Realtime is not enabled on `applications` — the UI polls a server function instead, so no row data is broadcast.
- Every server function validates input with Zod; public endpoints are rate limited.
