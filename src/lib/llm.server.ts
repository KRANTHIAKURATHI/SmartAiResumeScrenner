import { z } from "zod";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmError";
  }
}

async function callModel(system: string, user: string): Promise<unknown> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new LlmError("Screening is not configured on the server.");

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[llm] gateway ${response.status}: ${body}`);
    if (response.status === 429) throw new LlmError("Screening is rate limited right now. Try again shortly.");
    if (response.status === 402) throw new LlmError("Screening credits are exhausted for this workspace.");
    throw new LlmError("The screening service didn't respond correctly.");
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new LlmError("The screening service returned an empty response.");

  const jsonText = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(jsonText);
  } catch {
    console.error("[llm] unparsable content", jsonText.slice(0, 500));
    throw new LlmError("The screening service returned an unreadable result.");
  }
}

const NOT_FOUND = "Not found in resume";

const profileSchema = z.object({
  name: z.string().nullish(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  location: z.string().nullish(),
  current_role: z.string().nullish(),
  current_company: z.string().nullish(),
  years_experience: z.union([z.number(), z.string()]).nullish(),
  skills: z.array(z.string()).nullish(),
  education: z
    .array(
      z.object({
        degree: z.string().nullish(),
        field: z.string().nullish(),
        institution: z.string().nullish(),
        year: z.union([z.string(), z.number()]).nullish(),
      }),
    )
    .nullish(),
  certifications: z.array(z.string()).nullish(),
  experience: z
    .array(
      z.object({
        title: z.string().nullish(),
        company: z.string().nullish(),
        duration: z.string().nullish(),
        responsibilities: z.array(z.string()).nullish(),
      }),
    )
    .nullish(),
});

export type CandidateProfile = {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  current_role: string | null;
  current_company: string | null;
  years_experience: number | null;
  skills: string[];
  education: { degree: string | null; field: string | null; institution: string | null; year: string | null }[];
  certifications: string[];
  experience: { title: string | null; company: string | null; duration: string | null; responsibilities: string[] }[];
};

const PROFILE_SYSTEM = `You extract structured candidate data from resume text for a recruitment tool.

Rules:
- Use ONLY facts written in the resume text. Never infer, guess or invent skills, employers, degrees, dates, certifications or responsibilities.
- If a field is not present in the resume, return null (or an empty array).
- Do not extract or infer gender, age, date of birth, ethnicity, nationality, religion, marital status, photographs or any other protected characteristic.
- years_experience must be a number derived from stated employment dates or an explicitly stated total; otherwise null.

Return ONLY a JSON object with this exact shape:
{
  "name": string|null,
  "email": string|null,
  "phone": string|null,
  "location": string|null,
  "current_role": string|null,
  "current_company": string|null,
  "years_experience": number|null,
  "skills": string[],
  "education": [{"degree": string|null, "field": string|null, "institution": string|null, "year": string|null}],
  "certifications": string[],
  "experience": [{"title": string|null, "company": string|null, "duration": string|null, "responsibilities": string[]}]
}`;

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export async function extractCandidateProfile(resumeText: string): Promise<CandidateProfile> {
  const raw = await callModel(PROFILE_SYSTEM, `RESUME TEXT:\n"""\n${resumeText}\n"""`);
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[llm] profile validation failed", parsed.error.issues.slice(0, 5));
    throw new LlmError("We couldn't read a candidate profile out of this resume.");
  }
  const p = parsed.data;
  const years = toNumber(p.years_experience);
  return {
    name: p.name?.trim() || null,
    email: p.email?.trim().toLowerCase() || null,
    phone: p.phone?.trim() || null,
    location: p.location?.trim() || null,
    current_role: p.current_role?.trim() || null,
    current_company: p.current_company?.trim() || null,
    years_experience: years != null ? Math.max(0, Math.min(60, years)) : null,
    skills: (p.skills ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 40),
    education: (p.education ?? []).slice(0, 10).map((e) => ({
      degree: e.degree?.trim() || null,
      field: e.field?.trim() || null,
      institution: e.institution?.trim() || null,
      year: e.year != null ? String(e.year) : null,
    })),
    certifications: (p.certifications ?? []).map((c) => c.trim()).filter(Boolean).slice(0, 20),
    experience: (p.experience ?? []).slice(0, 15).map((x) => ({
      title: x.title?.trim() || null,
      company: x.company?.trim() || null,
      duration: x.duration?.trim() || null,
      responsibilities: (x.responsibilities ?? []).map((r) => r.trim()).filter(Boolean).slice(0, 8),
    })),
  };
}

const matchSchema = z.object({
  match_score: z.union([z.number(), z.string()]),
  match_label: z.string().nullish(),
  matching_skills: z.array(z.string()).nullish(),
  missing_skills: z.array(z.string()).nullish(),
  experience_analysis: z.string().nullish(),
  education_analysis: z.string().nullish(),
  requirement_coverage: z
    .array(
      z.object({
        requirement: z.string(),
        coverage: z.string(),
        evidence: z.string().nullish(),
      }),
    )
    .nullish(),
  justification: z.string().nullish(),
});

export type MatchResult = {
  match_score: number;
  match_label: string;
  matching_skills: string[];
  missing_skills: string[];
  experience_analysis: string;
  education_analysis: string;
  requirement_coverage: { requirement: string; coverage: "matched" | "partial" | "missing"; evidence: string | null }[];
  justification: string;
};

const MATCH_SYSTEM = `You are a screening analyst comparing one candidate resume against one job description for a recruiter.

