import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, SectionHeading, btn, field, InlineError } from "@/components/app/primitives";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/jobs/new")({
  head: () => ({
    meta: [
      { title: "Create a job — Smart Resume Screener" },
      { name: "description", content: "Define a role's requirements so every uploaded resume is scored against it." },
      { property: "og:title", content: "Create a job — Smart Resume Screener" },
      { property: "og:description", content: "Define a role's requirements so every uploaded resume is scored against it." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewJobPage,
});

function splitList(value: string) {
  return value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function NewJobPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    department: "",
    location: "",
    employment_type: "Full-time",
    minimum_experience: "0",
    required_skills: "",
    preferred_skills: "",
    description: "",
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.title.trim().length < 2) { setError("Give the role a title."); return; }
    if (form.description.trim().length < 40)
      { setError("Add a fuller description — the analysis quality depends on it (at least 40 characters)."); return; }
    const required = splitList(form.required_skills);
    if (required.length === 0) { setError("List at least one required skill."); return; }

    setBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setBusy(false);
      { setError("Your session expired. Sign in again."); return; }
    }

    const { data, error: insertError } = await supabase
      .from("jobs")
      .insert({
        user_id: userId,
        title: form.title.trim(),
        department: form.department.trim() || null,
        location: form.location.trim() || null,
        employment_type: form.employment_type || null,
        minimum_experience: Number(form.minimum_experience) || 0,
        required_skills: required,
        preferred_skills: splitList(form.preferred_skills),
        description: form.description.trim(),
      })
      .select("id")
      .single();

    setBusy(false);
    if (insertError || !data) {
      setError("The job could not be saved. Please try again.");
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["jobs"] });
    toast.success("Job created. Upload resumes to start screening.");
    navigate({ to: "/jobs/$jobId", params: { jobId: data.id } });
  }

  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader
        eyebrow="New role"
        title="Create a job"
        description="These requirements are what the screening analysis compares each resume against."
      />

      <form onSubmit={submit} className="space-y-10">
        <section className="space-y-4">
          <SectionHeading label="Role" />
          <label className="block">
            <span className="label-caps">Title</span>
            <input className={`mt-1.5 ${field}`} value={form.title} onChange={set("title")} placeholder="Senior Backend Engineer" required />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label-caps">Department</span>
              <input className={`mt-1.5 ${field}`} value={form.department} onChange={set("department")} placeholder="Engineering" />
            </label>
            <label className="block">
              <span className="label-caps">Location</span>
              <input className={`mt-1.5 ${field}`} value={form.location} onChange={set("location")} placeholder="Berlin / Remote" />
            </label>
            <label className="block">
              <span className="label-caps">Employment type</span>
              <select className={`mt-1.5 ${field}`} value={form.employment_type} onChange={set("employment_type")}>
                {["Full-time", "Part-time", "Contract", "Internship", "Temporary"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label-caps">Minimum experience (years)</span>
              <input
                className={`mt-1.5 ${field}`}
                type="number"
                min={0}
                max={40}
                step={0.5}
                value={form.minimum_experience}
                onChange={set("minimum_experience")}
              />
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeading label="Requirements" />
          <label className="block">
            <span className="label-caps">Required skills</span>
            <textarea
              className={`mt-1.5 ${field} min-h-20`}
              value={form.required_skills}
              onChange={set("required_skills")}
              placeholder="Python, PostgreSQL, distributed systems"
            />
            <span className="mt-1 block text-xs text-muted-foreground">Comma or line separated.</span>
          </label>
          <label className="block">
            <span className="label-caps">Preferred skills</span>
            <textarea
              className={`mt-1.5 ${field} min-h-20`}
              value={form.preferred_skills}
              onChange={set("preferred_skills")}
              placeholder="Kubernetes, event sourcing"
            />
          </label>
        </section>

        <section className="space-y-4">
          <SectionHeading label="Description" />
          <label className="block">
            <span className="label-caps">Responsibilities and context</span>
            <textarea
              className={`mt-1.5 ${field} min-h-48`}
              value={form.description}
              onChange={set("description")}
              placeholder="What the person will own, the team they join, and the outcomes expected."
            />
          </label>
        </section>

        {error && <InlineError message={error} />}

        <div className="flex items-center gap-3 border-t border-rule pt-5">
          <button type="submit" className={btn.primary} disabled={busy}>
            {busy ? "Saving…" : "Create job"}
          </button>
          <button type="button" className={btn.ghost} onClick={() => navigate({ to: "/jobs" })}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
