import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "srs-theme";

type Theme = "light" | "dark";

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial: Theme =
      stored ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initial);
    apply(initial);
    setReady(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    apply(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
      className={cn(
        "flex items-center gap-2 rounded-sm border border-input px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:border-rule hover:text-foreground",
        className,
      )}
    >
      {dark ? (
        <Moon className="size-3.5" strokeWidth={1.75} aria-hidden />
      ) : (
        <Sun className="size-3.5" strokeWidth={1.75} aria-hidden />
      )}
      <span suppressHydrationWarning>{ready ? (dark ? "Dark" : "Light") : "Theme"}</span>
    </button>
  );
}
