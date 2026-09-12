import type { UserSettings } from "@/types";

export type AiMatchResult = {
  score: number;
  relevant: boolean;
  matched_skills: string[];
  missing_skills: string[];
  reason: string;
};

export async function analyzeJobWithAi(
  job: { title: string; company: string; description: string },
  settings: UserSettings,
): Promise<AiMatchResult | null> {
  const apiKey = process.env.AI_API_KEY;
  const apiUrl = process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions";
  const model = process.env.AI_MODEL || "gpt-4o-mini";

  if (!apiKey) return null;

  const prompt = `Score this software job against the candidate profile. Return only JSON with keys score, relevant, matched_skills, missing_skills, reason.
Reject or score very low if the actual work is primarily WordPress, Shopify, Elementor or WooCommerce.
Never recommend applying to excluded companies: ${(settings.excludedCompanies || []).join(", ") || "Interact Global"}.
Location rules: apply to remote jobs worldwide and remote jobs in Pakistan. Apply to onsite/hybrid jobs only if they are in Lahore, Pakistan. Reject onsite jobs in other cities.
Skip the job if the stated starting salary is below 80000 PKR. There is no maximum salary cap.
Candidate skills: ${settings.skills.join(", ")}
Preferred roles: ${settings.roles.join(", ")}
Locations: ${settings.locations.join(", ")}
Job title: ${job.title}
Company: ${job.company}
Description: ${job.description.slice(0, 6000)}`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You evaluate job-description relevance for a full-stack software developer. Never rely on the title alone. Respect remote/Lahore location rules and never recommend the candidate's current employer.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;
  const parsed = JSON.parse(content) as AiMatchResult;
  return {
    score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
    relevant: Boolean(parsed.relevant),
    matched_skills: parsed.matched_skills || [],
    missing_skills: parsed.missing_skills || [],
    reason: parsed.reason || "AI analysis complete.",
  };
}
