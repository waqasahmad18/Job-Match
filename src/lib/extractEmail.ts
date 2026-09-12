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

export async function extractApplyEmailFromListing(
  job: { description?: string; sourceUrl?: string },
  skipEmails: string[] = [],
) {
  const fromText = extractApplyEmail(`${job.description || ""} ${job.sourceUrl || ""}`, skipEmails);
  if (fromText) return fromText;
  if (!job.sourceUrl || job.sourceUrl.startsWith("mailto:")) return fromText;

  try {
    const response = await fetch(job.sourceUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "job-match-automation/1.0",
      },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const html = await response.text();
    return extractApplyEmail(html.replace(/<[^>]+>/g, " "), skipEmails);
  } catch {
    return null;
  }
}

export function extractApplyEmail(text: string, skipEmails: string[] = []) {
  const skip = new Set(skipEmails.map((item) => item.toLowerCase()).filter(Boolean));
  const matches = text.match(EMAIL_RE) || [];
  const unique = [...new Set(matches.map((item) => item.toLowerCase()))];

  return (
    unique.find((email) => {
      const host = email.split("@")[1] || "";
      if (skip.has(email)) return false;
      if (IGNORED_HOSTS.some((item) => host.endsWith(item))) return false;
      return /^(jobs|careers|hr|apply|talent|recruiting|people|hello|contact|info)/.test(email);
    }) ||
    unique.find((email) => {
      const host = email.split("@")[1] || "";
      return !skip.has(email) && !IGNORED_HOSTS.some((item) => host.endsWith(item));
    }) ||
    null
  );
}
