import { jobFingerprint } from "@/lib/fingerprint";

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

type NormalizedJob = {
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
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function isSoftware(title: string, tags: string[]) {
  const text = `${title} ${tags.join(" ")}`.toLowerCase();
  return SOFTWARE_HINTS.some((hint) => text.includes(hint));
}

function toJob(input: {
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

async function fetchArbeitnow(limit: number) {
  const response = await fetch("https://www.arbeitnow.com/api/job-board-api", {
    headers: { Accept: "application/json", "User-Agent": "job-match-automation/1.0" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Arbeitnow failed: ${response.status}`);
  const payload = (await response.json()) as {
    data?: Array<{
      slug?: string;
      title?: string;
      company_name?: string;
      description?: string;
      location?: string;
      url?: string;
      tags?: string[];
      created_at?: number;
    }>;
  };
  return (payload.data || [])
    .map((item) =>
      toJob({
        source: "arbeitnow",
        externalId: item.slug,
        sourceUrl: item.url || "",
        title: item.title || "",
        company: item.company_name || "",
        location: item.location,
        description: item.description || "",
        tags: item.tags || [],
        postedAt: item.created_at ? new Date(item.created_at * 1000) : undefined,
      }),
    )
    .filter((job): job is NormalizedJob => Boolean(job))
    .slice(0, limit);
}

async function fetchRemotive(limit: number) {
  const response = await fetch("https://remotive.com/api/remote-jobs?category=software-dev", {
    headers: { Accept: "application/json", "User-Agent": "job-match-automation/1.0" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Remotive failed: ${response.status}`);
  const payload = (await response.json()) as {
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
  };
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
  const results = await Promise.allSettled([fetchArbeitnow(limit), fetchRemotive(limit)]);
  return results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}
