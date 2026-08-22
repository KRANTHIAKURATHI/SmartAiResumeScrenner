import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { applicationsQuery, jobsQuery, rankApplications } from "@/lib/queries";
import { hasPendingWork, useApplicationsRealtime } from "@/hooks/useApplicationsRealtime";
import {
  PageHeader,
  MetricStrip,
  SectionHeading,
  EmptyState,
  StatusText,
  InlineError,
  btn,
  Score,
} from "@/components/app/primitives";
import { formatScore, relativeTime } from "@/lib/domain";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/overview")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(jobsQuery()),
      context.queryClient.ensureQueryData(applicationsQuery()),
    ]),
  head: () => ({
    meta: [
      { title: "Screening overview — Smart Resume Screener" },
      {
        name: "description",
        content: "Live view of open roles, screened resumes and the strongest candidates in your pipeline.",
      },
      { property: "og:title", content: "Screening overview — Smart Resume Screener" },
      {
        property: "og:description",
        content: "Live view of open roles, screened resumes and the strongest candidates in your pipeline.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => <InlineError message={error.message} />,
  component: OverviewPage,
});

function OverviewPage() {
  const jobs = useSuspenseQuery(jobsQuery());
  const applications = useSuspenseQuery(applicationsQuery());
  useApplicationsRealtime(hasPendingWork(applications.data));

  const apps = applications.data;
  const activeJobs = jobs.data.filter((j) => j.status === "active");
  const screened = apps.filter((a) => ["screened", "reviewing", "shortlisted", "rejected"].includes(a.status));
  const shortlisted = apps.filter((a) => a.status === "shortlisted");
  const scores = screened.map((a) => Number(a.match_score)).filter((n) => Number.isFinite(n));
  const avg = scores.length ? scores.reduce((s, n) => s + n, 0) / scores.length : null;

  const top = rankApplications(screened).slice(0, 6);
  const recent = apps.slice(0, 8);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Overview"
        title="Screening desk"
        description="Every score below comes from a resume you uploaded and an analysis run against a specific role."
        actions={
          <Link to="/jobs/new" className={btn.primary}>
            <Plus className="size-3.5" strokeWidth={2} /> New job
          </Link>
        }
      />

      <MetricStrip
        items={[
          { label: "Active roles", value: activeJobs.length, hint: `${jobs.data.length} total` },
          { label: "Resumes screened", value: screened.length, hint: `${apps.length} uploaded` },
          { label: "Average match", value: formatScore(avg), hint: avg == null ? "No scores yet" : "out of 10" },
          { label: "Shortlisted", value: shortlisted.length, hint: "across all roles" },
        ]}
      />

      <section>
        <SectionHeading
          label="Strongest candidates"
          action={
            <Link to="/candidates" className={btn.quiet}>
              All candidates
            </Link>
          }
        />
        {top.length === 0 ? (
          <EmptyState
            title="No screened resumes yet"
            description="Create a job, upload a few resumes, and each one is parsed and scored against that role's requirements."
            action={
              <Link to="/jobs/new" className={btn.primary}>
                Create your first job
              </Link>
            }
          />
        ) : (
          <ol className="divide-y divide-rule border-b border-rule">
            {top.map((app, index) => (
              <li key={app.id}>
                <Link
                  to="/applications/$applicationId"
                  params={{ applicationId: app.id }}
                  className="flex items-baseline gap-4 py-4 transition-colors hover:bg-accent/60"
                >
                  <span className="numeral w-6 shrink-0 text-sm text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-serif text-lg leading-snug">
                      {app.candidate?.name ?? "Unknown candidate"}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {app.candidate?.current_role ?? "Role not found in resume"} · {app.job?.title ?? "Job removed"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <Score value={app.match_score} size="sm" />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <SectionHeading label="Recent activity" />
          {recent.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">Nothing uploaded yet.</p>
          ) : (
            <ul className="divide-y divide-rule border-b border-rule">
              {recent.map((app) => (
                <li key={app.id} className="flex items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {app.candidate?.name && app.candidate.name !== "Unknown candidate"
                        ? app.candidate.name
                        : (app.source_filename ?? "Resume")}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{app.job?.title ?? "—"}</span>
                  </span>
                  <StatusText status={app.status} />
                  <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                    {relativeTime(app.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionHeading
            label="Open roles"
            action={
              <Link to="/jobs" className={btn.quiet}>
                All jobs
              </Link>
            }
          />
          {jobs.data.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">No jobs created yet.</p>
          ) : (
            <ul className="divide-y divide-rule border-b border-rule">
              {jobs.data.slice(0, 8).map((job) => {
                const count = apps.filter((a) => a.job_id === job.id).length;
                return (
                  <li key={job.id}>
                    <Link
                      to="/jobs/$jobId"
                      params={{ jobId: job.id }}
                      className="flex items-center gap-3 py-3 transition-colors hover:bg-accent/60"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{job.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[job.department, job.location].filter(Boolean).join(" · ") || "No department set"}
                        </span>
                      </span>
                      <span className={cn("text-xs", job.status === "active" ? "text-foreground" : "text-muted-foreground")}>
                        {job.status}
                      </span>
                      <span className="numeral w-10 shrink-0 text-right text-sm">{count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
