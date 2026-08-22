import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const applyInput = z.object({
  jobId: z.string().uuid(),
  resumePath: z.string().min(1),
  filename: z.string().min(1),
  fullName: z.string().trim().max(120).optional(),
});

/**
 * Attaches an already-uploaded resume to an open role, then runs the screening
 * pipeline. The workspace is a single shared desk — anyone can apply.
 */
export const applyToJob = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => applyInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: job, error: jobError } = await supabaseAdmin
      .from("jobs")
      .select("id, status")
      .eq("id", data.jobId)
      .maybeSingle();
    if (jobError) throw new Error(jobError.message);
    if (!job || job.status !== "active") {
      return { ok: false as const, error: "This role is no longer accepting applications." };
    }

    const { data: candidate, error: candidateError } = await supabaseAdmin
      .from("candidates")
      .insert({
        name: data.fullName?.trim() || "Unknown candidate",
        resume_path: data.resumePath,
        resume_filename: data.filename,
      })
      .select("id")
      .single();
    if (candidateError || !candidate) {
      return { ok: false as const, error: "Your application record could not be created." };
    }

    const { data: application, error: applicationError } = await supabaseAdmin
      .from("applications")
      .insert({
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
