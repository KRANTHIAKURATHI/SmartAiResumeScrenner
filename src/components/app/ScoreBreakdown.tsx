import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { formatScore100, type RequirementCoverageEntry } from "@/lib/domain";
import { cn } from "@/lib/utils";

export type ScoreBreakdownInput = {
  score: number | null | undefined;
  requiredSkills?: string[] | null;
  preferredSkills?: string[] | null;
  matchingSkills?: string[] | null;
  minimumExperience?: number | null;
  yearsExperience?: number | null;
  coverage?: RequirementCoverageEntry[] | null;
};

type Line = { label: string; detail: string; weight: number; earned: number };

const lower = (list?: string[] | null) => (list ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean);

/** Derives the weighted factors behind a match score from the stored analysis. */
export function buildScoreBreakdown(input: ScoreBreakdownInput): { lines: Line[]; total: number } {
  const matching = new Set(lower(input.matchingSkills));
  const required = lower(input.requiredSkills);
  const preferred = lower(input.preferredSkills);
  const coverage = input.coverage ?? [];

  const requiredHit = required.filter((s) => matching.has(s)).length;
  const preferredHit = preferred.filter((s) => matching.has(s)).length;

  const coverageScore = coverage.length
    ? coverage.reduce((sum, c) => sum + (c.coverage === "matched" ? 1 : c.coverage === "partial" ? 0.5 : 0), 0) /
      coverage.length
    : null;

  const minExp = Number(input.minimumExperience ?? 0);
  const years = input.yearsExperience == null ? null : Number(input.yearsExperience);
  const expRatio = years == null ? null : minExp <= 0 ? 1 : Math.min(1, years / minExp);

  const lines: Line[] = [
    {
      label: "Required skills",
      detail: required.length ? `${requiredHit} of ${required.length} present in resume` : "No required skills listed",
      weight: 40,
      earned: (required.length ? requiredHit / required.length : 1) * 40,
    },
    {
      label: "Requirement coverage",
      detail: coverage.length
        ? `${coverage.filter((c) => c.coverage === "matched").length} matched · ${
            coverage.filter((c) => c.coverage === "partial").length
          } partial · ${coverage.filter((c) => c.coverage === "missing").length} missing`
        : "Not analysed yet",
      weight: 30,
      earned: (coverageScore ?? 0) * 30,
    },
    {
      label: "Experience",
      detail:
        years == null
          ? "Years not found in resume"
          : minExp > 0
            ? `${years} years against ${minExp} years required`
            : `${years} years · no minimum set`,
      weight: 20,
      earned: (expRatio ?? 0) * 20,
    },
    {
      label: "Preferred skills",
      detail: preferred.length ? `${preferredHit} of ${preferred.length} nice-to-haves` : "None listed for this role",
      weight: 10,
      earned: (preferred.length ? preferredHit / preferred.length : 1) * 10,
    },
  ];

  return { lines, total: Math.round(lines.reduce((s, l) => s + l.earned, 0)) };
}

export function ScoreBreakdownCard({ input }: { input: ScoreBreakdownInput }) {
  const { lines, total } = buildScoreBreakdown(input);
  return (
    <div className="w-[17.5rem] max-w-[80vw]">
      <p className="label-caps text-[10px]">How this score was reached</p>
      <p className="mt-1.5 flex items-baseline gap-1.5">
        <span className="numeral text-xl leading-none text-primary">{formatScore100(input.score)}</span>
        <span className="text-[11px] text-muted-foreground">final analysis score</span>
      </p>
      <ul className="mt-2 divide-y divide-rule border-y border-rule">
        {lines.map((line) => {
          const pct = Math.max(0, Math.min(100, (line.earned / line.weight) * 100));
          return (
            <li key={line.label} className="py-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[12px]">{line.label}</span>
                <span className="numeral text-[11px]">
                  {Math.round(line.earned)}
                  <span className="text-muted-foreground">/{line.weight}</span>
                </span>
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{line.detail}</p>
              <div className="mt-1 h-[2px] w-full overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        Weighted factors total <span className="numeral">{total}/100</span>. The final score also weighs the written
        analysis of seniority and role fit, so the two can differ slightly.
      </p>
    </div>
  );
}

export function ScoreWithBreakdown({
  input,
  children,
  className,
}: {
  input: ScoreBreakdownInput;
  children: React.ReactNode;
  className?: string;
}) {
  if (input.score == null) return <>{children}</>;
  return (
    <HoverCard openDelay={80} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label="Show score breakdown"
          className={cn("cursor-help text-left", className)}
        >
          {children}
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={10}
        collisionPadding={16}
        avoidCollisions
        className="max-h-[min(28rem,calc(100vh-2rem))] w-auto overflow-y-auto rounded-[1.5rem] border border-border/60 bg-paper/70 p-4 shadow-xl backdrop-blur-xl backdrop-saturate-150"
      >
        <ScoreBreakdownCard input={input} />
      </HoverCardContent>
    </HoverCard>
  );
}
