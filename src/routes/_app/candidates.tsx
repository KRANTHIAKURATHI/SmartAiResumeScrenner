import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { applicationsQuery, duplicateCandidatesQuery, jobsQuery, rankApplications } from "@/lib/queries";
import { hasPendingWork, useApplicationsRealtime } from "@/hooks/useApplicationsRealtime";
import { EXPERIENCE_BANDS, SCORE_BANDS } from "@/lib/screening-filters";
import {
  PageHeader,
  SectionHeading,
  EmptyState,
  StatusText,
  SkillList,
  InlineError,
  field,
  Th,
  Td,
} from "@/components/app/primitives";
import { formatExperience, formatScore, relativeTime } from "@/lib/domain";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/candidates")({
  head: () => ({
    meta: [
      { title: "Candidates — Smart Resume Screener" },
      { name: "description", content: "Search every screened resume by name, skill, role or employer across all your jobs." },
      { property: "og:title", content: "Candidates — Smart Resume Screener" },
      { property: "og:description", content: "Search every screened resume by name, skill, role or employer across all your jobs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => <InlineError message={error.message} />,
  component: CandidatesPage,
});

function CandidatesPage() {
  const applications = useSuspenseQuery(applicationsQuery());
  const jobs = useSuspenseQuery(jobsQuery());
  const duplicates = useSuspenseQuery(duplicateCandidatesQuery());
  useApplicationsRealtime(hasPendingWork(applications.data));
  const [term, setTerm] = useState("");
  const [jobFilter, setJobFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [minExperience, setMinExperience] = useState(0);
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);

  const duplicateIds = useMemo(
    () => new Set(duplicates.data.flatMap((g) => g.candidates.map((c) => c.id))),
    [duplicates.data],
  );

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    return rankApplications(
      applications.data.filter((app) => {
        if (jobFilter !== "all" && app.job_id !== jobFilter) return false;
        if (statusFilter !== "all" && app.status !== statusFilter) return false;
        if (minScore > 0 && Number(app.match_score ?? 0) < minScore) return false;
        if (minExperience > 0 && Number(app.candidate?.years_experience ?? 0) < minExperience) return false;
        if (duplicatesOnly && !(app.candidate_id && duplicateIds.has(app.candidate_id))) return false;
        if (!q) return true;
        const haystack = [
          app.candidate?.name,
          app.candidate?.email,
          app.candidate?.current_role,
          app.candidate?.current_company,
          app.candidate?.location,
          app.source_filename,
          app.job?.title,
          ...(app.candidate?.skills ?? []),
          ...(app.matching_skills ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      }),
    );
  }, [
    applications.data,
    term,
    jobFilter,
    statusFilter,
    minScore,
    minExperience,
    duplicatesOnly,
    duplicateIds,
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Talent pool"
        title="Candidates"
        description="Everything here was extracted from a real uploaded resume — nothing is inferred."
      />

      <div className="flex flex-wrap items-end gap-3 border-b border-rule pb-4">
        <label className="relative min-w-[220px] flex-1">
          <span className="label-caps">Search</span>
          <Search className="pointer-events-none absolute bottom-2.5 left-2.5 size-3.5 text-muted-foreground" strokeWidth={1.75} />
          <input
            className={`mt-1.5 ${field} pl-8`}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Name, skill, employer, filename…"
          />
        </label>
        <label className="block">
          <span className="label-caps">Job</span>
          <select className={`mt-1.5 ${field} w-auto`} value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}>
            <option value="all">All jobs</option>
            {jobs.data.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label-caps">Status</span>
          <select className={`mt-1.5 ${field} w-auto`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {["all", "screened", "shortlisted", "reviewing", "rejected", "processing", "failed"].map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "Any status" : s}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label-caps">Score band</span>
          <select
            className={`mt-1.5 ${field} w-auto`}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
          >
            {SCORE_BANDS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label-caps">Experience</span>
          <select
            className={`mt-1.5 ${field} w-auto`}
            value={minExperience}
            onChange={(e) => setMinExperience(Number(e.target.value))}
          >
            {EXPERIENCE_BANDS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={duplicatesOnly}
            onChange={(e) => setDuplicatesOnly(e.target.checked)}
            className="size-3.5 accent-primary"
          />
          Duplicates only
        </label>
      </div>

      {duplicates.data.length > 0 && (
        <section className="border border-rule bg-accent/40 p-4">
          <SectionHeading label={`Possible duplicate candidates (${duplicates.data.length})`} />
          <ul className="mt-3 space-y-2 text-sm">
            {duplicates.data.slice(0, 8).map((group) => (
              <li key={group.key} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="label-caps">{group.matchedOn}</span>
                <span className="font-medium">{group.value}</span>
                <span className="text-muted-foreground">
                  — {group.candidates.length} records:{" "}
                  {group.candidates.map((c) => c.name).join(", ")}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Matched on identical email, or the same phone number once formatting is stripped. Nothing is merged
            automatically — review each record before rejecting a repeat application.
          </p>
        </section>
      )}


      {rows.length === 0 ? (
        <EmptyState
          title={applications.data.length === 0 ? "No resumes uploaded yet" : "No candidates match these filters"}
          description={
            applications.data.length === 0
              ? "Open a job and upload resumes — parsed candidates appear here as they are screened."
              : "Clear the search or widen the filters."
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr>
                <Th>Candidate</Th>
                <Th>Current role</Th>
                <Th>Applied to</Th>
                <Th numeric>Match</Th>
                <Th numeric>Exp.</Th>
                <Th>Top skills</Th>
                <Th>Status</Th>
                <Th>Uploaded</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {rows.map((app) => (
                <tr key={app.id} className="group align-top transition-colors hover:bg-accent/60">
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
                    {app.candidate_id && duplicateIds.has(app.candidate_id) && (
                      <span className="ml-2 border border-primary/40 px-1 text-[10px] uppercase tracking-widest text-primary">
                        Duplicate
                      </span>
                    )}
                    <span className="block text-xs text-muted-foreground">{app.candidate?.email ?? "No email in resume"}</span>
                  </Td>
                  <Td className="text-muted-foreground">
                    {[app.candidate?.current_role, app.candidate?.current_company].filter(Boolean).join(" · ") || "—"}
                  </Td>
                  <Td>{app.job?.title ?? "—"}</Td>
                  <Td numeric>
                    <span className={cn("numeral", app.match_score != null && "text-primary")}>{formatScore(app.match_score)}</span>
                  </Td>
                  <Td numeric className="numeral text-xs">
                    {formatExperience(app.candidate?.years_experience)}
                  </Td>
                  <Td className="max-w-[16rem]">
                    <SkillList skills={app.candidate?.skills ?? []} limit={3} />
                  </Td>
                  <Td>
                    <StatusText status={app.status} />
                  </Td>
                  <Td className="text-xs text-muted-foreground">{relativeTime(app.created_at)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
