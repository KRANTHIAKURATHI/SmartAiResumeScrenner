import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const screenInput = z.object({ applicationId: z.string().uuid() });

/**
 * Screens one uploaded application. The caller must be able to read the row under
 * RLS (owning recruiter, or the candidate who submitted it).
 */
export const screenApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => screenInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: allowed, error } = await context.supabase
      .from("applications")
      .select("id")
      .eq("id", data.applicationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!allowed) throw new Error("This application no longer exists.");

    const { runScreening } = await import("./screening.server");
    const result = await runScreening(data.applicationId);
    return result.ok
      ? { ok: true as const, applicationId: result.applicationId, score: result.score }
      : { ok: false as const, error: result.error };
  });

/** Returns a short-lived signed URL for viewing an uploaded resume. */
export const getResumeUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ candidateId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: candidate, error } = await context.supabase
      .from("candidates")
      .select("resume_path")
      .eq("id", data.candidateId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!candidate?.resume_path) return { url: null as string | null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("resumes")
      .createSignedUrl(candidate.resume_path, 60 * 5);
    if (signError) throw new Error(signError.message);
    return { url: signed?.signedUrl ?? null };
  });
