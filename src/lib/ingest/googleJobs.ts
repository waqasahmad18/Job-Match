import { fetchJson } from "@/lib/ingest/http";
import { toJob, type NormalizedJob } from "@/lib/ingest/publicBoards";

const SOFTWARE_TAGS = ["react", "next.js", "node", "javascript", "laravel", "python", "full stack", "mern"];

const LAHORE_FULLSTACK_QUERIES = [
  "full stack developer in Lahore, Pakistan",
  "mern stack developer in Lahore, Pakistan",
  "react next.js developer in Lahore, Pakistan",
  "node.js developer in Lahore, Pakistan",
  "laravel developer in Lahore, Pakistan",
  "software engineer full stack Lahore",
  "typescript developer Lahore Pakistan",
  "php developer Lahore Pakistan",
];

async function fetchJSearch(query: string, limit: number) {
  const key = process.env.RAPIDAPI_KEY?.trim();
  if (!key) return [];
  const url = new URL("https://jsearch.p.rapidapi.com/search");
  url.searchParams.set("query", query);
  url.searchParams.set("page", "1");
  url.searchParams.set("num_pages", "1");
  url.searchParams.set("country", "pk");
  url.searchParams.set("date_posted", "month");
  const payload = await fetchJson<{
    data?: Array<{
      job_id?: string;
      job_title?: string;
      employer_name?: string;
      job_city?: string;
      job_country?: string;
      job_description?: string;
      job_apply_link?: string;
      job_posted_at_datetime_utc?: string;
      job_employment_type?: string;
    }>;
  }>(url.toString(), {
    "X-RapidAPI-Key": key,
    "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
  });
  return (payload.data || [])
    .map((item) =>
      toJob({
        source: "jsearch",
        externalId: item.job_id,
        sourceUrl: item.job_apply_link || "",
        title: item.job_title || "",
        company: item.employer_name || "",
        location: [item.job_city || "Lahore", item.job_country || "Pakistan"].filter(Boolean).join(", "),
        description: `${item.job_description || item.job_title || ""}\n\nFull-stack target role from Google Jobs (JSearch).`,
        tags: SOFTWARE_TAGS,
        postedAt: item.job_posted_at_datetime_utc ? new Date(item.job_posted_at_datetime_utc) : undefined,
      }),
    )
    .filter((job): job is NormalizedJob => Boolean(job))
    .filter((job) =>
      /full\s*stack|mern|react|next|node|laravel|javascript|typescript|software engineer|php|django|python/i.test(
        `${job.title} ${job.description}`,
      ),
    )
    .slice(0, limit);
}

/** Only 2 rotating Google queries per run so Vercel does not time out. */
export async function fetchLahoreGoogleJobs(limit = 20) {
  if (!process.env.RAPIDAPI_KEY?.trim()) {
    return { jobs: [] as NormalizedJob[], error: "RAPIDAPI_KEY missing — Google Jobs (JSearch) skipped." };
  }
  const start = Math.floor(Date.now() / (3 * 60 * 60 * 1000)) % LAHORE_FULLSTACK_QUERIES.length;
  const queries = [
    LAHORE_FULLSTACK_QUERIES[start],
    LAHORE_FULLSTACK_QUERIES[(start + 1) % LAHORE_FULLSTACK_QUERIES.length],
  ];
  const results = await Promise.allSettled(queries.map((query) => fetchJSearch(query, Math.max(6, Math.ceil(limit / 2)))));
  const jobs: NormalizedJob[] = [];
  const errors: string[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") jobs.push(...result.value);
    else errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
  }
  const seen = new Set<string>();
  const unique = jobs.filter((job) => {
    if (seen.has(job.fingerprint)) return false;
    seen.add(job.fingerprint);
    return true;
  });
  return { jobs: unique.slice(0, limit), error: errors[0] };
}

export function hasGoogleJobsKey() {
  return Boolean(process.env.RAPIDAPI_KEY?.trim());
}
