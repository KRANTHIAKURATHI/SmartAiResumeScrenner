# Data model

Postgres on Supabase. All tables live in `public`, have RLS enabled, and are reached only
through server functions using the service role. Migrations are in `supabase/migrations/`
and apply in filename order.

```text
jobs 1───* applications *───1 candidates
              (unique job_id + candidate_id)
```

## `jobs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid | nullable (shared workspace) |
| `title` | text | required |
| `department`, `location`, `employment_type` | text | optional |
| `description` | text | default `''` |
| `minimum_experience` | numeric | default 0 |
| `required_skills`, `preferred_skills` | text[] | default `{}` |
| `status` | text | `draft` \| `active` \| `closed`; only `active` is publicly applyable |
| `created_at`, `updated_at` | timestamptz | `updated_at` maintained by trigger |

Indexes: `(user_id, created_at DESC)`, `(user_id, status)`.

## `candidates`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `name` | text | default `'Unknown candidate'` |
| `email`, `phone`, `location` | text | extracted by the model |
| `current_role`, `current_company` | text | quoted identifier `"current_role"` |
| `years_experience` | numeric | |
| `skills` | text[] | |
| `education`, `certifications`, `experience` | jsonb | default `[]` |
| `parsed_resume` | text | full extracted resume text |
| `resume_path`, `resume_filename` | text | object path in the private `resumes` bucket |
| `created_at`, `updated_at` | timestamptz | |

Duplicate detection compares normalized email and phone (`normalizeEmail`, `normalizePhone`
in `data.functions.ts`) and flags matching candidates in the UI.

## `applications`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `job_id` | uuid FK → `jobs` | on delete cascade |
| `candidate_id` | uuid FK → `candidates` | on delete cascade |
| `match_score` | numeric | 1–10 from the model; displayed on a 100-point scale |
| `match_label`, `match_summary` | text | verdict + rationale |
| `matching_skills`, `missing_skills` | text[] | |
| `experience_analysis`, `education_analysis` | text | |
| `requirement_coverage` | jsonb | per-requirement met/unmet detail |
| `status` | text | `uploaded` → `screened` → `shortlisted` / `rejected`; `failed` on error |
| `error_message` | text | set when a screening run fails |
| `recruiter_notes` | text | |
| `source_filename` | text | |
| `screened_at`, `shortlisted_at` | timestamptz | |
| `created_at`, `updated_at` | timestamptz | |

Unique constraint `(job_id, candidate_id)`. Indexes include
`(job_id, match_score DESC NULLS LAST)` for ranking and `(user_id, status)` for filters.

## `profiles`

Retained from the earlier authenticated build (`user_id`, `full_name`, `email`, `role`) with
an owner-only policy. Not used by the current shared-workspace UI.

## Triggers

- `set_updated_at()` — `BEFORE UPDATE` on every table.
- `handle_new_user()` — creates a profile row when an auth user is inserted.

## Storage

Private bucket `resumes`. Public policies were dropped; access is exclusively via
service-role reads and signed upload/download URLs generated in server functions.

## Security posture

Later migrations deliberately revoked `anon` and `authenticated` table grants and dropped
permissive policies. "RLS enabled, no policy" is the intended end state: nothing is
reachable with the publishable key, and every read/write passes through validated,
rate-limited server functions.
