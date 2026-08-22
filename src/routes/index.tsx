import { createFileRoute, Link } from "@tanstack/react-router";
import { btn } from "@/components/app/primitives";
import { ThemeToggle } from "@/components/app/ThemeToggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Smart Resume Screener — evidence-based resume screening" },
      {
        name: "description",
        content:
          "Upload resumes, extract real candidate detail, and rank applicants against a role's requirements with a transparent 1-10 match score.",
      },
      { property: "og:title", content: "Smart Resume Screener — evidence-based resume screening" },
      {
        property: "og:description",
        content:
          "Upload resumes, extract real candidate detail, and rank applicants against a role's requirements with a transparent 1-10 match score.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LandingPage,
});

const STEPS = [
  {
    n: "01",
    title: "Describe the role once",
    body: "Required skills, preferred skills, minimum experience and the full description become the yardstick for every resume.",
  },
  {
    n: "02",
    title: "Drop in resumes",
    body: "PDF or text files are stored privately, then read server-side so the analysis works on the actual document text.",
  },
  {
    n: "03",
    title: "Read the reasoning",
    body: "Each candidate gets a 1-10 score, matched and missing skills, requirement-by-requirement coverage and a written justification.",
  },
  {
    n: "04",
    title: "Shortlist with evidence",
    body: "Rank, filter by score and advance candidates while keeping the analysis that justified the decision.",
  },
];

function LandingPage() {
  return (
    <main className="mx-auto max-w-[1100px] px-6 py-14 md:px-10 md:py-24">
      <div className="flex items-center justify-between gap-4">
        <p className="label-caps">Smart Resume Screener</p>
        <ThemeToggle />
      </div>

      <h1 className="mt-6 max-w-3xl text-4xl leading-[1.05] md:text-6xl">
        Screening that shows its <span className="text-primary">reasoning</span>, not just a number.
      </h1>

      <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
        Create a role, upload the resumes you actually received, and get a ranked pipeline where every score is tied to
        evidence found in the document — skills present, requirements missed, experience assessed.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link to="/overview" className={btn.primary}>
          Open the screening desk
        </Link>
        <Link to="/apply" className={btn.ghost}>
          Apply to an open role
        </Link>
      </div>

      <section className="mt-20 border-t border-rule">
        <h2 className="label-caps mt-6">How it works</h2>
        <ol className="mt-6 grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {STEPS.map((step) => (
            <li key={step.n} className="border-t border-rule pt-4">
              <p className="numeral text-sm text-primary">{step.n}</p>
              <h3 className="mt-1 font-serif text-2xl leading-snug">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-20 grid gap-8 border-t border-rule pt-6 sm:grid-cols-3">
        {[
          ["Private by default", "Resumes are stored in a private bucket and only ever read server-side for screening."],
          ["No invented detail", "If something isn't in the resume, it is reported as not found rather than guessed."],
          ["Bias-aware prompts", "Protected characteristics are excluded from parsing and scoring; only job-related evidence counts."],
        ].map(([title, body]) => (
          <div key={title}>
            <h3 className="font-serif text-xl">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
