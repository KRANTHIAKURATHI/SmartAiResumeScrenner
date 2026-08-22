import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { Upload, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { applyToJob } from "@/lib/candidate.functions";
import { myApplicationsQuery, openJobsQuery } from "@/lib/queries";
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
import { ACCEPTED_RESUME_TYPES, formatDate, formatExperience, validateResumeFile } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/apply")({
  head: () => ({
    meta: [
      { title: "Apply with your resume — Smart Resume Screener" },
      {
        name: "description",
        content: "Browse open roles and upload your PDF or Word resume to apply. Track the status of every application.",
      },
      { property: "og:title", content: "Apply with your resume — Smart Resume Screener" },
      {
        property: "og:description",
        content: "Browse open roles and upload your PDF or Word resume to apply.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => <InlineError message={error.message} />,
  component: ApplyPage,
});

function ApplyPage() {
  const queryClient = useQueryClient();
  const apply = useServerFn(applyToJob);
  const jobs = useSuspenseQuery(openJobsQuery());
  const applications = useSuspenseQuery(myApplicationsQuery());
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingJob, setPendingJob] = useState<string | null>(null);
  const [busyJob, setBusyJob] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");

  async function submit(jobId: string, file: File) {
    const problem = validateResumeFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusyJob(jobId);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `applications/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (uploadError) {
        toast.error("Upload failed. Check your connection and try again.");
        return;
      }
      const result = await apply({
        data: {
          jobId,
          resumePath: path,
          filename: file.name,
          fullName: fullName.trim() || undefined,
        },
      });
      if (result.ok) toast.success("Application submitted. The resume is being screened.");
      else toast.error(result.error);
    } catch (error) {
      console.error(error);
      toast.error("The application could not be submitted. Please try again.");
    } finally {
      setBusyJob(null);
      queryClient.invalidateQueries({ queryKey: ["my-applications"] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
    }
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Apply"
        title="Apply with a resume"
        description="Upload a PDF or Word (.docx) resume for any open role. Each submission is read and assessed against the role's requirements."
      />

      <MetricStrip
        items={[
          { label: "Open roles", value: jobs.data.length },
          { label: "Applications", value: applications.data.length },
          {
            label: "Under review",
            value: applications.data.filter((a) => ["uploaded", "processing", "screened", "reviewing"].includes(a.status))
              .length,
          },
          { label: "Shortlisted", value: applications.data.filter((a) => a.status === "shortlisted").length },
        ]}
      />

      <label className="block max-w-sm">
        <span className="label-caps">Candidate name (optional)</span>
        <input
          className={`mt-1.5 ${field}`}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Name on the resume"
        />
      </label>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_RESUME_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const jobId = pendingJob;
          e.target.value = "";
          setPendingJob(null);
          if (file && jobId) void submit(jobId, file);
        }}
      />

      <section>
        <SectionHeading label="Open roles" />
        {jobs.data.length === 0 ? (
          <EmptyState
            title="No roles are open right now"
            description="Publish an active role from Jobs and it will appear here for applications."
          />
        ) : (
          <ul className="mt-2 divide-y divide-rule border-y border-rule">
            {jobs.data.map((job) => (
              <li key={job.id} className="flex flex-col gap-3 py-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="label-caps">
                    {[job.department, job.employment_type, job.location].filter(Boolean).join(" · ") || "Role"}
                  </p>
                  <h3 className="mt-1 font-serif text-xl leading-snug">{job.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Minimum experience {formatExperience(job.minimum_experience)}
                  </p>
                  <div className="mt-2 max-w-xl">
                    <SkillList skills={job.required_skills ?? []} limit={6} />
                  </div>
                </div>
                <div className="shrink-0">
                  <button
                    className={cn(btn.ghost)}
                    disabled={busyJob === job.id}
                    onClick={() => {
                      setPendingJob(job.id);
                      inputRef.current?.click();
                    }}
                  >
                    <Upload className="size-3.5" strokeWidth={1.75} />
                    {busyJob === job.id ? "Submitting…" : "Upload resume & apply"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionHeading label="Recent applications" />
        {applications.data.length === 0 ? (
          <EmptyState
            title="No applications yet"
            description="Pick a role above and upload a resume. PDF, DOCX, TXT and MD files up to 10 MB are accepted."
          />
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr>
                  <Th>Role</Th>
                  <Th>Resume</Th>
                  <Th>Submitted</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {applications.data.map((app) => (
                  <tr key={app.id} className="align-top">
                    <Td>
                      <span className="font-serif text-base">{app.job?.title ?? "Role removed"}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {[app.job?.department, app.job?.location].filter(Boolean).join(" · ") || "—"}
                      </span>
                      {app.status === "failed" && app.error_message && (
                        <span className="mt-1 block text-xs text-destructive">{app.error_message}</span>
                      )}
                    </Td>
                    <Td className="text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <FileText className="size-3.5" strokeWidth={1.5} aria-hidden />
                        {app.source_filename ?? "Resume"}
                      </span>
                    </Td>
                    <Td className="numeral text-xs">{formatDate(app.created_at)}</Td>
                    <Td>
                      <StatusText status={app.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
