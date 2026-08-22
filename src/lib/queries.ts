import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type JobRow = {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  employment_type: string | null;
  description: string;
  minimum_experience: number;
  required_skills: string[];
  preferred_skills: string[];
  status: string;
  created_at: string;
  updated_at: string;
};

export type CandidateRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  current_role: string | null;
  current_company: string | null;
  years_experience: number | null;
  skills: string[];
  education: unknown;
  certifications: unknown;
  experience: unknown;
  resume_filename: string | null;
  resume_path: string | null;
  parsed_resume: string | null;
  created_at: string;
};

export type ApplicationRow = {
  id: string;
  job_id: string;
  candidate_id: string;
  match_score: number | null;
  match_label: string | null;
  match_summary: string | null;
  matching_skills: string[];
  missing_skills: string[];
  experience_analysis: string | null;
  education_analysis: string | null;
  requirement_coverage: unknown;
  status: string;
  error_message: string | null;
  recruiter_notes: string | null;
  source_filename: string | null;
  screened_at: string | null;
  shortlisted_at: string | null;
  created_at: string;
  updated_at: string;
};

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export const jobsQuery = () =>
  queryOptions({
    queryKey: ["jobs"],
    queryFn: async () =>
      unwrap<JobRow[]>(
        await supabase.from("jobs").select("*").order("created_at", { ascending: false }),
      ),
  });

export const jobQuery = (jobId: string) =>
  queryOptions({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();
      if (error) throw new Error(error.message);
      return (data as JobRow | null) ?? null;
    },
  });

export type ApplicationWithRelations = ApplicationRow & {
  candidate: CandidateRow | null;
  job: Pick<JobRow, "id" | "title" | "department" | "location" | "required_skills" | "preferred_skills" | "minimum_experience" | "status"> | null;
};

const APPLICATION_SELECT =
  "*, candidate:candidates(*), job:jobs(id, title, department, location, required_skills, preferred_skills, minimum_experience, status)";

export const applicationsQuery = (filters?: { jobId?: string; status?: string[] }) =>
  queryOptions({
    queryKey: ["applications", filters ?? {}],
    queryFn: async () => {
      let query = supabase.from("applications").select(APPLICATION_SELECT);
      if (filters?.jobId) query = query.eq("job_id", filters.jobId);
      if (filters?.status?.length) query = query.in("status", filters.status);
      const { data, error } = await query.order("created_at", { ascending: false }).limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as ApplicationWithRelations[];
    },
  });

export const applicationQuery = (applicationId: string) =>
  queryOptions({
    queryKey: ["application", applicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("*, candidate:candidates(*), job:jobs(*)")
        .eq("id", applicationId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as unknown as ApplicationWithRelations | null) ?? null;
    },
  });

export const candidatesQuery = () =>
  queryOptions({
    queryKey: ["candidates"],
    queryFn: async () =>
      unwrap<CandidateRow[]>(
        await supabase.from("candidates").select("*").order("created_at", { ascending: false }).limit(500),
      ),
  });

export function rankApplications(apps: ApplicationWithRelations[]) {
  return [...apps].sort((a, b) => {
    const sa = a.match_score == null ? -1 : Number(a.match_score);
    const sb = b.match_score == null ? -1 : Number(b.match_score);
    if (sb !== sa) return sb - sa;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

/** Roles that are currently open for applications. */
export const openJobsQuery = () =>
  queryOptions({
    queryKey: ["open-jobs"],
    queryFn: async () =>
      unwrap<JobRow[]>(
        await supabase
          .from("jobs")
          .select("*")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(200),
      ),
  });

/** Applications submitted through the public apply page. */
export const myApplicationsQuery = () =>
  queryOptions({
    queryKey: ["my-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select(APPLICATION_SELECT)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as ApplicationWithRelations[];
    },
  });
