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
