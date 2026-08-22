import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Mode = "signin" | "signup" | "forgot";
type Role = "recruiter" | "candidate";

async function destinationForCurrentUser(): Promise<"/overview" | "/candidate"> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return "/overview";
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const roles = (data ?? []).map((r) => r.role as string);
  return roles.includes("candidate") && !roles.includes("recruiter") ? "/candidate" : "/overview";
}

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Smart Resume Screener" },
      { name: "description", content: "Sign in to screen resumes and rank candidates against your open roles." },
      { property: "og:title", content: "Sign in — Smart Resume Screener" },
      {
        property: "og:description",
        content: "Sign in to screen resumes and rank candidates against your open roles.",
      },
    ],
  }),
  component: AuthPage,
});

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "That email and password combination doesn't match an account.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "An account already exists for this email. Try signing in instead.";
  if (m.includes("email rate limit") || m.includes("over_email_send_rate_limit"))
    return "Supabase's confirmation-email limit for this project has been reached. Turn off \u201cConfirm email\u201d in Supabase Auth settings, or wait about an hour and try again.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts. Wait a moment and try again.";
  if (m.includes("password")) return "Password must be at least 6 characters.";
  if (m.includes("email")) return "Enter a valid email address.";
  return "We couldn't complete that request. Please try again.";
}


function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("recruiter");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        navigate({ to: await destinationForCurrentUser(), replace: true });
      } else if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, role },
            emailRedirectTo: `${window.location.origin}${role === "candidate" ? "/candidate" : "/overview"}`,
          },
        });
        if (err) throw err;
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          navigate({ to: role === "candidate" ? "/candidate" : "/overview", replace: true });
        } else {
          toast.success("Account created. Check your inbox to confirm your email.");
          setMode("signin");
        }
      } else {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset`,
        });
        if (err) throw err;
        toast.success("Password reset link sent. Check your inbox.");
        setMode("signin");
      }
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-sm">
        <p className="label-caps">Smart Resume Screener</p>
        <h1 className="mt-3 text-3xl leading-tight">
          {mode === "signin" ? "Sign in" : mode === "signup" ? "Create your account" : "Reset your password"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Continue to your screening workspace."
            : mode === "signup"
              ? role === "candidate"
                ? "Apply to open roles and follow the progress of every application."
                : "Your jobs, candidates and resumes stay private to your account."
              : "We'll email you a link to set a new password."}
        </p>

        <form onSubmit={submit} className="mt-8 space-y-5 border-t border-rule pt-6">
          {mode === "signup" && (
            <fieldset>
              <span className="label-caps">I am a</span>
              <div className="mt-1.5 flex divide-x divide-rule border border-input">
                {(["recruiter", "candidate"] as Role[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    aria-pressed={role === r}
                    className={`flex-1 px-3 py-2 text-sm capitalize transition-colors ${
                      role === r ? "bg-primary text-primary-foreground" : "bg-paper text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {role === "recruiter"
                  ? "Create roles, upload resumes and rank candidates."
                  : "Browse open roles and apply with your PDF or Word resume."}
              </p>
            </fieldset>
          )}
          {mode === "signup" && (
            <Field label="Full name">
              <input
                className={inputClass}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                required
              />
            </Field>
          )}
          <Field label="Email">
            <input
              className={inputClass}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </Field>
          {mode !== "forgot" && (
            <Field label="Password">
              <input
                className={inputClass}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                minLength={6}
                required
              />
            </Field>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {busy
              ? "Working…"
              : mode === "signin"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : "Send reset link"}
          </button>
        </form>

        <div className="mt-6 space-y-2 border-t border-rule pt-4 text-sm text-muted-foreground">
          {mode === "signin" ? (
            <>
              <p>
                No account?{" "}
                <button className="text-primary hover:underline" onClick={() => setMode("signup")}>
                  Create one
                </button>
              </p>
              <p>
                <button className="text-primary hover:underline" onClick={() => setMode("forgot")}>
                  Forgot your password?
                </button>
              </p>
            </>
          ) : (
            <p>
              <button className="text-primary hover:underline" onClick={() => setMode("signin")}>
                Back to sign in
              </button>
            </p>
          )}
          <p className="pt-2">
            <Link to="/" className="hover:underline">
              Continue to workspace
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-sm border border-input bg-paper px-3 py-2 text-sm outline-none transition-colors focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-caps">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
