import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatScore, scoreLabel, APPLICATION_STATUS_LABEL, type ApplicationStatus } from "@/lib/domain";
import { Skeleton } from "@/components/ui/skeleton";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="border-b border-rule pb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          {eyebrow && <p className="label-caps">{eyebrow}</p>}
          <h1 className="mt-2 text-3xl leading-tight md:text-4xl">{title}</h1>
          {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function SectionHeading({
  label,
  action,
  className,
}: {
  label: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between border-b border-rule pb-2", className)}>
      <h2 className="label-caps">{label}</h2>
      {action}
    </div>
  );
}

export function MetricStrip({
  items,
}: {
  items: { label: string; value: ReactNode; hint?: string }[];
}) {
  return (
    <dl className="grid grid-cols-2 divide-rule border-y border-rule sm:grid-cols-4 sm:divide-x">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={cn(
            "px-0 py-4 sm:px-5",
            i % 2 === 1 && "border-l border-rule sm:border-l-0",
            i > 1 && "border-t border-rule sm:border-t-0",
            i === 0 && "sm:pl-0",
          )}
        >
          <dt className="label-caps">{item.label}</dt>
          <dd className="numeral mt-1.5 text-3xl leading-none">{item.value}</dd>
          {item.hint && <p className="mt-1.5 text-xs text-muted-foreground">{item.hint}</p>}
        </div>
      ))}
    </dl>
  );
}

export function Score({
  value,
  size = "md",
  showLabel = true,
  showBar = false,
}: {
  value: number | null | undefined;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  showBar?: boolean;
}) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, (Number(value) / 10) * 100));
  const sizes = { sm: "text-lg", md: "text-2xl", lg: "text-5xl" } as const;
  return (
    <div>
      <p className="flex items-baseline gap-1">
        <span className={cn("numeral leading-none", sizes[size], value != null && "text-primary")}>
          {formatScore(value)}
        </span>
        <span className="text-xs text-muted-foreground">/10</span>
      </p>
      {showLabel && <p className="mt-1 text-xs text-muted-foreground">{scoreLabel(value)}</p>}
      {showBar && (
        <div className="mt-2 h-[3px] w-full bg-border">
          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export function ScoreBar({ label, value, max = 10 }: { label: string; value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="py-2.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm">{label}</span>
        <span className="numeral text-sm">
          {Number.isInteger(value) ? value : value.toFixed(1)}
          <span className="text-xs text-muted-foreground">/{max}</span>
        </span>
      </div>
      <div className="mt-1.5 h-[3px] w-full bg-border">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function StatusText({ status }: { status: string }) {
  const label = APPLICATION_STATUS_LABEL[status as ApplicationStatus] ?? status;
  const emphasised = status === "shortlisted";
  const muted = status === "rejected" || status === "uploaded";
  const danger = status === "failed";
  return (
    <span
      className={cn(
        "text-xs tracking-wide",
        emphasised && "font-medium text-primary",
        danger && "text-destructive",
        muted && "text-muted-foreground",
        !emphasised && !danger && !muted && "text-foreground",
      )}
    >
      {label}
      {status === "processing" && <span className="ml-1 animate-pulse">·</span>}
    </span>
  );
}

export function SkillList({ skills, limit }: { skills: string[]; limit?: number }) {
  if (!skills?.length) return <span className="text-xs text-muted-foreground">Not found in resume</span>;
  const shown = limit ? skills.slice(0, limit) : skills;
  const rest = limit ? skills.length - shown.length : 0;
  return (
    <span className="flex flex-wrap gap-1.5">
      {shown.map((s) => (
        <span key={s} className="rounded-sm border border-rule bg-paper px-1.5 py-0.5 text-xs">
          {s}
        </span>
      ))}
      {rest > 0 && <span className="px-1 py-0.5 text-xs text-muted-foreground">+{rest}</span>}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="border-b border-rule py-16">
      <h3 className="font-serif text-xl">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-rule border-b border-rule">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-4 py-3.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className="h-4 rounded-sm" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="border-l-2 border-destructive bg-paper px-4 py-3">
      <p className="text-sm text-destructive">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-1.5 text-xs text-primary hover:underline">
          Try again
        </button>
      )}
    </div>
  );
}

export const btn = {
  primary:
    "inline-flex items-center gap-1.5 rounded-sm bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60",
  ghost:
    "inline-flex items-center gap-1.5 rounded-sm border border-input bg-paper px-3 py-2 text-sm transition-colors hover:bg-accent disabled:opacity-60",
  quiet: "text-xs text-muted-foreground transition-colors hover:text-primary",
};

export const field =
  "w-full rounded-sm border border-input bg-paper px-3 py-2 text-sm outline-none transition-colors focus:border-primary";

export function Th({ children, numeric, className }: { children?: ReactNode; numeric?: boolean; className?: string }) {
  return (
    <th
      className={cn(
        "sticky top-0 z-10 border-b border-rule bg-background py-2.5 pr-4 text-left label-caps font-medium",
        numeric && "text-right",
        className,
      )}
      scope="col"
    >
      {children}
    </th>
  );
}

export function Td({ children, numeric, className }: { children?: ReactNode; numeric?: boolean; className?: string }) {
  return <td className={cn("py-3 pr-4 align-middle text-sm", numeric && "text-right", className)}>{children}</td>;
}
