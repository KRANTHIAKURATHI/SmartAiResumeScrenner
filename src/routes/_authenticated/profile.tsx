import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { profileQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, SectionHeading, InlineError, btn, field } from "@/components/app/primitives";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — Smart Resume Screener" },
      { name: "description", content: "Update the recruiter name and email shown across your screening workspace." },
      { property: "og:title", content: "Your profile — Smart Resume Screener" },
      { property: "og:description", content: "Update the recruiter name and email shown across your screening workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => <InlineError message={error.message} />,
  component: ProfilePage,
});

function ProfilePage() {
  const queryClient = useQueryClient();
  const { data: profile } = useSuspenseQuery(profileQuery());
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
  }, [profile?.full_name]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() || null })
      .eq("user_id", profile.user_id);
    setBusy(false);
    if (error) { toast.error("Your profile could not be saved."); return; }
    toast.success("Profile updated.");
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  }

  return (
    <div className="max-w-xl space-y-8">
      <PageHeader eyebrow="Account" title="Your profile" description="Used to label your workspace. Not shared with candidates." />

      <form onSubmit={save} className="space-y-5">
        <SectionHeading label="Details" />
        <label className="block">
          <span className="label-caps">Full name</span>
          <input className={`mt-1.5 ${field}`} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
        </label>
        <label className="block">
          <span className="label-caps">Email</span>
          <input className={`mt-1.5 ${field} text-muted-foreground`} value={profile?.email ?? ""} readOnly />
          <span className="mt-1 block text-xs text-muted-foreground">Sign-in email — change it from Settings.</span>
        </label>
        <button type="submit" className={btn.primary} disabled={busy}>
          {busy ? "Saving…" : "Save profile"}
        </button>
      </form>
    </div>
  );
}
