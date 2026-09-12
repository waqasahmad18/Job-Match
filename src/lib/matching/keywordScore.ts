import type { UserSettings } from "@/types";

type ScoreResult = {
  score: number;
  relevant: boolean;
  matchedSkills: string[];
  missingSkills: string[];
  reason: string;
};

function includesAny(text: string, terms: string[]) {
  return terms.filter((term) => text.includes(term.toLowerCase()));
}

export function scoreJobByKeywords(
  job: { title: string; description: string; location?: string; tags?: string[] },
  settings: UserSettings,
): ScoreResult {
  const haystack = `${job.title} ${job.location || ""} ${job.description} ${(job.tags || []).join(" ")}`.toLowerCase();
  const skills = settings.skills.length ? settings.skills : settings.targetTechnologies;
  const matchedSkills = includesAny(haystack, skills);
  const missingSkills = skills.filter((skill) => !matchedSkills.includes(skill)).slice(0, 6);

  const roleHits = includesAny(haystack, settings.roles);
  const remoteOrLahore =
    /remote|worldwide|anywhere|pakistan|lahore/.test(haystack);

  const skillScore = Math.min(70, matchedSkills.length * 8);
  const roleScore = roleHits.length ? 20 : job.title.toLowerCase().includes("software") ? 12 : 0;
  const locationScore = remoteOrLahore ? 10 : 0;
  const score = Math.min(99, skillScore + roleScore + locationScore);

  const relevant = score >= 55 && matchedSkills.length >= 2;

  return {
    score,
    relevant,
    matchedSkills,
    missingSkills,
    reason: relevant
      ? `Keyword match on ${matchedSkills.slice(0, 5).join(", ") || "core stack"}.`
      : "Not enough overlap with the configured full-stack skill profile.",
  };
}
