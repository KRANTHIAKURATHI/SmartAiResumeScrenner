import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { applicationsQuery, candidatesQuery, jobsQuery } from "@/lib/queries";
import { PageHeader, SectionHeading, MetricStrip, InlineError } from "@/components/app/primitives";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Smart Resume Screener" },
      { name: "description", content: "See what this screening workspace currently holds and how scoring works." },
      { property: "og:title", content: "Settings — Smart Resume Screener" },
      { property: "og:description", content: "See what this screening workspace currently holds and how scoring works." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => <InlineError message={error.message} />,
  component: SettingsPage,
});

function SettingsPage() {
  const jobs = useSuspenseQuery(jobsQuery());
  const candidates = useSuspenseQuery(candidatesQuery());
  const applications = useSuspenseQuery(applicationsQuery());

  return (
    <div className="max-w-2xl space-y-10">
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="One shared screening desk — no accounts, no sign-in. Everything below is live workspace data."
      />

      <MetricStrip
        items={[
          { label: "Jobs", value: jobs.data.length },
          { label: "Candidates", value: candidates.data.length },
          { label: "Applications", value: applications.data.length },
          { label: "Shortlisted", value: applications.data.filter((a) => a.status === "shortlisted").length },
        ]}
      />

      <section className="space-y-2 border-t border-rule pt-6">
        <SectionHeading label="How screening works" />
        <p className="text-sm leading-relaxed text-muted-foreground">
          Uploaded resumes are stored in a private bucket and read server-side: text is extracted, a language model parses
          the candidate details, then compares them to the job's requirements. Scores are evidence-based and protected
          characteristics are excluded from the analysis. Every score can be re-run from the candidate page.
        </p>
      </section>

      <section className="space-y-2 border-t border-rule pt-6">
        <SectionHeading label="Roles and applications" />
        <p className="text-sm leading-relaxed text-muted-foreground">
          Recruiting and applying live in the same workspace. Create roles under Jobs, upload resumes in bulk from a role's
          page, or submit a single resume for an open role from the Apply page — both paths feed the same ranked pipeline.
        </p>
      </section>
    </div>
  );
}
