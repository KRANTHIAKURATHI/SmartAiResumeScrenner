export type ApplicationStatus =
  | "uploaded"
  | "processing"
  | "screened"
  | "failed"
  | "reviewing"
  | "shortlisted"
  | "rejected";

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  uploaded: "Uploaded",
  processing: "Processing",
  screened: "Screened",
  failed: "Failed",
  reviewing: "Reviewing",
  shortlisted: "Shortlisted",
  rejected: "Rejected",
};

export type JobStatus = "active" | "paused" | "closed";

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  active: "Active",
  paused: "Paused",
  closed: "Closed",
};

export function scoreLabel(score: number | null | undefined): string {
  if (score == null) return "Not scored";
  if (score >= 8.5) return "Excellent match";
  if (score >= 7) return "Strong match";
  if (score >= 5.5) return "Moderate match";
  if (score >= 4) return "Partial match";
  return "Weak match";
}

export function formatScore(score: number | null | undefined): string {
  if (score == null) return "—";
  return Number(score).toFixed(1);
}

export function formatExperience(years: number | null | undefined): string {
  if (years == null) return "Not found";
  if (years === 0) return "Entry level";
  return `${Number(years) % 1 === 0 ? years : Number(years).toFixed(1)} yrs`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export type EducationEntry = {
  degree?: string | null;
  institution?: string | null;
  year?: string | null;
  field?: string | null;
};

export type ExperienceEntry = {
  title?: string | null;
  company?: string | null;
  duration?: string | null;
  responsibilities?: string[] | null;
};

export type RequirementCoverageEntry = {
  requirement: string;
  coverage: "matched" | "partial" | "missing";
  evidence?: string | null;
};

export const ACCEPTED_RESUME_TYPES = [".pdf", ".docx", ".txt", ".md"];
export const MAX_RESUME_BYTES = 10 * 1024 * 1024;

export function validateResumeFile(file: File): string | null {
  const lower = file.name.toLowerCase();
  const okExt = ACCEPTED_RESUME_TYPES.some((ext) => lower.endsWith(ext));
  if (lower.endsWith(".doc") && !lower.endsWith(".docx"))
    return "Legacy .doc files aren't supported. Save as .docx or PDF.";
  if (!okExt) return "Unsupported file type. Upload a PDF, DOCX or text resume.";
  if (file.size > MAX_RESUME_BYTES) return "File is larger than 10 MB.";
  if (file.size === 0) return "File is empty.";
  return null;
}
