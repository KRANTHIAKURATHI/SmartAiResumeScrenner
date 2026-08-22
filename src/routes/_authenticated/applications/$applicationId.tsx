import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, RefreshCw } from "lucide-react";
import { applicationQuery } from "@/lib/queries";
import { getResumeUrl, screenApplication } from "@/lib/screening.functions";
import { supabase } from "@/integrations/supabase/client";
import { useApplicationsRealtime } from "@/hooks/useApplicationsRealtime";
import {
  PageHeader,
  SectionHeading,
  Score,
  StatusText,
  SkillList,
  EmptyState,
  InlineError,
  btn,
  field,
} from "@/components/app/primitives";
import {
  formatDate,
  formatExperience,
  relativeTime,
  scoreLabel,
  type EducationEntry,
  type ExperienceEntry,
  type RequirementCoverageEntry,
} from "@/lib/domain";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/applications/$applicationId")({
  head: () => ({
    meta: [
      { title: "Candidate analysis — Smart Resume Screener" },
      { name: "description", content: "Full parsed resume detail and requirement-by-requirement match analysis." },
      { property: "og:title", content: "Candidate analysis — Smart Resume Screener" },
      { property: "og:description", content: "Full parsed resume detail and requirement-by-requirement match analysis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => <InlineError message={error.message} />,
  notFoundComponent: () => <EmptyState title="Candidate not found" description="This application may have been deleted." />,
  component: ApplicationPage,
});

const COVERAGE_LABEL: Record<string, string> = { matched: "Matched", partial: "Partial", missing: "Missing" };

function ApplicationPage() {
  useApplicationsRealtime();
  const { applicationId } = Route.useParams();
  const queryClient = useQueryClient();
  const rescreen = useServerFn(screenApplication);
  const resumeUrl = useServerFn(getResumeUrl);
  const { data: app } = useSuspenseQuery(applicationQuery(applicationId));
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    setNotes(app?.recruiter_notes ?? "");
  }, [app?.recruiter_notes]);

  if (!app) {
    return <EmptyState title="Candidate not found" description="This application may have been deleted." />;
  }

  const candidate = app.candidate;
  const education = (candidate?.education as EducationEntry[] | null) ?? [];
  const experience = (candidate?.experience as ExperienceEntry[] | null) ?? [];
  const certifications = (candidate?.certifications as string[] | null) ?? [];
  const coverage = (app.requirement_coverage as RequirementCoverageEntry[] | null) ?? [];

  async function setStatus(status: string) {
    setBusy(true);
    const patch: Record<string, unknown> = { status };
    if (status === "shortlisted") patch["shortlisted_at"] = new Date().toISOString();
    const { error } = await supabase.from("applications").update(patch).eq("id", app.id);
    setBusy(false);
    if (error) return toast.error("Could not update this candidate.");
    queryClient.invalidateQueries({ queryKey: ["application", app.id] });
    queryClient.invalidateQueries({ queryKey: ["applications"] });
  }

  async function saveNotes() {
    setSavingNotes(true);
    const { error } = await supabase.from("applications").update({ recruiter_notes: notes }).eq("id", app.id);
    setSavingNotes(false);
    if (error) return toast.error("Notes could not be saved.");
    toast.success("Notes saved.");
    queryClient.invalidateQueries({ queryKey: ["application", app.id] });
  }

  async function openResume() {
    if (!candidate) return;
    try {
      const { url } = await resumeUrl({ data: { candidateId: candidate.id } });
      if (!url) return toast.error("No stored resume file for this candidate.");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Could not open the resume file.");
    }
  }

  async function retry() {
    setBusy(true);
    try {
      const result = await rescreen({ data: { applicationId: app.id } });
      if (!result.ok) toast.error(result.error);
      else toast.success(`Rescreened — ${result.score}/10`);
    } catch {
      toast.error("Screening could not be completed.");
    } finally {
      setBusy(false);
      queryClient.invalidateQueries({ queryKey: ["application", app.id] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    }
  }

  return (
    <div className="space-y-10">
      <Link to="/jobs/$jobId" params={{ jobId: app.job_id }} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-3" strokeWidth={1.75} /> Back to {app.job?.title ?? "job"}
      </Link>

      <PageHeader
        eyebrow={app.job?.title ? `Screened for ${app.job.title}` : "Candidate"}
        title={candidate?.name && candidate.name !== "Unknown candidate" ? candidate.name : (app.source_filename ?? "Resume")}
        description={[candidate?.current_role, candidate?.current_company].filter(Boolean).join(" at ") || undefined}
        actions={
          <>
            {app.status === "shortlisted" ? (
              <button className={btn.ghost} disabled={busy} onClick={() => void setStatus("screened")}>
                Remove from shortlist
              </button>
            ) : (
              <button className={btn.primary} disabled={busy || app.match_score == null} onClick={() => void setStatus("shortlisted")}>
                Shortlist
              </button>
            )}
            {app.status !== "rejected" && (
              <button className={btn.ghost} disabled={busy} onClick={() => void setStatus("rejected")}>
                Reject
              </button>
            )}
            <button className={btn.ghost} onClick={() => void openResume()}>
              <Download className="size-3.5" strokeWidth={1.75} /> Resume
            </button>
            <button className={btn.ghost} disabled={busy} onClick={() => void retry()}>
              <RefreshCw className={cn("size-3.5", busy && "animate-spin")} strokeWidth={1.75} /> Rescreen
            </button>
          </>
        }
      />

      {app.status === "failed" && app.error_message && <InlineError message={app.error_message} onRetry={() => void retry()} />}
      {(app.status === "uploaded" || app.status === "processing") && (
        <p className="border-l-2 border-primary bg-paper px-4 py-3 text-sm">
          This resume is being read and analysed. Results appear here automatically.
        </p>
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <aside className="space-y-8">
          <div className="border-y border-rule py-5">
            <p className="label-caps">Match score</p>
            <div className="mt-2">
              <Score value={app.match_score} size="lg" showBar />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {app.match_label || scoreLabel(app.match_score)} · <StatusText status={app.status} />
            </p>
          </div>

          <div>
            <SectionHeading label="Contact" className="mb-3" />
            <dl className="space-y-2 text-sm">
              {[
                ["Email", candidate?.email],
                ["Phone", candidate?.phone],
                ["Location", candidate?.location],
                ["Experience", formatExperience(candidate?.years_experience)],
                ["Uploaded", `${formatDate(app.created_at)} · ${relativeTime(app.created_at)}`],
                ["File", candidate?.resume_filename ?? app.source_filename],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between gap-4 border-b border-rule pb-2">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="min-w-0 truncate text-right">{value || "Not found in resume"}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <SectionHeading label="Skills found" className="mb-3" />
            <SkillList skills={candidate?.skills ?? []} />
          </div>

          {certifications.length > 0 && (
            <div>
              <SectionHeading label="Certifications" className="mb-3" />
              <ul className="space-y-1 text-sm">
                {certifications.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <SectionHeading label="Recruiter notes" className="mb-3" />
            <textarea
              className={`${field} min-h-28`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Interview impressions, follow-ups, references…"
            />
            <button className={cn(btn.ghost, "mt-2")} disabled={savingNotes} onClick={() => void saveNotes()}>
              {savingNotes ? "Saving…" : "Save notes"}
            </button>
          </div>
        </aside>

        <div className="space-y-10">
          <section>
            <SectionHeading label="Why this score" />
            <p className="mt-4 text-sm leading-relaxed">{app.match_summary || "Not yet analysed."}</p>
          </section>

          <div className="grid gap-8 sm:grid-cols-2">
            <section>
              <SectionHeading label="Matching skills" className="mb-3" />
              <SkillList skills={app.matching_skills ?? []} />
            </section>
            <section>
              <SectionHeading label="Missing skills" className="mb-3" />
              {app.missing_skills?.length ? (
                <ul className="space-y-1 text-sm">
                  {app.missing_skills.map((s) => (
                    <li key={s} className="text-muted-foreground">
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No gaps recorded.</p>
              )}
            </section>
          </div>

          {coverage.length > 0 && (
            <section>
              <SectionHeading label="Requirement coverage" />
              <ul className="divide-y divide-rule border-b border-rule">
                {coverage.map((c, i) => (
                  <li key={`${c.requirement}-${i}`} className="py-3">
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="text-sm">{c.requirement}</p>
                      <span
                        className={cn(
                          "shrink-0 text-xs",
                          c.coverage === "matched" && "text-primary",
                          c.coverage === "partial" && "text-foreground",
                          c.coverage === "missing" && "text-muted-foreground",
                        )}
                      >
                        {COVERAGE_LABEL[c.coverage] ?? c.coverage}
                      </span>
                    </div>
                    {c.evidence && <p className="mt-1 text-xs text-muted-foreground">{c.evidence}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="grid gap-8 sm:grid-cols-2">
            <section>
              <SectionHeading label="Experience analysis" className="mb-3" />
              <p className="text-sm leading-relaxed">{app.experience_analysis || "Not yet analysed."}</p>
            </section>
            <section>
              <SectionHeading label="Education analysis" className="mb-3" />
              <p className="text-sm leading-relaxed">{app.education_analysis || "Not yet analysed."}</p>
            </section>
          </div>

          {experience.length > 0 && (
            <section>
              <SectionHeading label="Work history" />
              <ol className="divide-y divide-rule border-b border-rule">
                {experience.map((role, i) => (
                  <li key={`${role.title}-${i}`} className="py-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-serif text-lg">{role.title || "Role not stated"}</p>
                      <p className="text-xs text-muted-foreground">{role.duration || "Dates not stated"}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{role.company || "Company not stated"}</p>
                    {role.responsibilities?.length ? (
                      <ul className="mt-2 space-y-1">
                        {role.responsibilities.map((r, ri) => (
                          <li key={ri} className="pl-3 text-sm leading-relaxed -indent-3 before:mr-1.5 before:content-['—']">
                            {r}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {education.length > 0 && (
            <section>
              <SectionHeading label="Education" />
              <ul className="divide-y divide-rule border-b border-rule">
                {education.map((e, i) => (
                  <li key={`${e.degree}-${i}`} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                    <div>
                      <p className="text-sm">{[e.degree, e.field].filter(Boolean).join(", ") || "Degree not stated"}</p>
                      <p className="text-xs text-muted-foreground">{e.institution || "Institution not stated"}</p>
                    </div>
                    <p className="numeral text-xs text-muted-foreground">{e.year || "—"}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {candidate?.parsed_resume && (
            <section>
              <SectionHeading label="Extracted resume text" />
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-primary">Show the text used for analysis</summary>
                <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap border border-rule bg-paper p-4 text-xs leading-relaxed">
                  {candidate.parsed_resume}
                </pre>
              </details>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
