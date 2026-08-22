import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Every read and write goes through the server. The browser has no direct
 * Data API or Storage access to jobs, candidates, applications or resume
 * files, so candidate PII and evaluations are never reachable from a client
 * holding only the publishable key.
 */

/**
 * List payloads stay lean on purpose: parsed resume text, raw experience and
 * education blobs are megabytes across a few hundred rows and no list screen
 * renders them. Detail views fetch the full row.
 */
const APPLICATION_LIST_CANDIDATE =
  "candidate:candidates(id, name, email, phone, location, current_role, current_company, years_experience, skills, resume_filename, resume_path, created_at)";

const APPLICATION_SELECT = [
  "id, job_id, candidate_id, match_score, match_label, match_summary, matching_skills, missing_skills,",
  "status, error_message, source_filename, screened_at, shortlisted_at, created_at, updated_at,",
  APPLICATION_LIST_CANDIDATE,
  ", job:jobs(id, title, department, location, required_skills, preferred_skills, minimum_experience, status)",
].join(" ");

const JOB_LIST_SELECT =
  "id, title, department, location, employment_type, minimum_experience, required_skills, preferred_skills, status, created_at, updated_at";

const uuid = z.string().uuid();

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const listJobs = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data, error } = await db
    .from("jobs")
    .select(JOB_LIST_SELECT)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listOpenJobs = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data, error } = await db
    .from("jobs")
    .select(JOB_LIST_SELECT)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getJob = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ jobId: uuid }).parse(data))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: job, error } = await db.from("jobs").select("*").eq("id", data.jobId).maybeSingle();
    if (error) throw new Error(error.message);
    return job ?? null;
  });

export const listApplications = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({ jobId: uuid.optional(), status: z.array(z.string().max(40)).max(20).optional() })
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    let query = db.from("applications").select(APPLICATION_SELECT);
    if (data.jobId) query = query.eq("job_id", data.jobId);
    if (data.status?.length) query = query.in("status", data.status);
    const { data: rows, error } = await query.order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getApplication = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ applicationId: uuid }).parse(data))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row, error } = await db
      .from("applications")
      .select("*, candidate:candidates(*), job:jobs(*)")
      .eq("id", data.applicationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ?? null;
  });

export const listCandidates = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data, error } = await db
    .from("candidates")
    .select(
      "id, name, email, phone, location, current_role, current_company, years_experience, skills, resume_filename, resume_path, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return data ?? [];
});

const jobInput = z.object({
  title: z.string().trim().min(2).max(160),
  department: z.string().trim().max(120).nullable(),
  location: z.string().trim().max(120).nullable(),
  employment_type: z.string().trim().max(60).nullable(),
  minimum_experience: z.number().min(0).max(60),
  required_skills: z.array(z.string().trim().min(1).max(80)).min(1).max(60),
  preferred_skills: z.array(z.string().trim().min(1).max(80)).max(60),
  description: z.string().trim().min(40).max(20000),
});

export const createJob = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => jobInput.parse(data))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row, error } = await db.from("jobs").insert(data).select("id").single();
    if (error || !row) throw new Error(error?.message ?? "The job could not be saved.");
    return { id: row.id };
  });

const jobStatuses = ["active", "paused", "closed"] as const;

export const setJobStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ jobId: uuid, status: z.enum(jobStatuses) }).parse(data))
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.from("jobs").update({ status: data.status }).eq("id", data.jobId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteJob = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ jobId: uuid }).parse(data))
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.from("jobs").delete().eq("id", data.jobId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const applicationStatuses = [
  "uploaded",
  "processing",
  "screened",
  "reviewing",
  "shortlisted",
  "rejected",
  "error",
] as const;

export const setApplicationStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ applicationId: uuid, status: z.enum(applicationStatuses) }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const patch: { status: string; shortlisted_at?: string } = { status: data.status };
    if (data.status === "shortlisted") patch.shortlisted_at = new Date().toISOString();
    const { error } = await db.from("applications").update(patch).eq("id", data.applicationId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const saveRecruiterNotes = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ applicationId: uuid, notes: z.string().max(10000) }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db
      .from("applications")
      .update({ recruiter_notes: data.notes })
      .eq("id", data.applicationId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Issues a one-time signed upload URL for a server-chosen path inside the
 * private resumes bucket. The client never gets blanket bucket access and
 * cannot choose or overwrite an arbitrary object path.
 */
export const createResumeUpload = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        filename: z.string().trim().min(1).max(255),
        folder: z.enum(["uploads", "applications"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    const path = `${data.folder}/${crypto.randomUUID()}-${safeName}`;
    const { data: signed, error } = await db.storage.from("resumes").createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Upload could not be prepared.");
    return { path, token: signed.token };
  });

/** Normalises a contact value so "A@B.com " and "a@b.com" collide. */
function normalizeEmail(value: string | null) {
  return value ? value.trim().toLowerCase() : null;
}

/** Digits only, last 10 — tolerates +91, spaces, dashes and country prefixes. */
function normalizePhone(value: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 ? digits.slice(-10) : null;
}

export type DuplicateGroup = {
  key: string;
  matchedOn: "email" | "phone";
  value: string;
  candidates: { id: string; name: string; email: string | null; phone: string | null; created_at: string }[];
};

/**
 * Groups candidate records that are almost certainly the same human: same
 * email, or same phone number once formatting is stripped. Detection only —
 * nothing is merged or deleted automatically.
 */
export const listDuplicateCandidates = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data, error } = await db
    .from("candidates")
    .select("id, name, email, phone, created_at")
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error) throw new Error(error.message);

  const buckets = new Map<string, DuplicateGroup>();
  for (const row of data ?? []) {
    const email = normalizeEmail(row.email);
    const phone = normalizePhone(row.phone);
    const keys: { matchedOn: "email" | "phone"; value: string }[] = [];
    if (email) keys.push({ matchedOn: "email", value: email });
    if (phone) keys.push({ matchedOn: "phone", value: phone });
    for (const k of keys) {
      const key = `${k.matchedOn}:${k.value}`;
      const group = buckets.get(key) ?? { key, matchedOn: k.matchedOn, value: k.value, candidates: [] };
      group.candidates.push(row);
      buckets.set(key, group);
    }
  }

  return [...buckets.values()]
    .filter((g) => g.candidates.length > 1)
    .sort((a, b) => b.candidates.length - a.candidates.length) as DuplicateGroup[];
});
