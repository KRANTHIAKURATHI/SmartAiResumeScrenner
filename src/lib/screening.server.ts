/**
 * Server-only screening pipeline. Runs with the service-role client so it can read
 * resumes uploaded by candidates into their own storage folder. Callers MUST
 * authorize the request before invoking this.
 */

export type ScreeningResult = { ok: true; applicationId: string; score: number } | { ok: false; error: string };

export async function runScreening(applicationId: string): Promise<ScreeningResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: application, error: appError } = await supabaseAdmin
    .from("applications")
    .select("id, job_id, candidate_id, status, source_filename")
    .eq("id", applicationId)
    .maybeSingle();

  if (appError) throw new Error(appError.message);
  if (!application) return { ok: false, error: "This application no longer exists." };

  const fail = async (message: string): Promise<ScreeningResult> => {
    await supabaseAdmin
      .from("applications")
      .update({ status: "failed", error_message: message })
      .eq("id", application.id);
    return { ok: false, error: message };
  };

  await supabaseAdmin
    .from("applications")
    .update({ status: "processing", error_message: null })
    .eq("id", application.id);

  try {
    const [{ data: job, error: jobError }, { data: candidate, error: candidateError }] = await Promise.all([
      supabaseAdmin
        .from("jobs")
        .select(
          "id, title, department, location, employment_type, minimum_experience, required_skills, preferred_skills, description",
        )
        .eq("id", application.job_id)
        .maybeSingle(),
      supabaseAdmin
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
      const { data: file, error: downloadError } = await supabaseAdmin.storage
        .from("resumes")
        .download(candidate.resume_path);
      if (downloadError || !file) return await fail("The stored resume file could not be downloaded.");
      try {
        resumeText = await extractResumeText(
          file,
          candidate.resume_filename ?? application.source_filename ?? "resume.pdf",
        );
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

    const { error: candidateUpdateError } = await supabaseAdmin
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
      .eq("id", candidate.id);
    if (candidateUpdateError) throw new Error(candidateUpdateError.message);

    const { error: applicationUpdateError } = await supabaseAdmin
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

    return { ok: true, applicationId: application.id, score: match.match_score };
  } catch (error) {
    console.error("[screening] unexpected failure", error);
    return await fail("Screening failed unexpectedly. You can retry this resume.");
  }
}
