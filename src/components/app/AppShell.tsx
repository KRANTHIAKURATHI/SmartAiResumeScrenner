import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, LayoutList, Briefcase, Users, Bookmark, Settings, UserRound, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const primaryNav = [
  { to: "/", label: "Overview", icon: LayoutList },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/candidates", label: "Candidates", icon: Users },
  { to: "/shortlist", label: "Shortlist", icon: Bookmark },
] as const;

const secondaryNav = [
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/profile", label: "Profile", icon: UserRound },
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const item = (to: string, label: string, Icon: typeof Menu) => {
    const active = pathname === to || pathname.startsWith(`${to}/`);
    return (
      <Link
        key={to}
        to={to}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-2.5 border-l-2 py-1.5 pl-3 text-sm transition-colors",
          active
            ? "border-primary font-medium text-primary"
            : "border-transparent text-muted-foreground hover:border-rule hover:text-foreground",
        )}
      >
        <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
        <span className="lg:inline">{label}</span>
      </Link>
    );
  };

  return (
    <nav className="flex flex-col gap-0.5">
      {primaryNav.map((n) => item(n.to, n.label, n.icon))}
      <div className="my-4 border-t border-rule" />
      {secondaryNav.map((n) => item(n.to, n.label, n.icon))}
    </nav>
  );
}

function useEmail() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);
  return email;
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const email = useEmail();
  const [menuOpen, setMenuOpen] = useState(false);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-rule bg-paper px-4 py-3 md:hidden">
        <Link to="/overview" className="font-serif text-lg leading-none">
          Resume Screener
        </Link>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger className="rounded-sm border border-input p-1.5" aria-label="Open menu">
            <Menu className="size-4" strokeWidth={1.75} />
          </SheetTrigger>
          <SheetContent side="left" className="w-64 bg-paper">
            <SheetHeader>
              <SheetTitle className="font-serif text-lg font-normal">Resume Screener</SheetTitle>
            </SheetHeader>
            <div className="mt-6 px-2">
              <NavList onNavigate={() => setMenuOpen(false)} />
              <div className="mt-8 border-t border-rule pt-4">
                <p className="truncate text-xs text-muted-foreground">{email}</p>
                <button
                  onClick={signOut}
                  className="mt-2 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="size-3.5" strokeWidth={1.75} /> Sign out
                </button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <div className="flex">
        {/* Desktop / tablet sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[176px] shrink-0 flex-col border-r border-rule bg-sidebar px-4 py-6 md:flex lg:w-[220px]">
          <Link to="/overview" className="block px-3">
            <span className="font-serif text-xl leading-none">Resume</span>
            <span className="block font-serif text-xl leading-none">Screener</span>
          </Link>
          <div className="mt-8">
            <NavList />
          </div>
          <div className="mt-auto border-t border-rule px-3 pt-4">
            <p className="truncate text-xs text-muted-foreground" title={email ?? ""}>
              {email ?? "—"}
            </p>
            <button
              onClick={signOut}
              className="mt-2 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOut className="size-3.5" strokeWidth={1.75} /> Sign out
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1180px] px-5 py-8 md:px-10 md:py-12">{children}</div>
        </main>
      </div>
    </div>
  );
}
