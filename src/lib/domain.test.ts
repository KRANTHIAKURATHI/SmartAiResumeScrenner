import { describe, expect, it } from "vitest";
import {
  formatBytes,
  formatExperience,
  formatScore,
  formatScore100,
  relativeTime,
  scoreLabel,
  validateResumeFile,
} from "./domain";

function file(name: string, size: number) {
  const f = new File(["x"], name, { type: "application/octet-stream" });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

describe("score formatting", () => {
  it("renders one decimal, or an em dash when unscored", () => {
    expect(formatScore(7.25)).toBe("7.3");
    expect(formatScore(null)).toBe("—");
  });

  it("scales the 1-10 score onto 100", () => {
    expect(formatScore100(7.2)).toBe("72/100");
    expect(formatScore100(10)).toBe("100/100");
    expect(formatScore100(undefined)).toBe("—");
  });

  it("labels score bands", () => {
    expect(scoreLabel(9)).toBe("Excellent match");
    expect(scoreLabel(7)).toBe("Strong match");
    expect(scoreLabel(6)).toBe("Moderate match");
    expect(scoreLabel(4)).toBe("Partial match");
    expect(scoreLabel(1)).toBe("Weak match");
    expect(scoreLabel(null)).toBe("Not scored");
  });
});

describe("experience and size formatting", () => {
  it("formats years", () => {
    expect(formatExperience(null)).toBe("Not found");
    expect(formatExperience(0)).toBe("Entry level");
    expect(formatExperience(4)).toBe("4 years");
    expect(formatExperience(4.5)).toBe("4.5 years");
  });

  it("formats bytes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });

  it("formats relative time", () => {
    expect(relativeTime(null)).toBe("—");
    expect(relativeTime(new Date().toISOString())).toBe("just now");
    expect(relativeTime(new Date(Date.now() - 5 * 60_000).toISOString())).toBe("5m ago");
    expect(relativeTime(new Date(Date.now() - 3 * 3_600_000).toISOString())).toBe("3h ago");
    expect(relativeTime(new Date(Date.now() - 2 * 86_400_000).toISOString())).toBe("2d ago");
  });
});

describe("resume validation", () => {
  it("accepts supported types under the size cap", () => {
    expect(validateResumeFile(file("cv.pdf", 1024))).toBeNull();
    expect(validateResumeFile(file("CV.DOCX", 1024))).toBeNull();
    expect(validateResumeFile(file("notes.md", 10))).toBeNull();
  });

  it("rejects legacy doc, unknown types, oversized and empty files", () => {
    expect(validateResumeFile(file("cv.doc", 100))).toMatch(/Legacy \.doc/);
    expect(validateResumeFile(file("cv.pages", 100))).toMatch(/Unsupported/);
    expect(validateResumeFile(file("cv.pdf", 11 * 1024 * 1024))).toMatch(/larger than 10 MB/);
    expect(validateResumeFile(file("cv.pdf", 0))).toMatch(/empty/);
  });
});
