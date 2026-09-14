import { toJob, type NormalizedJob } from "@/lib/ingest/publicBoards";

const SOFTWARE_TAGS = ["react", "next.js", "node", "javascript", "laravel", "python"];

async function fetchJobicy(limit: number, extra = "") {
  const response = await fetch(`https://jobicy.com/api/v2/remote-jobs?count=50&tag=javascript${extra}`, {
    headers: { Accept: "application/json", "User-Agent": "job-match-automation/1.0" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Jobicy failed: ${response.status}`);
  const payload = (await response.json()) as {
    jobs?: Array<{
      id?: number;
      jobTitle?: string;
      companyName?: string;
      jobGeo?: string;
      url?: string;
      jobDescription?: string;
      pubDate?: string;
    }>;
  };
  return (payload.jobs || [])
    .map((item) =>
      toJob({
        source: "jobicy",
        externalId: item.id ? String(item.id) : undefined,
        sourceUrl: item.url || "",
        title: item.jobTitle || "",
        company: item.companyName || "",
        location: item.jobGeo,
        description: item.jobDescription || "",
        tags: SOFTWARE_TAGS,
        postedAt: item.pubDate ? new Date(item.pubDate) : undefined,
      }),
    )
    .filter((job): job is NormalizedJob => Boolean(job))
    .slice(0, limit);
}

async function fetchHimalayas(limit: number) {
  const response = await fetch("https://www.himalayas.app/jobs/api?limit=40", {
    headers: { Accept: "application/json", "User-Agent": "job-match-automation/1.0" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Himalayas failed: ${response.status}`);
  const payload = (await response.json()) as {
    jobs?: Array<{
      title?: string;
      excerpt?: string;
      companyName?: string;
      companySlug?: string;
      applicationUrl?: string;
      guid?: string;
      createdAt?: string;
    }>;
  };
  return (payload.jobs || [])
    .map((item) =>
      toJob({
        source: "himalayas",
        externalId: item.guid,
        sourceUrl: item.applicationUrl || (item.companySlug && item.guid ? `https://himalayas.app/companies/${item.companySlug}/jobs/${item.guid}` : ""),
        title: item.title || "",
        company: item.companyName || "",
        location: "Remote",
        description: item.excerpt || item.title || "",
        tags: SOFTWARE_TAGS,
        postedAt: item.createdAt ? new Date(item.createdAt) : undefined,
      }),
    )
    .filter((job): job is NormalizedJob => Boolean(job))
    .slice(0, limit);
}

async function fetchMuse(limit: number) {
  const response = await fetch(
    "https://www.themuse.com/api/public/jobs?page=1&category=Software%20Engineering&descending=true",
    {
      headers: { Accept: "application/json", "User-Agent": "job-match-automation/1.0" },
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error(`The Muse failed: ${response.status}`);
  const payload = (await response.json()) as {
    results?: Array<{
      id?: number;
      name?: string;
      contents?: string;
      locations?: Array<{ name?: string }>;
      refs?: { landing_page?: string };
      company?: { name?: string };
      publication_date?: string;
    }>;
  };
  return (payload.results || [])
    .map((item) =>
      toJob({
        source: "themuse",
        externalId: item.id ? String(item.id) : undefined,
        sourceUrl: item.refs?.landing_page || "",
        title: item.name || "",
        company: item.company?.name || "",
        location: item.locations?.[0]?.name,
        description: item.contents || "",
        tags: SOFTWARE_TAGS,
        postedAt: item.publication_date ? new Date(item.publication_date) : undefined,
      }),
    )
    .filter((job): job is NormalizedJob => Boolean(job))
    .slice(0, limit);
}

async function fetchJSearch(query: string, limit: number) {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return [];
  const url = new URL("https://jsearch.p.rapidapi.com/search");
  url.searchParams.set("query", query);
  url.searchParams.set("page", "1");
  url.searchParams.set("num_pages", "1");
  url.searchParams.set("country", "pk");
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-RapidAPI-Key": key,
      "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`JSearch failed: ${response.status}`);
  const payload = (await response.json()) as {
    data?: Array<{
      job_id?: string;
      job_title?: string;
      employer_name?: string;
      job_city?: string;
      job_country?: string;
      job_description?: string;
      job_apply_link?: string;
      job_posted_at_datetime_utc?: string;
    }>;
  };
  return (payload.data || [])
    .map((item) =>
      toJob({
        source: "jsearch",
        externalId: item.job_id,
        sourceUrl: item.job_apply_link || "",
        title: item.job_title || "",
        company: item.employer_name || "",
        location: [item.job_city, item.job_country].filter(Boolean).join(", "),
        description: item.job_description || "",
        tags: SOFTWARE_TAGS,
        postedAt: item.job_posted_at_datetime_utc ? new Date(item.job_posted_at_datetime_utc) : undefined,
      }),
    )
    .filter((job): job is NormalizedJob => Boolean(job))
    .slice(0, limit);
}

export async function fetchAggregatorJobs(limit = 40) {
  const queries = [
    "full stack developer in Lahore, Pakistan",
    "react next.js developer in Lahore, Pakistan",
    "laravel developer in Lahore, Pakistan",
  ];
  const results = await Promise.allSettled([
    fetchJobicy(limit),
    fetchJobicy(limit, "&geo=Pakistan"),
    fetchHimalayas(limit),
    fetchMuse(limit),
    ...queries.map((query) => fetchJSearch(query, 15)),
  ]);
  return results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])).slice(0, limit * 2);
}
