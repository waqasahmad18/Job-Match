import { jobFingerprint } from "@/lib/fingerprint";
import { fetchJson } from "@/lib/ingest/http";

const SOFTWARE_HINTS = [
  "react",
  "next",
  "node",
  "javascript",
  "typescript",
  "php",
  "laravel",
  "python",
  "django",
  "full stack",
  "fullstack",
  "software",
  "backend",
  "frontend",
  "engineer",
  "developer",
];

export type NormalizedJob = {
  source: string;
  externalId?: string;
  sourceUrl: string;
  title: string;
  company: string;
  location: string;
  description: string;
  tags: string[];
  fingerprint: string;
  postedAt?: Date;
  collectedAt: Date;
  status: "new";
};

function clean(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSoftware(title: string, tags: string[]) {
  const text = `${title} ${tags.join(" ")}`.toLowerCase();
  return SOFTWARE_HINTS.some((hint) => text.includes(hint));
}

export function toJob(input: {
  source: string;
  externalId?: string;
  sourceUrl: string;
  title: string;
  company: string;
  location?: string;
  description: string;
  tags?: string[];
  postedAt?: Date;
}): NormalizedJob | null {
  const title = input.title.trim();
  const company = input.company.trim();
  const sourceUrl = input.sourceUrl.trim();
  const description = clean(input.description);
  if (!title || !company || !sourceUrl || !description) return null;
  if (!isSoftware(title, input.tags || [])) return null;
  return {
    source: input.source,
    externalId: input.externalId,
    sourceUrl,
    title,
    company,
    location: input.location || "Remote",
    description,
    tags: input.tags || [],
    fingerprint: jobFingerprint({
      sourceUrl,
      externalId: input.externalId,
      company,
      title,
      description,
    }),
    postedAt: input.postedAt,
    collectedAt: new Date(),
    status: "new",
  };
}

async function fetchRemotive(limit: number) {
  const payload = await fetchJson<{
    jobs?: Array<{
      id?: number;
      title?: string;
      company_name?: string;
      url?: string;
      description?: string;
      candidate_required_location?: string;
      tags?: string[];
      publication_date?: string;
    }>;
  }>("https://remotive.com/api/remote-jobs?category=software-dev");
  return (payload.jobs || [])
    .map((item) =>
      toJob({
        source: "remotive",
        externalId: item.id ? String(item.id) : undefined,
        sourceUrl: item.url || "",
        title: item.title || "",
        company: item.company_name || "",
        location: item.candidate_required_location,
        description: item.description || "",
        tags: item.tags || [],
        postedAt: item.publication_date ? new Date(item.publication_date) : undefined,
      }),
    )
    .filter((job): job is NormalizedJob => Boolean(job))
    .slice(0, limit);
}

export async function fetchPublicBoardJobs(limit = 40) {
  return fetchRemotive(limit);
}
