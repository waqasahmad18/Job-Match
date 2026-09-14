import { readFile } from "fs/promises";
import type { UserSettings } from "@/types";

const SOFTWARE_JOB =
  /full\s*stack|mern|react|next\.?js|node\.?js|laravel|software (engineer|developer)|php developer|frontend|backend|web developer/i;
const FETCH_HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/json",
  "User-Agent": "job-match-automation/1.0",
};

export type CareersApplyResult = {
  ok: boolean;
  via?: "greenhouse" | "lever";
  jobUrl?: string;
  error?: string;
};

async function readText(url: string, timeoutMs = 4000) {
  try {
    const response = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
      redirect: "follow",
    });
    if (!response.ok) return "";
    return await response.text();
  } catch {
    return "";
  }
}

function greenhouseToken(html: string, sourceUrl: string) {
  const fromUrl =
    sourceUrl.match(/boards\.greenhouse\.io\/([^/?#]+)/i) ||
    sourceUrl.match(/job-boards\.greenhouse\.io\/([^/?#]+)/i);
  if (fromUrl?.[1] && fromUrl[1] !== "embed") return fromUrl[1];
  const fromHtml =
    html.match(/boards\.greenhouse\.io\/embed\/job_board\?for=([a-z0-9_-]+)/i) ||
    html.match(/job-boards\.greenhouse\.io\/([a-z0-9_-]+)/i) ||
    html.match(/boards\.greenhouse\.io\/([a-z0-9_-]+)/i);
  const token = fromHtml?.[1];
  if (!token || token === "embed") return "";
  return token;
}

function leverAccount(html: string, sourceUrl: string) {
  const fromUrl = sourceUrl.match(/jobs\.lever\.co\/([^/?#]+)/i);
  if (fromUrl?.[1]) return fromUrl[1];
  const fromHtml = html.match(/jobs\.lever\.co\/([a-z0-9_-]+)/i);
  return fromHtml?.[1] || "";
}

function pickSoftwareJob<T extends { title?: string; location?: { name?: string }; categories?: { location?: string } }>(
  jobs: T[],
) {
  const software = jobs.filter((job) => SOFTWARE_JOB.test(job.title || ""));
  const ranked = (software.length ? software : jobs).sort((left, right) => {
    const text = (item: T) =>
      `${item.title || ""} ${item.location?.name || ""} ${item.categories?.location || ""}`.toLowerCase();
    const score = (item: T) => {
      const value = text(item);
      if (/\blahore\b/.test(value)) return 0;
      if (/\b(remote|anywhere|worldwide)\b/.test(value)) return 1;
      if (/\bpakistan\b/.test(value)) return 2;
      return 3;
    };
    return score(left) - score(right);
  });
  return ranked[0];
}

async function applyGreenhouse(token: string, input: {
  settings: UserSettings;
  cvPath: string;
  cvFileName: string;
  coverLetter: string;
}): Promise<CareersApplyResult> {
  const payload = await fetch(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs`, {
    headers: { Accept: "application/json", "User-Agent": "job-match-automation/1.0" },
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  }).then((res) => (res.ok ? res.json() : null)).catch(() => null) as {
    jobs?: Array<{ id: number; title?: string; absolute_url?: string; location?: { name?: string } }>;
  } | null;
  const job = pickSoftwareJob(payload?.jobs || []);
  if (!job?.id) return { ok: false, error: "No Greenhouse software role found." };

  const name = (input.settings.applicantName || "Waqas Rafique").trim();
  const [firstName, ...rest] = name.split(/\s+/);
  const resume = await readFile(input.cvPath);
  const form = new FormData();
  form.set("first_name", firstName || "Waqas");
  form.set("last_name", rest.join(" ") || "Rafique");
  form.set("email", input.settings.applicantEmail || "vickyksr2218@gmail.com");
  form.set("phone", process.env.APPLICANT_PHONE || "03224188759");
  form.append("resume", new Blob([new Uint8Array(resume)], { type: "application/pdf" }), input.cvFileName);
  form.set("cover_letter_text", input.coverLetter);

  const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs/${job.id}`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    return { ok: false, via: "greenhouse", jobUrl: job.absolute_url, error: `Greenhouse ${response.status}` };
  }
  return { ok: true, via: "greenhouse", jobUrl: job.absolute_url };
}

async function applyLever(account: string, input: {
  settings: UserSettings;
  cvPath: string;
  cvFileName: string;
  coverLetter: string;
}): Promise<CareersApplyResult> {
  const payload = await fetch(`https://api.lever.co/v0/postings/${account}?mode=json`, {
    headers: { Accept: "application/json", "User-Agent": "job-match-automation/1.0" },
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  }).then((res) => (res.ok ? res.json() : null)).catch(() => null) as
    | Array<{ id: string; text?: string; hostedUrl?: string; categories?: { location?: string } }>
    | null;
  const jobs = (payload || []).map((item) => ({
    id: item.id,
    title: item.text,
    absolute_url: item.hostedUrl,
    categories: item.categories,
  }));
  const job = pickSoftwareJob(jobs);
  if (!job?.id) return { ok: false, error: "No Lever software role found." };

  const resume = await readFile(input.cvPath);
  const form = new FormData();
  form.set("name", input.settings.applicantName || "Waqas Rafique");
  form.set("email", input.settings.applicantEmail || "vickyksr2218@gmail.com");
  form.set("phone", process.env.APPLICANT_PHONE || "03224188759");
  form.set("org", "Waqas Rafique");
  form.set("comments", input.coverLetter);
  form.append("resume", new Blob([new Uint8Array(resume)], { type: "application/pdf" }), input.cvFileName);

  const response = await fetch(`https://api.lever.co/v0/postings/${account}/${job.id}`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    return { ok: false, via: "lever", jobUrl: job.absolute_url, error: `Lever ${response.status}` };
  }
  return { ok: true, via: "lever", jobUrl: job.absolute_url };
}

export async function applyOnCareersBoard(input: {
  sourceUrl?: string;
  settings: UserSettings;
  cvPath: string;
  cvFileName: string;
  coverLetter: string;
}): Promise<CareersApplyResult> {
  if (!input.sourceUrl?.startsWith("http")) return { ok: false, error: "No careers URL." };
  const html = await readText(input.sourceUrl);
  const greenhouse = greenhouseToken(html, input.sourceUrl);
  if (greenhouse) return applyGreenhouse(greenhouse, input);
  const lever = leverAccount(html, input.sourceUrl);
  if (lever) return applyLever(lever, input);
  return { ok: false, error: "Careers page is not Greenhouse or Lever." };
}
