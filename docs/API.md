# APIs

Three API surfaces are involved: the app's own typed server functions, Supabase's REST/Storage
APIs (called only from the server), and the Lovable AI Gateway.

---

## 1. Internal API — TanStack server functions

Defined with `createServerFn` and called from the browser as typed RPC (`useServerFn`,
loaders, or query options). Every input is validated with Zod. Every handler loads the
service-role Supabase client with a dynamic import so it never enters the client bundle.

### `src/lib/data.functions.ts`

| Function | Method | Input | Returns |
| --- | --- | --- | --- |
| `listJobs` | GET | – | up to 500 jobs, newest first (list projection) |
| `listOpenJobs` | GET | – | up to 200 `active` jobs (public apply page) |
| `getJob` | GET | `{ jobId: uuid }` | full job row |
| `listApplications` | GET | optional `{ jobId?, status? }` | applications joined with candidate + job (list projection) |
| `getApplication` | GET | `{ applicationId: uuid }` | full application, candidate and job |
| `listCandidates` | GET | – | candidate index |
| `createJob` | POST | job fields (title, description, skills, requirements, experience range, location, employment type, status) | created job |
| `setJobStatus` | POST | `{ jobId, status: draft \| active \| closed }` | updated job |
| `deleteJob` | POST | `{ jobId }` | `{ ok }` |
| `setApplicationStatus` | POST | `{ applicationId, status }` | updated application |
| `saveRecruiterNotes` | POST | `{ applicationId, notes }` | `{ ok }` |
| `createResumeUpload` | POST | `{ filename, contentType }` | `{ path, signedUrl, token }` for a direct upload to the private bucket |
| `listDuplicateCandidates` | GET | – | candidate groups sharing a normalized email or phone |

### `src/lib/candidate.functions.ts`

| Function | Method | Input | Behaviour |
| --- | --- | --- | --- |
| `applyToJob` | POST | `{ jobId, resumePath, filename, fullName? }` | rate-limited; verifies the job is `active`, creates the candidate + application (`uploaded`), then triggers screening. Returns `{ ok: false, error }` instead of throwing on user-facing failures. |

### `src/lib/screening.functions.ts`

| Function | Method | Input | Behaviour |
| --- | --- | --- | --- |
| `screenApplication` | POST | `{ applicationId }` | rate-limited; runs the extraction + evaluation pipeline and persists results. Returns `{ ok, score }` or `{ ok: false, error }`. |
| `getResumeUrl` | POST | `{ candidateId }` | returns a signed resume URL valid for 5 minutes, or `null`. |

### Rate limits (`src/lib/rate-limit.server.ts`)

In-memory sliding windows keyed by a caller fingerprint. Resets on deploy/cold start.

| Bucket | Limit |
| --- | --- |
| `apply` | 5 requests / 10 minutes |
| `screen` | 20 requests / 10 minutes |

Exceeding a limit returns a friendly message plus a retry hint — never a raw 429.

---

## 2. Supabase APIs (server-side only)

Called through `@supabase/supabase-js` with the service-role key from
`@/integrations/supabase/client.server`.

**Data API (PostgREST)** — `from(...).select/insert/update/delete` against `jobs`,
`candidates`, `applications`. RLS is enabled with no permissive policies and `anon` /
`authenticated` hold no table grants, so these calls are only possible from the server.

**Storage API** — private bucket `resumes`:
- `createSignedUploadUrl(path)` — browser uploads the file directly, no credential exposure.
- `download(path)` — server-side read during screening.
- `createSignedUrl(path, 300)` — 5-minute view link for recruiters.

No Supabase Realtime subscription is used; `public.applications` was removed from the
realtime publication and the UI polls `listApplications` while screening is pending.

---

## 3. Lovable AI Gateway (external)

`src/lib/llm.server.ts`

```
POST https://ai.gateway.lovable.dev/v1/chat/completions
Authorization: Bearer ${LOVABLE_API_KEY}
Content-Type: application/json

{
  "model": "google/gemini-2.5-flash",
  "temperature": 0.1,
  "response_format": { "type": "json_object" },
  "messages": [ { "role": "system", ... }, { "role": "user", ... } ]
}
```

OpenAI-compatible chat completions. Two calls per screening run:

1. **Resume extraction** → `{ name, email, phone, location, current_role, current_company, years_experience, skills[], education[], summary }`
2. **Job evaluation** → `{ match_score (1–10), match_label, match_summary, strengths[], gaps[], matching_skills[], missing_skills[] }`

Both responses are parsed as JSON and validated with Zod before persistence; invalid
payloads fail the run and record `error_message` on the application.

Error mapping:

| Status | Surfaced message |
| --- | --- |
| 429 | "Screening is rate limited right now. Try again shortly." |
| 402 | "Screening credits are exhausted for this workspace." |
| other non-2xx | generic failure message; status + body logged server-side |

`LOVABLE_API_KEY` is read inside the handler via `process.env` and is never exposed to the
browser.

---

## 4. Resume text extraction

`src/lib/resume-extract.server.ts`

| Input | Method |
| --- | --- |
| `.pdf` | `unpdf` → `extractText` |
| `.docx` | `fflate` unzip → parse `word/document.xml` text nodes |
| `.txt` | UTF-8 decode |

Unsupported types and empty extractions fail the run with a readable error rather than
sending garbage to the model.
