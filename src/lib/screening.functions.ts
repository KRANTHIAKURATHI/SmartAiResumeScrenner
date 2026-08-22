import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const screenInput = z.object({
  applicationId: z.string().uuid(),
});

/**
 * Runs the full screening pipeline for one uploaded application:
 * download resume -> extract text -> parse profile -> semantic match -> persist.
 */
export const screenApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => screenInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: application, error: appError } = await supabase
      .from("applications")
      .select("id, job_id, candidate_id, status, source_filename")
      .eq("id", data.applicationId)
      .maybeSingle();

    if (appError) throw new Error(appError.message);
    if (!application) throw new Error("This application no longer exists.");

    const fail = async (message: string) => {
      await supabase
        .from("applications")
        .update({ status: "failed", error_message: message })
        .eq("id", application.id);
      return { ok: false as const, error: message };
    };

    await supabase
      .from("applications")
      .update({ status: "processing", error_message: null })
      .eq("id", application.id);

    try {
      const [{ data: job, error: jobError }, { data: candidate, error: candidateError }] = await Promise.all([
        supabase
          .from("jobs")
          .select(
            "id, title, department, location, employment_type, minimum_experience, required_skills, preferred_skills, description",
          )
          .eq("id", application.job_id)
          .maybeSingle(),
        supabase
          .from("candidates")
          .select("id, resume_path, resume_filename, parsed_resume")
          .eq("id", application.candidate_id)
          .maybeSingle(),
      ]);

      if (jobError) throw new Error(jobError.message);
      if (candidateError) throw new Error(candidateError.message);
      if (!job) return await fail("The job for this application was removed.");
      if (!candidate?.resume_path) return await fail("The stored resume file could not be located.");

      const { extractResumeText, ResumeExtractionError } = await import("./resume-extract.server");
      const { extractCandidateProfile, matchCandidateToJob, LlmError } = await import("./llm.server");

      let resumeText = candidate.parsed_resume ?? "";
      if (!resumeText) {
        const { data: file, error: downloadError } = await supabase.storage
          .from("resumes")
          .download(candidate.resume_path);
        if (downloadError || !file) return await fail("The stored resume file could not be downloaded.");
        try {
          resumeText = await extractResumeText(file, candidate.resume_filename ?? application.source_filename ?? "resume.pdf");
        } catch (error) {
          if (error instanceof ResumeExtractionError) return await fail(error.message);
          throw error;
        }
      }

      let profile;
      let match;
      try {
        profile = await extractCandidateProfile(resumeText);
        match = await matchCandidateToJob({
          job: {
            title: job.title,
            department: job.department,
            location: job.location,
            employment_type: job.employment_type,
            minimum_experience: job.minimum_experience,
            required_skills: job.required_skills ?? [],
            preferred_skills: job.preferred_skills ?? [],
            description: job.description ?? "",
          },
          profile,
          resumeText,
        });
      } catch (error) {
        if (error instanceof LlmError) return await fail(error.message);
        throw error;
      }

      const { error: candidateUpdateError } = await supabase
        .from("candidates")
        .update({
          name: profile.name ?? "Unknown candidate",
          email: profile.email,
          phone: profile.phone,
          location: profile.location,
          current_role: profile.current_role,
          current_company: profile.current_company,
          years_experience: profile.years_experience,
          skills: profile.skills,
          education: profile.education,
          certifications: profile.certifications,
          experience: profile.experience,
          parsed_resume: resumeText,
        })
        .eq("id", candidate.id)
        .eq("user_id", userId);
      if (candidateUpdateError) throw new Error(candidateUpdateError.message);

      const { error: applicationUpdateError } = await supabase
        .from("applications")
        .update({
          match_score: match.match_score,
          match_label: match.match_label,
          match_summary: match.justification,
          matching_skills: match.matching_skills,
          missing_skills: match.missing_skills,
          experience_analysis: match.experience_analysis,
          education_analysis: match.education_analysis,
          requirement_coverage: match.requirement_coverage,
          status: "screened",
          error_message: null,
          screened_at: new Date().toISOString(),
        })
        .eq("id", application.id);
      if (applicationUpdateError) throw new Error(applicationUpdateError.message);

      return { ok: true as const, applicationId: application.id, score: match.match_score };
    } catch (error) {
      console.error("[screening] unexpected failure", error);
      return await fail("Screening failed unexpectedly. You can retry this resume.");
    }
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

    const { data: signed, error: signError } = await context.supabase.storage
      .from("resumes")
      .createSignedUrl(candidate.resume_path, 60 * 5);
    if (signError) throw new Error(signError.message);
    return { url: signed?.signedUrl ?? null };
  });
