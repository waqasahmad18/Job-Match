import type { UserSettings } from "@/types";

const REMOTE_RE =
  /\b(remote|work from home|wfh|distributed team|work from anywhere|anywhere in the world|fully remote|100%\s*remote|worldwide)\b/i;
const ONSITE_RE = /\b(on[- ]?site|in[- ]?office|office[- ]?based|must be (?:based|located)|relocate)\b/i;
const HYBRID_RE = /\bhybrid\b/i;
const OTHER_PK_CITY_RE =
  /\b(karachi|islamabad|rawalpindi|peshawar|quetta|faisalabad|multan|sialkot|hyderabad|gujranwala|abbottabad|sargodha)\b/i;
const FOREIGN_HUB_RE =
  /\b(london|new york|san francisco|berlin|dubai|riyadh|toronto|sydney|singapore|amsterdam|austin|seattle|chicago|boston)\b/i;

function haystack(job: { title?: string; location?: string; description?: string; tags?: string[] }) {
  return `${job.location || ""} ${job.title || ""} ${job.description || ""} ${(job.tags || []).join(" ")}`;
}

export function isExcludedCompany(company: string, excludedCompanies: string[] = []) {
  const name = company.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return excludedCompanies.some((item) => {
    const needle = item.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return Boolean(needle) && (name.includes(needle) || needle.includes(name));
  });
}

export function evaluateLocationPolicy(
  job: { title: string; company: string; location?: string; description: string; tags?: string[]; source?: string },
  settings: Pick<UserSettings, "excludedCompanies" | "onsiteCities">,
) {
  if (isExcludedCompany(job.company, settings.excludedCompanies)) {
    return {
      allowed: false,
      reason: `Skipped current employer: ${job.company}.`,
    };
  }

  const text = haystack(job);
  const onsiteCities = (settings.onsiteCities?.length ? settings.onsiteCities : ["Lahore"]).map((item) =>
    item.toLowerCase(),
  );
  const inAllowedOnsiteCity = onsiteCities.some((city) => text.toLowerCase().includes(city));
  const remote = REMOTE_RE.test(text) || /remote|worldwide|anywhere/i.test(job.location || "");
  const onsite = ONSITE_RE.test(text);
  const hybrid = HYBRID_RE.test(text);
  const otherCity = OTHER_PK_CITY_RE.test(text) || FOREIGN_HUB_RE.test(text);

  if (inAllowedOnsiteCity) {
    return { allowed: true, reason: "Onsite/hybrid role in Lahore." };
  }

  if (remote) {
    return { allowed: true, reason: "Remote role (worldwide or Pakistan)." };
  }

  if (onsite || hybrid || otherCity) {
    return { allowed: false, reason: "Onsite/hybrid outside Lahore is not allowed." };
  }

  if (job.source === "remoteok" || /remote/i.test(job.location || "")) {
    return { allowed: true, reason: "Listed as a remote posting." };
  }

  return { allowed: false, reason: "Location is not remote and not Lahore onsite." };
}
