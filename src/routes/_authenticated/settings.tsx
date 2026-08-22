import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { applicationsQuery, candidatesQuery, jobsQuery, profileQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, SectionHeading, MetricStrip, InlineError, btn, field } from "@/components/app/primitives";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Smart Resume Screener" },
      { name: "description", content: "Manage your sign-in email, password and workspace data footprint." },
      { property: "og:title", content: "Settings — Smart Resume Screener" },
      { property: "og:description", content: "Manage your sign-in email, password and workspace data footprint." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => <InlineError message={error.message} />,
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useSuspenseQuery(profileQuery());
  const jobs = useSuspenseQuery(jobsQuery());
  const candidates = useSuspenseQuery(candidatesQuery());
  const applications = useSuspenseQuery(applicationsQuery());

  const [email, setEmail] = useState(profile?.email ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"email" | "password" | null>(null);

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy("email");
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    setBusy(null);
    if (error) { toast.error("That email could not be used. Try another."); return; }
    toast.success("Check your inbox to confirm the new address.");
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy("password");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(null);
    if (error) { toast.error("The password could not be updated."); return; }
    setPassword("");
    toast.success("Password updated.");
  }

  async function signOutEverywhere() {
    await supabase.auth.signOut({ scope: "global" });
    queryClient.clear();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="max-w-2xl space-y-10">
      <PageHeader eyebrow="Workspace" title="Settings" description="Your account credentials and what this workspace currently holds." />

      <MetricStrip
        items={[
          { label: "Jobs", value: jobs.data.length },
          { label: "Candidates", value: candidates.data.length },
          { label: "Applications", value: applications.data.length },
          { label: "Shortlisted", value: applications.data.filter((a) => a.status === "shortlisted").length },
        ]}
      />

      <form onSubmit={changeEmail} className="space-y-4">
        <SectionHeading label="Sign-in email" />
        <label className="block">
          <span className="label-caps">Email</span>
          <input className={`mt-1.5 ${field}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <button type="submit" className={btn.ghost} disabled={busy === "email"}>
          {busy === "email" ? "Sending…" : "Update email"}
        </button>
      </form>

      <form onSubmit={changePassword} className="space-y-4">
        <SectionHeading label="Password" />
        <label className="block">
          <span className="label-caps">New password</span>
          <input
            className={`mt-1.5 ${field}`}
            type="password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button type="submit" className={btn.ghost} disabled={busy === "password"}>
          {busy === "password" ? "Updating…" : "Update password"}
        </button>
      </form>

      <section className="space-y-3">
        <SectionHeading label="Sessions" />
        <p className="text-sm text-muted-foreground">
          Sign out of this workspace on every device where you are currently signed in.
        </p>
        <button className={btn.ghost} onClick={() => void signOutEverywhere()}>
          Sign out everywhere
        </button>
      </section>

      <section className="space-y-2 border-t border-rule pt-6">
        <SectionHeading label="How screening works" />
        <p className="text-sm leading-relaxed text-muted-foreground">
          Uploaded resumes are stored privately and readable only by your account. Text is extracted server-side, then a
          language model parses the candidate details and compares them to the job's requirements. Scores are evidence-based
          and protected characteristics are excluded from the analysis. Every score can be re-run from the candidate page.
        </p>
      </section>
    </div>
  );
}
