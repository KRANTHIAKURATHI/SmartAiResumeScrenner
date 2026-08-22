import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreBreakdownCard, buildScoreBreakdown } from "./ScoreBreakdown";

const full = {
  score: 8.4,
  requiredSkills: ["React", "TypeScript"],
  preferredSkills: ["GraphQL"],
  matchingSkills: ["react", "typescript", "graphql"],
  minimumExperience: 4,
  yearsExperience: 6,
  coverage: [
    { requirement: "Ship UI", coverage: "matched" as const },
    { requirement: "Own testing", coverage: "partial" as const },
  ],
};

describe("buildScoreBreakdown", () => {
  it("awards the full 100 when every factor is met", () => {
    const { total } = buildScoreBreakdown({
      ...full,
      coverage: [{ requirement: "Ship UI", coverage: "matched" }],
    });
    expect(total).toBe(100);
  });

  it("weights the four factors 40/30/20/10", () => {
    const { lines } = buildScoreBreakdown(full);
    expect(lines.map((l) => [l.label, l.weight])).toEqual([
      ["Required skills", 40],
      ["Requirement coverage", 30],
      ["Experience", 20],
      ["Preferred skills", 10],
    ]);
  });

  it("counts partial coverage as half credit", () => {
    const { lines } = buildScoreBreakdown(full);
    expect(lines[1]!.earned).toBeCloseTo(22.5);
    expect(lines[1]!.detail).toBe("1 matched · 1 partial · 0 missing");
  });

  it("caps experience credit at the required minimum", () => {
    const { lines } = buildScoreBreakdown({ ...full, yearsExperience: 20 });
    expect(lines[2]!.earned).toBe(20);
  });

  it("gives no experience credit when years are missing from the resume", () => {
    const { lines } = buildScoreBreakdown({ ...full, yearsExperience: null });
    expect(lines[2]!.earned).toBe(0);
    expect(lines[2]!.detail).toBe("Years not found in resume");
  });

  it("does not penalise a role that lists no required or preferred skills", () => {
    const { lines } = buildScoreBreakdown({
      score: 5,
      requiredSkills: [],
      preferredSkills: [],
      matchingSkills: [],
      minimumExperience: 0,
      yearsExperience: 2,
      coverage: [],
    });
    expect(lines[0]!.earned).toBe(40);
    expect(lines[3]!.earned).toBe(10);
  });

  it("matches skills case- and whitespace-insensitively", () => {
    const { lines } = buildScoreBreakdown({
      ...full,
      requiredSkills: [" REACT ", "TypeScript"],
    });
    expect(lines[0]!.earned).toBe(40);
  });
});

describe("ScoreBreakdownCard", () => {
  it("renders the heading, the 100-point score and every factor row", () => {
    render(<ScoreBreakdownCard input={full} />);
    expect(screen.getByText("How this score was reached")).toBeTruthy();
    expect(screen.getByText("84/100")).toBeTruthy();
    for (const label of ["Required skills", "Requirement coverage", "Experience", "Preferred skills"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getAllByText(/\/40|\/30|\/20|\/10/).length).toBeGreaterThan(0);
  });
});
