# Architecture

## Overview

```text
Browser (React 19 / TanStack Router + Query)
        |
        |  typed RPC (createServerFn)  — no direct DB access
        v
TanStack Start server runtime (edge / Worker)
        |                          |
        |  service-role client     |  HTTPS
        v                          v
Supabase Postgres + Storage    Lovable AI Gateway → google/gemini-2.5-flash
```

The browser never holds a database credential capable of reading data. `VITE_SUPABASE_*`
values exist for client construction only; all jobs/candidates/applications traffic goes
through server functions that use `SUPABASE_SERVICE_ROLE_KEY` on the server.

## Layers

**Routing / rendering** — file-based routes under `src/routes`. `__root.tsx` holds head
metadata, fonts, favicon and the pre-hydration theme script. `src/routes/_app/route.tsx`
is a pathless layout rendering `AppShell` around `<Outlet />`. `src/routes/index.tsx` is
the public landing page.

**Data access** — `src/lib/queries.ts` exposes TanStack Query `queryOptions`. Route
loaders call `ensureQueryData`, components call `useSuspenseQuery`/`useQuery`. Default
`staleTime` is 30s and `defaultPreload: "intent"` warms routes on link hover.

**Server functions** — `src/lib/*.functions.ts` modules are thin wrappers: imports, Zod
validators, and `createServerFn(...).handler(...)`. Heavy logic lives in `*.server.ts`
siblings (`screening.server.ts`, `llm.server.ts`, `resume-extract.server.ts`,
`rate-limit.server.ts`) which are never reachable from client bundles.

**List projections** — list endpoints select narrowed column sets
(`APPLICATION_LIST_CANDIDATE`, `JOB_LIST_SELECT`) so resume text and long AI fields are
not shipped to table views.

## Screening pipeline

1. Candidate submits the apply form → `applyToJob`.
2. `createResumeUpload` issues a signed upload URL; the browser PUTs the file straight to
   the private `resumes` bucket.
3. `applyToJob` inserts the candidate (deduplicated on normalized email) and the
   application row with status `new`.
4. `screenApplication` runs the pipeline in `screening.server.ts`:
   - download the resume with the service-role client
   - extract text (`unpdf` / `fflate` / plain text)
   - LLM pass 1: structured resume extraction
   - LLM pass 2: job-vs-resume evaluation → score 1–10, strengths, gaps, matched and
     missing skills, verdict
   - validate both payloads with Zod and persist to `applications` / `candidates`
5. UI polls `listApplications` while any row is still pending, then stops.

## Score presentation

The stored score is 1–10. `formatScore100` in `src/lib/domain.ts` scales it for display.
`ScoreBreakdown.tsx` renders a frosted hover card explaining the weighting — required
skills 40%, requirement coverage 30%, experience 20%, preferred skills 10% — positioned
to the right with collision padding so it never clips off-screen.

## Performance

- Route-level SSR loaders prime the query cache, avoiding client fetch waterfalls.
- `defaultPreload: "intent"` + 30s `staleTime`.
- Column projections on list queries.
- Adaptive polling instead of always-on realtime.

## Testing

- Unit: Vitest + Testing Library covering `domain.ts`, `screening-filters.ts`,
  `ScoreBreakdown.tsx`, `ThemeToggle.tsx` (`npm run test`).
- E2E: Playwright scripts driving the running dev server across the core flows.
