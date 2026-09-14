import { jobFingerprint } from "@/lib/fingerprint";
import { fetchJson } from "@/lib/ingest/http";

type RemoteOkJob = {
  id?: string | number;
  position?: string;
  company?: string;
  location?: string;
  description?: string;
  tags?: string[];
  url?: string;
  apply_url?: string;
  date?: string;
};

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

export function normalizeRemoteOkJob(raw: RemoteOkJob) {
  const title = raw.position?.trim();
  const company = raw.company?.trim();
  const applyUrl = (raw.apply_url || "").trim();
  const sourceUrl = (raw.url || applyUrl).trim();
  const description = `${(raw.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")} ${
    applyUrl.startsWith("mailto:") ? applyUrl : ""
  }`.trim();

  if (!title || !company || !sourceUrl || !description) return null;

  return {
    source: "remoteok",
    externalId: raw.id ? String(raw.id) : undefined,
    sourceUrl,
    title,
    company,
    location: raw.location || "Remote",
    description,
    tags: raw.tags || [],
    fingerprint: jobFingerprint({
      sourceUrl,
      externalId: raw.id ? String(raw.id) : undefined,
      company,
      title,
      description,
    }),
    postedAt: raw.date ? new Date(raw.date) : undefined,
    collectedAt: new Date(),
    status: "new" as const,
  };
}

export async function fetchRemoteOkJobs(limit = 40) {
  const payload = await fetchJson<Array<RemoteOkJob | { legal?: string }>>("https://remoteok.com/api");
  return payload
    .slice(1)
    .map((item) => normalizeRemoteOkJob(item as RemoteOkJob))
    .filter((job): job is NonNullable<typeof job> => Boolean(job))
    .filter((job) => {
      const text = `${job.title} ${job.tags.join(" ")}`.toLowerCase();
      return SOFTWARE_HINTS.some((hint) => text.includes(hint));
    })
    .slice(0, limit);
}
