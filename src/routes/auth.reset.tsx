import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/reset")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set a new password — Smart Resume Screener" },
      { name: "description", content: "Choose a new password for your screening workspace." },
      { property: "og:title", content: "Set a new password — Smart Resume Screener" },
      { property: "og:description", content: "Choose a new password for your screening workspace." },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError("We couldn't update your password. The reset link may have expired — request a new one.");
      return;
    }
    toast.success("Password updated.");
    navigate({ to: "/overview", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-sm">
        <p className="label-caps">Smart Resume Screener</p>
        <h1 className="mt-3 text-3xl">Set a new password</h1>
        <form onSubmit={submit} className="mt-8 space-y-5 border-t border-rule pt-6">
          <label className="block">
            <span className="label-caps">New password</span>
            <input
              className="mt-1.5 w-full rounded-sm border border-input bg-paper px-3 py-2 text-sm outline-none focus:border-primary"
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
