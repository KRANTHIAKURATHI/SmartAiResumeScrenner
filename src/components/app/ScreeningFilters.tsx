import { field } from "@/components/app/primitives";
import {
  DEFAULT_SCREENING_FILTERS,
  EXPERIENCE_BANDS,
  SCORE_BANDS,
  STATUS_OPTIONS,
  isDefaultFilters,
  type ScreeningFilterState,
  type SortKey,
} from "@/lib/screening-filters";
import { APPLICATION_STATUS_LABEL } from "@/lib/domain";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "score", label: "Match score" },
  { value: "recent", label: "Most recent" },
  { value: "experience", label: "Experience" },
  { value: "name", label: "Name (A–Z)" },
];

/** Structured filter bar for a ranked screening table. */
export function ScreeningFilters({
  value,
  onChange,
  skills,
  matched,
  total,
}: {
  value: ScreeningFilterState;
  onChange: (next: ScreeningFilterState) => void;
  skills: string[];
  matched: number;
  total: number;
}) {
  const set = <K extends keyof ScreeningFilterState>(key: K, v: ScreeningFilterState[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="mt-4 space-y-3 border-y border-rule py-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block">
          <span className="label-caps">Score band</span>
          <select
            className={field}
            value={value.minScore}
            onChange={(e) => set("minScore", Number(e.target.value))}
          >
            {SCORE_BANDS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label-caps">Experience</span>
          <select
            className={field}
            value={value.minExperience}
            onChange={(e) => set("minExperience", Number(e.target.value))}
          >
            {EXPERIENCE_BANDS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label-caps">Must have skill</span>
          <select
            className={field}
            value={value.requiredSkill}
            onChange={(e) => set("requiredSkill", e.target.value)}
          >
            <option value="all">Any skill</option>
            {skills.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label-caps">Status</span>
          <select className={field} value={value.status} onChange={(e) => set("status", e.target.value)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "all"
                  ? "Any status"
                  : (APPLICATION_STATUS_LABEL[s as keyof typeof APPLICATION_STATUS_LABEL] ?? s)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label-caps">Sort by</span>
          <select
            className={field}
            value={value.sort}
            onChange={(e) => set("sort", e.target.value as SortKey)}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing <span className="numeral text-foreground">{matched}</span> of{" "}
          <span className="numeral text-foreground">{total}</span> resumes
        </span>
        {!isDefaultFilters(value) && (
          <button
            type="button"
            className="underline underline-offset-4 hover:text-primary"
            onClick={() => onChange(DEFAULT_SCREENING_FILTERS)}
          >
            Reset filters
          </button>
        )}
      </div>
    </div>
  );
}
