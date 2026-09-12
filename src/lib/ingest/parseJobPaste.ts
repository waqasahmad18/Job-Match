import { extractApplyEmail } from "@/lib/extractEmail";

export function parsePastedJob(raw: string) {
  const description = raw.replace(/\r/g, "").trim();
  const lines = description
    .split("\n")
    .map((line) => line.replace(/^[-•\s]+/, "").trim())
    .filter(Boolean);

  const hiringEmail = extractApplyEmail(description);
  const title =
    lines.find((line) =>
      /developer|engineer|programmer|architect|fullstack|full stack|mern|laravel|react/i.test(line),
    ) ||
    lines[0] ||
    "Software Developer";
  const company =
    lines.find((line) => /pvt|private|technologies|solutions|labs|studio|software|systems/i.test(line) && line.length < 80) ||
    lines[1] ||
    "Hiring Team";
  const location =
    lines.find((line) => /lahore|karachi|islamabad|pakistan|remote|onsite|hybrid/i.test(line)) ||
    "Lahore, Pakistan";

  return {
    title: title.slice(0, 160),
    company: company.slice(0, 120),
    location: location.slice(0, 120),
    description,
    hiringEmail,
  };
}
