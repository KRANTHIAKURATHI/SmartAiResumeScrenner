import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { applicationsQuery, jobQuery, rankApplications } from "@/lib/queries";
import { screenApplication } from "@/lib/screening.functions";
import { setApplicationStatus, setJobStatus, deleteJob as deleteJobFn } from "@/lib/data.functions";
import { useApplicationsRealtime } from "@/hooks/useApplicationsRealtime";
import { ResumeUpload } from "@/components/app/ResumeUpload";
import {
  PageHeader,
  SectionHeading,
  MetricStrip,
  EmptyState,
  StatusText,
  SkillList,
  InlineError,
  btn,
  field,
  Th,
  Td,
} from "@/components/app/primitives";
import { formatExperience, formatScore, JOB_STATUS_LABEL, type JobStatus, scoreLabel } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/jobs/$jobId")({
  head: () => ({
    meta: [
      { title: "Job screening — Smart Resume Screener" },
      { name: "description", content: "Upload resumes for this role and review ranked, evidence-backed match analysis." },
      { property: "og:title", content: "Job screening — Smart Resume Screener" },
      { property: "og:description", content: "Upload resumes for this role and review ranked, evidence-backed match analysis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => <InlineError message={error.message} />,
  notFoundComponent: () => <EmptyState title="Job not found" description="This role may have been deleted." />,
  component: JobDetailPage,
});

function JobDetailPage() {
  useApplicationsRealtime();
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const rescreen = useServerFn(screenApplication);
  const job = useSuspenseQuery(jobQuery(jobId));
  const applications = useSuspenseQuery(applicationsQuery({ jobId }));
  const [filters, setFilters] = useState<ScreeningFilterState>(DEFAULT_SCREENING_FILTERS);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!job.data) {
    return <EmptyState title="Job not found" description="This role may have been deleted." />;
  }
  const j = job.data;
  const apps = applications.data;
  const scored = apps.filter((a) => Number.isFinite(Number(a.match_score)));
  const avg = scored.length ? scored.reduce((s, a) => s + Number(a.match_score), 0) / scored.length : null;
  const ranked = applyScreeningFilters(apps, filters);

  async function setStatus(applicationId: string, status: string) {
    setBusyId(applicationId);
    try {
      await setApplicationStatus({ data: { applicationId, status } });
    } catch {
      setBusyId(null);
      toast.error("Could not update this candidate.");
      return;
    }
    setBusyId(null);
    queryClient.invalidateQueries({ queryKey: ["applications"] });
  }

  async function retry(applicationId: string) {
    setBusyId(applicationId);
    try {
      const result = await rescreen({ data: { applicationId } });
      if (!result.ok) toast.error(result.error);
      else toast.success(`Rescreened — ${result.score}/10`);
    } catch {
      toast.error("Screening could not be completed.");
    } finally {
      setBusyId(null);
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    }
  }

  async function updateJobStatus(status: string) {
    try {
      await setJobStatus({ data: { jobId: j.id, status } });
    } catch {
      toast.error("Could not update the job status.");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["job", j.id] });
    queryClient.invalidateQueries({ queryKey: ["jobs"] });
  }

  async function deleteJob() {
    try {
      await deleteJobFn({ data: { jobId: j.id } });
    } catch {
      toast.error("Delete the applications for this role first.");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["jobs"] });
    toast.success("Job deleted.");
    navigate({ to: "/jobs" });
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={[j.department, j.employment_type].filter(Boolean).join(" · ") || "Role"}
        title={j.title}
        description={j.location ? `Based in ${j.location}` : undefined}
        actions={
          <>
            <select
              value={j.status}
              onChange={(e) => void updateJobStatus(e.target.value)}
              className={`${field} w-auto`}
              aria-label="Job status"
            >
              {(["active", "paused", "closed"] as JobStatus[]).map((s) => (
                <option key={s} value={s}>
                  {JOB_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <button className={btn.ghost} onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-3.5" strokeWidth={1.75} /> Delete
            </button>
          </>
        }
      />

      <MetricStrip
        items={[
          { label: "Resumes", value: apps.length },
          { label: "Screened", value: scored.length },
          { label: "Average match", value: formatScore(avg), hint: avg == null ? "No scores yet" : scoreLabel(avg) },
          { label: "Shortlisted", value: apps.filter((a) => a.status === "shortlisted").length },
        ]}
      />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="space-y-4">
          <SectionHeading label="Upload resumes" />
          <ResumeUpload jobId={j.id} />
        </section>
        <aside className="space-y-6">
          <div>
            <SectionHeading label="Required skills" className="mb-3" />
            <SkillList skills={j.required_skills} />
          </div>
          <div>
            <SectionHeading label="Preferred skills" className="mb-3" />
            <SkillList skills={j.preferred_skills} />
          </div>
          <div>
            <SectionHeading label="Minimum experience" className="mb-3" />
            <p className="numeral text-2xl">{formatExperience(j.minimum_experience)}</p>
          </div>
        </aside>
      </div>

      <section>
        <SectionHeading label="Job description" />
        <p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed">{j.description || "No description recorded."}</p>
      </section>

      <section>
        <SectionHeading label="Ranked candidates" />
        <ScreeningFilters
          value={filters}
          onChange={setFilters}
          skills={[...j.required_skills, ...j.preferred_skills]}
          matched={ranked.length}
          total={apps.length}
        />
        {ranked.length === 0 ? (
          <EmptyState
            title={apps.length === 0 ? "No resumes uploaded for this role" : "No candidates match these filters"}
            description={
              apps.length === 0
                ? "Drop PDF or text resumes above. Each is stored, parsed and scored against this role's requirements."
                : "Loosen the score, experience or skill filters to see more candidates."
            }
          />
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr>
                  <Th className="w-10">#</Th>
                  <Th>Candidate</Th>
                  <Th numeric>Match</Th>
                  <Th>Assessment</Th>
                  <Th numeric>Exp.</Th>
                  <Th>Matching skills</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {ranked.map((app, i) => (
                  <tr key={app.id} className="group align-top transition-colors hover:bg-accent/60">
                    <Td className="numeral text-muted-foreground">{String(i + 1).padStart(2, "0")}</Td>
                    <Td>
                      <Link
                        to="/applications/$applicationId"
                        params={{ applicationId: app.id }}
                        className="font-serif text-base group-hover:text-primary"
                      >
                        {app.candidate?.name && app.candidate.name !== "Unknown candidate"
                          ? app.candidate.name
                          : (app.source_filename ?? "Resume")}
                      </Link>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {app.candidate?.current_role ?? "Role not found in resume"}
                      </span>
                      {app.status === "failed" && app.error_message && (
                        <span className="mt-1 block text-xs text-destructive">{app.error_message}</span>
                      )}
                    </Td>
                    <Td numeric>
                      <span className={cn("numeral text-lg", app.match_score != null && "text-primary")}>
                        {formatScore(app.match_score)}
                      </span>
                    </Td>
                    <Td className="max-w-[16rem] text-xs text-muted-foreground">
                      {app.match_label || scoreLabel(app.match_score)}
                    </Td>
                    <Td numeric className="numeral text-xs">
                      {formatExperience(app.candidate?.years_experience)}
                    </Td>
                    <Td className="max-w-[14rem]">
                      <SkillList skills={app.matching_skills ?? []} limit={3} />
                    </Td>
                    <Td>
                      <StatusText status={app.status} />
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-2">
                        {app.status === "shortlisted" ? (
                          <button
                            className={btn.quiet}
                            disabled={busyId === app.id}
                            onClick={() => void setStatus(app.id, "screened")}
                          >
                            Unshortlist
                          </button>
                        ) : (
                          <button
                            className={btn.quiet}
                            disabled={busyId === app.id || app.match_score == null}
                            onClick={() => void setStatus(app.id, "shortlisted")}
                          >
                            Shortlist
                          </button>
                        )}
                        <button
                          className={btn.quiet}
                          disabled={busyId === app.id}
                          onClick={() => void retry(app.id)}
                          aria-label="Rescreen this resume"
                        >
                          <RefreshCw className={cn("size-3", busyId === app.id && "animate-spin")} strokeWidth={1.75} />
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this job?</AlertDialogTitle>
            <AlertDialogDescription>
              Screening results attached to this role will be removed too. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep job</AlertDialogCancel>
            <AlertDialogAction onClick={() => void deleteJob()}>Delete job</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
