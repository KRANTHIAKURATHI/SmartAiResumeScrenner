import type { ApplicationWithRelations } from "@/lib/queries";

export type SortKey = "score" | "recent" | "experience" | "name";

export type ScreeningFilterState = {
  minScore: number;
  minExperience: number;
  requiredSkill: string;
  status: string;
  sort: SortKey;
};

export const DEFAULT_SCREENING_FILTERS: ScreeningFilterState = {
  minScore: 0,
  minExperience: 0,
  requiredSkill: "all",
  status: "all",
  sort: "score",
};

export const SCORE_BANDS = [
  { value: 0, label: "Any score" },
  { value: 5, label: "50+ / 100" },
  { value: 6, label: "60+ / 100" },
  { value: 7, label: "70+ / 100" },
  { value: 8, label: "80+ / 100" },
  { value: 9, label: "90+ / 100" },
];

export const EXPERIENCE_BANDS = [
  { value: 0, label: "Any experience" },
  { value: 1, label: "1+ years" },
  { value: 3, label: "3+ years" },
  { value: 5, label: "5+ years" },
  { value: 8, label: "8+ years" },
  { value: 12, label: "12+ years" },
];

export const STATUS_OPTIONS = [
  "all",
  "uploaded",
  "processing",
  "screened",
  "reviewing",
  "shortlisted",
  "rejected",
  "error",
];

export function isDefaultFilters(f: ScreeningFilterState) {
  return (
    f.minScore === 0 &&
    f.minExperience === 0 &&
    f.requiredSkill === "all" &&
    f.status === "all" &&
    f.sort === "score"
  );
}

/** Applies the structured screening filters and the chosen ordering. */
export function applyScreeningFilters(
  apps: ApplicationWithRelations[],
  f: ScreeningFilterState,
): ApplicationWithRelations[] {
  const skill = f.requiredSkill === "all" ? null : f.requiredSkill.toLowerCase();

  const filtered = apps.filter((app) => {
    if (f.minScore > 0 && Number(app.match_score ?? 0) < f.minScore) return false;
    if (f.minExperience > 0 && Number(app.candidate?.years_experience ?? 0) < f.minExperience) return false;
    if (f.status !== "all" && app.status !== f.status) return false;
    if (skill) {
      const owned = [...(app.matching_skills ?? []), ...(app.candidate?.skills ?? [])].map((s) =>
        s.toLowerCase(),
      );
      if (!owned.some((s) => s.includes(skill) || skill.includes(s))) return false;
    }
    return true;
  });

  return filtered.sort((a, b) => {
    switch (f.sort) {
      case "recent":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "experience":
        return Number(b.candidate?.years_experience ?? -1) - Number(a.candidate?.years_experience ?? -1);
      case "name":
        return (a.candidate?.name ?? "").localeCompare(b.candidate?.name ?? "");
      default: {
        const sa = a.match_score == null ? -1 : Number(a.match_score);
        const sb = b.match_score == null ? -1 : Number(b.match_score);
        if (sb !== sa) return sb - sa;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    }
  });
}
