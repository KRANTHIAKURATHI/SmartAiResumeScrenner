import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { applicationsQuery, jobsQuery } from "@/lib/queries";
import { PageHeader, EmptyState, InlineError, btn, Th, Td } from "@/components/app/primitives";
import { formatDate, formatScore, JOB_STATUS_LABEL, type JobStatus } from "@/lib/domain";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/jobs/")({
  head: () => ({
    meta: [
      { title: "Jobs — Smart Resume Screener" },
      { name: "description", content: "All roles you are screening for, with candidate volume and average match quality." },
      { property: "og:title", content: "Jobs — Smart Resume Screener" },
      { property: "og:description", content: "All roles you are screening for, with candidate volume and average match quality." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => <InlineError message={error.message} />,
  component: JobsPage,
});

const FILTERS = ["all", "active", "paused", "closed"] as const;

function JobsPage() {
  const jobs = useSuspenseQuery(jobsQuery());
  const applications = useSuspenseQuery(applicationsQuery());
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");

  const rows = jobs.data
    .filter((job) => filter === "all" || job.status === filter)
    .map((job) => {
      const apps = applications.data.filter((a) => a.job_id === job.id);
      const scores = apps.map((a) => Number(a.match_score)).filter((n) => Number.isFinite(n));
      return {
        job,
        total: apps.length,
        screened: apps.filter((a) => a.status !== "uploaded" && a.status !== "processing").length,
        shortlisted: apps.filter((a) => a.status === "shortlisted").length,
        avg: scores.length ? scores.reduce((s, n) => s + n, 0) / scores.length : null,
      };
    });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Roles"
        title="Jobs"
        description="Each job holds its own requirements; resumes are scored against the role you upload them to."
        actions={
          <Link to="/jobs/new" className={btn.primary}>
            <Plus className="size-3.5" strokeWidth={2} /> New job
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-4">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "label-caps border-b pb-0.5 transition-colors",
              filter === f ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {f === "all" ? "All" : JOB_STATUS_LABEL[f as JobStatus]}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={jobs.data.length === 0 ? "No jobs yet" : "No jobs in this state"}
          description={
            jobs.data.length === 0
              ? "Describe a role once — its requirements drive every resume score for that job."
              : "Try another filter, or create a new role."
          }
          action={
            <Link to="/jobs/new" className={btn.primary}>
              Create a job
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr>
                <Th>Role</Th>
                <Th>Department</Th>
                <Th>Location</Th>
                <Th numeric>Resumes</Th>
                <Th numeric>Screened</Th>
                <Th numeric>Avg match</Th>
                <Th numeric>Shortlisted</Th>
                <Th>Created</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {rows.map(({ job, total, screened, shortlisted, avg }) => (
                <tr key={job.id} className="group transition-colors hover:bg-accent/60">
                  <Td>
                    <Link
                      to="/jobs/$jobId"
                      params={{ jobId: job.id }}
                      className="font-serif text-base group-hover:text-primary"
                    >
                      {job.title}
                    </Link>
                  </Td>
                  <Td className="text-muted-foreground">{job.department || "—"}</Td>
                  <Td className="text-muted-foreground">{job.location || "—"}</Td>
                  <Td numeric className="numeral">{total}</Td>
                  <Td numeric className="numeral">{screened}</Td>
                  <Td numeric className="numeral">{formatScore(avg)}</Td>
                  <Td numeric className="numeral">{shortlisted}</Td>
                  <Td className="text-muted-foreground">{formatDate(job.created_at)}</Td>
                  <Td>
                    <span className={cn("text-xs", job.status === "active" ? "text-foreground" : "text-muted-foreground")}>
                      {JOB_STATUS_LABEL[job.status as JobStatus] ?? job.status}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