Method:
- Judge semantic relevance of the candidate's actual experience, skills, education and demonstrated outcomes against the role's requirements. Do not score by keyword frequency.
- Cite only evidence present in the resume or the job description. Never invent skills, employers, degrees, certifications, dates or responsibilities.
- When something required is absent from the resume, list it as missing rather than assuming it.
- Where a field cannot be assessed because the resume lacks the information, write exactly "${NOT_FOUND}".
- Ignore and never reference gender, age, ethnicity, nationality, religion, marital status, photographs, names as an indicator of background, or any other protected or irrelevant personal characteristic. Score job-related evidence only.
- justification must be 2-4 sentences of concrete reasoning tied to specific resume evidence and specific job requirements. Do not write generic praise.
- match_score is an integer or one-decimal number from 1 to 10: 9-10 covers nearly all requirements with strong direct evidence, 7-8 strong with minor gaps, 5-6 partial, 3-4 weak, 1-2 unrelated.
- coverage must be exactly one of "matched", "partial", "missing".

Return ONLY a JSON object with this exact shape:
{
  "match_score": number,
  "match_label": string,
  "matching_skills": string[],
  "missing_skills": string[],
  "experience_analysis": string,
  "education_analysis": string,
  "requirement_coverage": [{"requirement": string, "coverage": "matched"|"partial"|"missing", "evidence": string|null}],
  "justification": string
}`;

export async function matchCandidateToJob(input: {
  job: {
    title: string;
    department: string | null;
    location: string | null;
    employment_type: string | null;
    minimum_experience: number | null;
    required_skills: string[];
    preferred_skills: string[];
    description: string;
  };
  profile: CandidateProfile;
  resumeText: string;
}): Promise<MatchResult> {
  const user = `JOB
Title: ${input.job.title}
Department: ${input.job.department ?? "—"}
Location: ${input.job.location ?? "—"}
Employment type: ${input.job.employment_type ?? "—"}
Minimum experience: ${input.job.minimum_experience ?? 0} years
Required skills: ${input.job.required_skills.join(", ") || "—"}
Preferred skills: ${input.job.preferred_skills.join(", ") || "—"}

JOB DESCRIPTION:
"""
${input.job.description}
"""

STRUCTURED CANDIDATE PROFILE:
${JSON.stringify(input.profile)}

RESUME TEXT:
"""
${input.resumeText}
"""`;

  const raw = await callModel(MATCH_SYSTEM, user);
  const parsed = matchSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[llm] match validation failed", parsed.error.issues.slice(0, 5));
    throw new LlmError("The screening analysis came back in an unexpected format.");
  }
  const m = parsed.data;
  const scoreNumber = toNumber(m.match_score);
  if (scoreNumber == null) throw new LlmError("The screening analysis returned no usable score.");
  const score = Math.round(Math.max(1, Math.min(10, scoreNumber)) * 10) / 10;

  const coverage = (m.requirement_coverage ?? [])
    .slice(0, 20)
    .map((c) => {
      const value = (c.coverage ?? "").toLowerCase();
      const normalised: "matched" | "partial" | "missing" =
        value.startsWith("match") ? "matched" : value.startsWith("part") ? "partial" : "missing";
      return { requirement: c.requirement.trim(), coverage: normalised, evidence: c.evidence?.trim() || null };
    })
    .filter((c) => c.requirement.length > 0);

  return {
    match_score: score,
    match_label: m.match_label?.trim() || "",
    matching_skills: (m.matching_skills ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 30),
    missing_skills: (m.missing_skills ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 30),
    experience_analysis: m.experience_analysis?.trim() || NOT_FOUND,
    education_analysis: m.education_analysis?.trim() || NOT_FOUND,
    requirement_coverage: coverage,
    justification: m.justification?.trim() || NOT_FOUND,
  };
}
