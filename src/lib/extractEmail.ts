const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const IGNORED_HOSTS = [
  "example.com",
  "email.com",
  "domain.com",
  "sentry.io",
  "wixpress.com",
  "cloudflare.com",
  "schema.org",
];
const IGNORED_LOCAL = /^(support|noreply|no-reply|billing|privacy|legal|security|mailer|notifications|unsubscribe|webmaster)/i;
const JOB_BOARD_HOSTS = [
  "jobicy.com",
  "remotive.com",
  "remoteok.com",
  "arbeitnow.com",
  "himalayas.app",
  "themuse.com",
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
];

export async function extractApplyEmailFromListing(
  job: { description?: string; sourceUrl?: string },
  skipEmails: string[] = [],
) {
  const fromText = extractApplyEmail(`${job.description || ""} ${job.sourceUrl || ""}`, skipEmails);
  if (fromText) return fromText;
  if (!job.sourceUrl || job.sourceUrl.startsWith("mailto:")) return fallbackApplyEmail(job.sourceUrl, skipEmails);

  try {
    const response = await fetch(job.sourceUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "job-match-automation/1.0",
      },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (response.ok) {
      const html = await response.text();
      const fromPage = extractApplyEmail(html.replace(/<[^>]+>/g, " "), skipEmails);
      if (fromPage) return fromPage;
    }
  } catch {
    // Fall through to a company-domain hiring address.
  }
  return fallbackApplyEmail(job.sourceUrl, skipEmails);
}

export function extractApplyEmail(text: string, skipEmails: string[] = []) {
  const skip = new Set(skipEmails.map((item) => item.toLowerCase()).filter(Boolean));
  const matches = text.match(EMAIL_RE) || [];
  const unique = [...new Set(matches.map((item) => item.toLowerCase()))];

  return (
    unique.find((email) => {
      const host = email.split("@")[1] || "";
      if (skip.has(email)) return false;
      if (IGNORED_LOCAL.test(email.split("@")[0] || "")) return false;
      if (IGNORED_HOSTS.some((item) => host.endsWith(item))) return false;
      return /^(jobs|careers|hr|apply|talent|recruiting|people|hello|contact|info)/.test(email);
    }) ||
    unique.find((email) => {
      const host = email.split("@")[1] || "";
      const local = email.split("@")[0] || "";
      return !skip.has(email) && !IGNORED_LOCAL.test(local) && !IGNORED_HOSTS.some((item) => host.endsWith(item));
    }) ||
    null
  );
}

export function fallbackApplyEmail(sourceUrl?: string, skipEmails: string[] = []) {
  if (!sourceUrl) return null;
  try {
    const host = new URL(sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
    if (!host || JOB_BOARD_HOSTS.some((item) => host === item || host.endsWith(`.${item}`))) return null;
    const skip = new Set(skipEmails.map((item) => item.toLowerCase()));
    const aliases = ["jobs", "careers", "hr", "apply", "talent", "hello"].map((local) => `${local}@${host}`);
    return aliases.find((email) => !skip.has(email)) || null;
  } catch {
    return null;
  }
}
