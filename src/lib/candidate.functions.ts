import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const applyInput = z.object({
  jobId: z.string().uuid(),
  resumePath: z.string().min(1),
  filename: z.string().min(1),
  fullName: z.string().trim().max(120).optional(),
});

/**
 * Candidate self-service application: attaches an already-uploaded resume to an
 * open role, then runs the screening pipeline.
 */
export const applyToJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => applyInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isCandidate } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "candidate",
    });
    if (!isCandidate) return { ok: false as const, error: "Only candidate accounts can apply to roles." };

    if (!data.resumePath.startsWith(`${userId}/`)) {
      return { ok: false as const, error: "That resume file doesn't belong to your account." };
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, user_id, status")
      .eq("id", data.jobId)
      .maybeSingle();
    if (jobError) throw new Error(jobError.message);
    if (!job || job.status !== "active") {
      return { ok: false as const, error: "This role is no longer accepting applications." };
    }

    const { data: existing } = await supabase
      .from("applications")
      .select("id")
      .eq("job_id", data.jobId)
      .eq("candidate_user_id", userId)
      .maybeSingle();
    if (existing) return { ok: false as const, error: "You have already applied to this role." };

    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .insert({
        user_id: job.user_id,
        candidate_user_id: userId,
        name: data.fullName?.trim() || "Unknown candidate",
        resume_path: data.resumePath,
        resume_filename: data.filename,
      })
      .select("id")
      .single();
    if (candidateError || !candidate) {
      return { ok: false as const, error: "Your application record could not be created." };
    }

    const { data: application, error: applicationError } = await supabase
      .from("applications")
      .insert({
        user_id: job.user_id,
        candidate_user_id: userId,
        job_id: data.jobId,
        candidate_id: candidate.id,
        source_filename: data.filename,
        status: "uploaded",
      })
      .select("id")
      .single();
    if (applicationError || !application) {
      return { ok: false as const, error: "Your application could not be submitted." };
    }

    const { runScreening } = await import("./screening.server");
    const result = await runScreening(application.id);
    return result.ok
      ? { ok: true as const, applicationId: application.id, score: result.score }
      : { ok: false as const, applicationId: application.id, error: result.error };
  });
