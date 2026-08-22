# Smart Resume Screener

A working recruiter tool: create a job, upload resumes, screen them semantically with an LLM, rank and shortlist candidates. Every screen is wired to real data — no mock UI.

## Visual identity

Editorial-analytical, not SaaS-template. Instrument Serif for headings and numerics, Work Sans for UI text and tables.

- Warm off-white paper surface, near-black ink text, one accent: a deep ink-red used only for the active state, primary action, and score emphasis.
- Structure comes from hairline rules, generous left-aligned column grids, and small-caps section labels — not cards. Cards appear only for genuinely grouped panels.
- Scores render as typographic figures (`9.2` in serif, `/10` muted, small label "Excellent match") plus a thin horizontal bar. No gauges, no gradients, no glow, no sparkles/robot imagery, minimal shadow, tight radii (2-4px).
- Dense but airy tables with sticky headers, subtle row hover, aligned numeric columns.
- Compact 220px left sidebar on desktop (Overview, Jobs, Candidates, Shortlist; Settings, Profile below a rule). Tablet: icon+label condensed. Mobile: top bar with a sheet menu, and tables become stacked record rows rather than shrunken tables.

## Screens

1. **Auth** — sign up, sign in, forgot password, logout. Bare, centered, typographic. Redirect to Overview.
2. **Overview** — one compact inline metric row (Active jobs, Screened, Shortlisted, Avg match) as text-forward figures on a divided strip; then Recent screening activity list (Candidate → Job → Score → Status → Time), Active jobs table, Top candidates.
3. **Jobs** — heading + description + `New Job`, search, status filter, sort, table (Job, Department, Location, Candidates, Avg match, Status, Created, Actions).
4. **Create job** — sectioned form (Position / Requirements / Job description) with skill chips input, submits and lands on the job's screening view.
5. **Job detail** — job header, screening summary strip, upload area, candidate ranking table.
6. **Upload** — compact drag-and-drop strip ("Drop resumes here — PDF or text · Browse files"), multi-file, client-side type/size validation, file list with name, size, status, remove, then `Start Screening`.
7. **Screening progress** — real per-file states driven by row status in the database (queued → parsing → analyzing → done/failed), each step labelled; failed files show a plain reason and can be retried.
8. **Candidate ranking** (the centerpiece) — #, Candidate, Current role, Experience, Key skills, Match, Status, Actions. Sort by score/experience/name, search, filters for score band, status, skill. Row click opens the profile.
9. **Candidate profile** — identity block, score, status, actions (Shortlist / Reject / Mark reviewed); Match analysis with horizontal bars for skills, experience, education, requirement coverage; matching skills as compact labels; neutral "Missing or weak areas"; "Why this candidate matches" justification; chronological experience; education and certifications; View resume via a short-lived signed URL.
10. **Candidates** — global search across name, skill, title, company, location, paginated.
11. **Shortlist** — Candidate, Job, Match score, Current role, Status, Added, Actions (open, remove).
12. **Settings / Profile** — display name, email, screening defaults.

Skeleton loaders (not spinners) for dashboard, tables, and profile. Written empty states for jobs, candidates, shortlist, search. Human-readable error messages for invalid/unsupported files, upload failure, parse failure, AI failure, auth and network problems — never raw errors. Starting state is empty: no demo rows.

## Data and security

Tables: `profiles`, `jobs`, `candidates`, `applications` (per your schema), plus a `resume_path`-backed private storage bucket. Every table gets grants, RLS enabled, and owner-only policies keyed to `auth.uid()`; storage policies restrict objects to the owner's `user_id/` prefix. Indexes on `jobs.user_id`, `candidates.user_id`, `applications.job_id`, `applications.candidate_id`, and `applications.match_score`. Auto-created profile row on signup via trigger.

## Technical notes

- This project runs on TanStack Start, so server-side work uses authenticated server functions (`createServerFn` + `requireSupabaseAuth`) rather than Supabase Edge Functions. Same guarantees: authenticated caller, RLS-scoped client, secrets stay server-side, LLM key never reaches the browser.
- PDF text is extracted server-side with an edge-compatible extractor (`unpdf`); `.txt` is read directly. Image-only/scanned PDFs are rejected with a clear message instead of a silent empty parse.
- LLM calls go through the Lovable AI Gateway (`google/gemini-2.5-flash`) in two steps per resume: structured profile extraction, then job-vs-resume matching. Both use strict JSON schemas; responses are Zod-validated and the score clamped to 1-10 before saving. Invalid output marks the application `failed` rather than rendering garbage.
- Prompts forbid inventing skills, roles, education, or personal traits; unknown fields must be returned as "Not found in resume". Name, gender, age, ethnicity, religion, photos and similar characteristics are explicitly excluded from scoring.
- Screening runs per resume with bounded concurrency, writing status per row so the progress UI reflects true backend state.
- Reads use TanStack Query with route-loader priming; status changes mutate a single row and update cache optimistically instead of refetching the whole list. Candidate lists paginate server-side.
- Code split into `src/components/ui` primitives, feature components, `src/lib/*.functions.ts` server functions, `*.server.ts` helpers (LLM client, PDF parse), typed DB access, and shared types generated from the schema.

## Order of work

1. Migration: schema, grants, RLS, indexes, profile trigger, private resumes bucket + storage policies.
2. Design system tokens, fonts, app shell, navigation, auth screens and route gate.
3. Jobs list, create job, job detail.
4. Upload, parse + match server functions, screening progress.
5. Ranking table, candidate profile, resume viewing.
6. Candidates search, shortlist, settings/profile, then a screen-by-screen design and completeness pass.
