import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { applicationsQuery, jobsQuery, rankApplications } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useApplicationsRealtime } from "@/hooks/useApplicationsRealtime";
import { PageHeader, SectionHeading, EmptyState, SkillList, InlineError, btn, Score } from "@/components/app/primitives";
import { formatDate, formatExperience } from "@/lib/domain";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/shortlist")({
  head: () => ({
    meta: [
      { title: "Shortlist — Smart Resume Screener" },
      { name: "description", content: "Candidates you advanced, grouped by role, with the evidence behind each decision." },
      { property: "og:title", content: "Shortlist — Smart Resume Screener" },
      { property: "og:description", content: "Candidates you advanced, grouped by role, with the evidence behind each decision." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => <InlineError message={error.message} />,
  component: ShortlistPage,
});

function ShortlistPage() {
  useApplicationsRealtime();
  const queryClient = useQueryClient();
  const jobs = useSuspenseQuery(jobsQuery());
  const applications = useSuspenseQuery(applicationsQuery({ status: ["shortlisted"] }));

  const grouped = jobs.data
    .map((job) => ({
      job,
      apps: rankApplications(applications.data.filter((a) => a.job_id === job.id)),
    }))
    .filter((g) => g.apps.length > 0);

  async function remove(applicationId: string) {
    const { error } = await supabase.from("applications").update({ status: "screened" }).eq("id", applicationId);
    if (error) return toast.error("Could not update this candidate.");
    queryClient.invalidateQueries({ queryKey: ["applications"] });
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Decisions"
        title="Shortlist"
        description="The candidates you advanced, kept next to the analysis that justified it."
      />

      {grouped.length === 0 ? (
        <EmptyState
          title="No one shortlisted yet"
          description="Shortlist candidates from a job's ranking table or a candidate's analysis page and they collect here."
          action={
            <Link to="/jobs" className={btn.primary}>
              Go to jobs
            </Link>
          }
        />
      ) : (
        grouped.map(({ job, apps }) => (
          <section key={job.id} className="space-y-4">
            <SectionHeading
              label={`${job.title} · ${apps.length} shortlisted`}
              action={
                <Link to="/jobs/$jobId" params={{ jobId: job.id }} className={btn.quiet}>
                  Open role
                </Link>
              }
            />
            <ul className="divide-y divide-rule border-b border-rule">
              {apps.map((app) => (
                <li key={app.id} className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <Link
                      to="/applications/$applicationId"
                      params={{ applicationId: app.id }}
                      className="font-serif text-xl hover:text-primary"
                    >
                      {app.candidate?.name && app.candidate.name !== "Unknown candidate"
                        ? app.candidate.name
                        : (app.source_filename ?? "Resume")}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[app.candidate?.current_role, app.candidate?.current_company].filter(Boolean).join(" at ") ||
                        "Role not found in resume"}{" "}
                      · {formatExperience(app.candidate?.years_experience)} · shortlisted {formatDate(app.shortlisted_at)}
                    </p>
                    {app.match_summary && <p className="mt-2 max-w-2xl text-sm leading-relaxed">{app.match_summary}</p>}
                    <div className="mt-3">
                      <SkillList skills={app.matching_skills ?? []} limit={6} />
                    </div>
                  </div>
                  <div className="flex items-start gap-6 md:flex-col md:items-end">
                    <Score value={app.match_score} size="md" />
                    <button className={btn.quiet} onClick={() => void remove(app.id)}>
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
