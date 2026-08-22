import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  component: LandingPage;
});

function LandingPage() {
  return null;
}
