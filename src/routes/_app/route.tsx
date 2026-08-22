import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";

const CANDIDATE_ALLOWED = ["/candidate", "/profile"];

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roles = (roleRows ?? []).map((r) => r.role as string);
    const isCandidate = roles.includes("candidate") && !roles.includes("recruiter");
    const path = location.pathname;

    if (isCandidate && !CANDIDATE_ALLOWED.some((p) => path === p || path.startsWith(`${p}/`))) {
      throw redirect({ to: "/candidate" });
    }
    if (!isCandidate && (path === "/candidate" || path.startsWith("/candidate/"))) {
      throw redirect({ to: "/overview" });
    }

    return { user: data.user, isCandidate };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
