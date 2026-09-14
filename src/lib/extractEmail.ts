const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g;
const IGNORED_HOSTS = [
  "example.com",
  "email.com",
  "domain.com",
  "sentry.io",
  "wixpress.com",
  "cloudflare.com",
  "schema.org",
];
const IGNORED_LOCAL =
  /^(support|noreply|no-reply|billing|privacy|legal|security|mailer|notifications|unsubscribe|webmaster)/i;
const FETCH_HEADERS = {
  Accept: "text/html,application/xhtml+xml",
  "User-Agent": "job-match-automation/1.0",
};
const pageEmailCache = new Map<string, string | null>();

function decodeObfuscated(text: string) {
  return text
    .replace(/&#64;|&64;|%40/gi, "@")
    .replace(/([a-z0-9._%+-]+)\s*(?:\(|\[)?\s*(?:at)\s*(?:\)|\])?\s*([a-z0-9.-]+\.[a-z]{2,})/gi, "$1@$2");
}

function companyOrigins(sourceUrl: string) {
  try {
    const host = new URL(sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
    const hosts = new Set([host]);
    if (host.endsWith(".pk")) hosts.add(host.replace(/\.pk$/, ".com"));
    return [...hosts].flatMap((item) => [`https://${item}`, `https://www.${item}`]);
  } catch {
    return [];
  }
}

async function readPage(url: string) {
  try {
    const response = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(3500),
      cache: "no-store",
      redirect: "follow",
    });
    if (!response.ok) return "";
    return await response.text();
  } catch {
    return "";
  }
}

export function extractApplyEmail(text: string, skipEmails: string[] = []) {
  const decoded = decodeObfuscated(text);
  const skip = new Set(skipEmails.map((item) => item.toLowerCase()).filter(Boolean));
  const mailto = decoded.match(/mailto:([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i);
  if (mailto?.[1] && !skip.has(mailto[1].toLowerCase())) {
    const email = mailto[1].toLowerCase();
    if (!IGNORED_LOCAL.test(email.split("@")[0] || "")) return email;
  }
  const jobLine = decoded.match(
    /(?:job application|for jobs|apply(?: to)?(?: here)?|careers? team)[:\s]+([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i,
  );
  if (jobLine?.[1] && !skip.has(jobLine[1].toLowerCase())) return jobLine[1].toLowerCase();

  const matches = decoded.match(EMAIL_RE) || [];
  const unique = [...new Set(matches.map((item) => item.toLowerCase()))];

  return (
    unique.find((email) => {
      const host = email.split("@")[1] || "";
      if (skip.has(email)) return false;
      if (IGNORED_LOCAL.test(email.split("@")[0] || "")) return false;
      if (IGNORED_HOSTS.some((item) => host.endsWith(item))) return false;
      return /^(jobs|careers|hr|apply|talent|recruiting|people|hello|contact)/.test(email);
    }) ||
    unique.find((email) => {
      const host = email.split("@")[1] || "";
      const local = email.split("@")[0] || "";
      if (skip.has(email) || IGNORED_LOCAL.test(local)) return false;
      if (IGNORED_HOSTS.some((item) => host.endsWith(item))) return false;
      return local !== "sales";
    }) ||
    null
  );
}

export async function findCompanyApplyEmail(sourceUrl?: string, skipEmails: string[] = []) {
  if (!sourceUrl || sourceUrl.startsWith("mailto:")) return fallbackApplyEmail(sourceUrl, skipEmails);
  const cacheKey = `${sourceUrl}|${skipEmails.join(",")}`;
  if (pageEmailCache.has(cacheKey)) return pageEmailCache.get(cacheKey) || null;

  const origins = companyOrigins(sourceUrl);
  const queue = [sourceUrl];
  for (const origin of origins) {
    queue.push(`${origin}/contact-us`, `${origin}/contact`, `${origin}/careers`);
  }

  const urls = [...new Set(queue)].slice(0, 4);
  const pages = await Promise.all(urls.map((url) => readPage(url)));
  for (const html of pages) {
    if (!html) continue;
    const email = extractApplyEmail(`${html} ${html.replace(/<[^>]+>/g, " ")}`, skipEmails);
    if (email) {
      pageEmailCache.set(cacheKey, email);
      return email;
    }
  }

  pageEmailCache.set(cacheKey, null);
  return null;
}

export async function extractApplyEmailFromListing(
  job: { description?: string; sourceUrl?: string },
  skipEmails: string[] = [],
) {
  const fromText = extractApplyEmail(`${job.description || ""} ${job.sourceUrl || ""}`, skipEmails);
  if (fromText) return fromText;
  return findCompanyApplyEmail(job.sourceUrl, skipEmails);
}

export function fallbackApplyEmail(sourceUrl?: string, skipEmails: string[] = []) {
  if (!sourceUrl?.startsWith("mailto:")) return null;
  const email = sourceUrl.slice(7).split("?")[0].toLowerCase().trim();
  if (!email.includes("@")) return null;
  if (skipEmails.some((item) => item.toLowerCase() === email)) return null;
  return email;
}
