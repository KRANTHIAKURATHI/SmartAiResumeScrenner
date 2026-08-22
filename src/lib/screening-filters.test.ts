import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCREENING_FILTERS,
  applyScreeningFilters,
  isDefaultFilters,
  type ScreeningFilterState,
} from "./screening-filters";
import type { ApplicationWithRelations } from "./queries";

function app(over: {
  id: string;
  score: number | null;
  years?: number | null;
  status?: string;
  name?: string;
  skills?: string[];
  matching?: string[];
  created?: string;
}): ApplicationWithRelations {
  return {
    id: over.id,
    job_id: "j1",
    candidate_id: `c-${over.id}`,
    match_score: over.score,
    match_label: null,
    match_summary: null,
    matching_skills: over.matching ?? [],
    missing_skills: [],
    experience_analysis: null,
    education_analysis: null,
    requirement_coverage: null,
    status: over.status ?? "screened",
    error_message: null,
    recruiter_notes: null,
    source_filename: null,
    screened_at: null,
    shortlisted_at: null,
    created_at: over.created ?? "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    candidate: {
      id: `c-${over.id}`,
      name: over.name ?? `Candidate ${over.id}`,
      email: null,
      phone: null,
      location: null,
      current_role: null,
      current_company: null,
      years_experience: over.years ?? null,
      skills: over.skills ?? [],
      education: null,
      certifications: null,
      experience: null,
      resume_filename: null,
      resume_path: null,
      parsed_resume: null,
      created_at: "2026-01-01T00:00:00.000Z",
    },
    job: null,
  } as ApplicationWithRelations;
}

const filters = (over: Partial<ScreeningFilterState> = {}): ScreeningFilterState => ({
  ...DEFAULT_SCREENING_FILTERS,
  ...over,
});

const rows = [
  app({ id: "a", score: 9.1, years: 8, name: "Asha", skills: ["React", "Node"], created: "2026-02-01T00:00:00.000Z" }),
  app({ id: "b", score: 6.4, years: 2, name: "Bo", matching: ["Python"], status: "reviewing" }),
  app({ id: "c", score: null, years: null, name: "Cy", status: "processing" }),
];

describe("applyScreeningFilters", () => {
  it("sorts by score by default and puts unscored rows last", () => {
    expect(applyScreeningFilters(rows, filters()).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("filters by minimum score", () => {
    expect(applyScreeningFilters(rows, filters({ minScore: 7 })).map((r) => r.id)).toEqual(["a"]);
  });

  it("filters by minimum experience", () => {
    expect(applyScreeningFilters(rows, filters({ minExperience: 3 })).map((r) => r.id)).toEqual(["a"]);
  });

  it("filters by status", () => {
    expect(applyScreeningFilters(rows, filters({ status: "reviewing" })).map((r) => r.id)).toEqual(["b"]);
  });

  it("matches a required skill across candidate skills and matched skills, case-insensitively", () => {
    expect(applyScreeningFilters(rows, filters({ requiredSkill: "react" })).map((r) => r.id)).toEqual(["a"]);
    expect(applyScreeningFilters(rows, filters({ requiredSkill: "Python" })).map((r) => r.id)).toEqual(["b"]);
    expect(applyScreeningFilters(rows, filters({ requiredSkill: "Rust" }))).toHaveLength(0);
  });

  it("supports the alternate sort orders", () => {
    expect(applyScreeningFilters(rows, filters({ sort: "name" })).map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(applyScreeningFilters(rows, filters({ sort: "experience" })).map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(applyScreeningFilters(rows, filters({ sort: "recent" }))[0]!.id).toBe("a");
  });

  it("never mutates the input array", () => {
    const input = [...rows];
    applyScreeningFilters(input, filters({ sort: "name" }));
    expect(input.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

describe("isDefaultFilters", () => {
  it("detects the untouched state", () => {
    expect(isDefaultFilters(DEFAULT_SCREENING_FILTERS)).toBe(true);
    expect(isDefaultFilters(filters({ minScore: 5 }))).toBe(false);
  });
});
