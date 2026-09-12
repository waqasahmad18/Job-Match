import type { UserSettings } from "@/types";

export type LocationClass = "lahore-onsite" | "lahore-remote" | "remote-worldwide" | "blocked";

const REMOTE_RE =
  /\b(remote|work from home|wfh|distributed team|work from anywhere|anywhere in the world|fully remote|100%\s*remote|worldwide)\b/i;
const ONSITE_RE = /\b(on[- ]?site|in[- ]?office|office[- ]?based|must be (?:based|located)|relocate)\b/i;
const HYBRID_RE = /\bhybrid\b/i;
const OTHER_PK_CITY_RE =
  /\b(karachi|islamabad|rawalpindi|peshawar|quetta|faisalabad|multan|sialkot|hyderabad|gujranwala|abbottabad|sargodha)\b/i;
const FOREIGN_HUB_RE =
  /\b(london|new york|san francisco|berlin|dubai|riyadh|toronto|sydney|singapore|amsterdam|austin|seattle|chicago|boston)\b/i;
const WORLDWIDE_RE = /\b(worldwide|anywhere in the world|work from anywhere|fully remote|100%\s*remote)\b/i;

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

export function classifyLocation(
  job: { title: string; company: string; location?: string; description: string; tags?: string[]; source?: string },
  settings: Pick<UserSettings, "excludedCompanies" | "onsiteCities">,
): { class: LocationClass; allowed: boolean; reason: string } {
  if (isExcludedCompany(job.company, settings.excludedCompanies)) {
    return {
      class: "blocked",
      allowed: false,
      reason: `Skipped current employer: ${job.company}.`,
    };
  }

  const text = haystack(job);
  const locationField = job.location || "";
  const onsiteCities = (settings.onsiteCities?.length ? settings.onsiteCities : ["Lahore"]).map((item) =>
    item.toLowerCase(),
  );
  const inAllowedOnsiteCity = onsiteCities.some((city) => text.toLowerCase().includes(city));
  const locationSaysRemote = /remote|worldwide|anywhere|wfh/i.test(locationField);
  const locationIsOtherCity = OTHER_PK_CITY_RE.test(locationField) || FOREIGN_HUB_RE.test(locationField);
  const remote = REMOTE_RE.test(text) || locationSaysRemote;
  const onsite = ONSITE_RE.test(text);
  const hybrid = HYBRID_RE.test(text);
  const otherCity = OTHER_PK_CITY_RE.test(text) || FOREIGN_HUB_RE.test(text);
  const worldwide = WORLDWIDE_RE.test(text) || /worldwide|anywhere/i.test(locationField);
  const pakistanWideRemote = remote && /pakistan/i.test(locationField) && !OTHER_PK_CITY_RE.test(locationField);

  if (locationIsOtherCity && !locationSaysRemote && !inAllowedOnsiteCity) {
    return { class: "blocked", allowed: false, reason: "Onsite/hybrid outside Lahore is not allowed." };
  }

  if (inAllowedOnsiteCity && remote) {
    return { class: "lahore-remote", allowed: true, reason: "Remote role based in Lahore." };
  }

  if (inAllowedOnsiteCity) {
    return { class: "lahore-onsite", allowed: true, reason: "Onsite/hybrid role in Lahore." };
  }

  if (remote && otherCity && !worldwide && !pakistanWideRemote) {
    return { class: "blocked", allowed: false, reason: "Remote locked to another city is not allowed." };
  }

  if (remote || worldwide || pakistanWideRemote) {
    return { class: "remote-worldwide", allowed: true, reason: "Remote role (worldwide or Pakistan-wide)." };
  }

  if (onsite || hybrid || otherCity) {
    return { class: "blocked", allowed: false, reason: "Onsite/hybrid outside Lahore is not allowed." };
  }

  if (job.source === "pakistan-houses" || /lahore/i.test(locationField)) {
    return { class: "lahore-onsite", allowed: true, reason: "Lahore software-house listing." };
  }

  if (job.source === "remoteok" || /remote/i.test(locationField)) {
    return { class: "remote-worldwide", allowed: true, reason: "Listed as a remote posting." };
  }

  return { class: "blocked", allowed: false, reason: "Location is not remote and not Lahore onsite." };
}

export function evaluateLocationPolicy(
  job: { title: string; company: string; location?: string; description: string; tags?: string[]; source?: string },
  settings: Pick<UserSettings, "excludedCompanies" | "onsiteCities">,
) {
  const result = classifyLocation(job, settings);
  return { allowed: result.allowed, reason: result.reason };
}

export function locationPriority(locationClass: LocationClass) {
  if (locationClass === "lahore-onsite") return 0;
  if (locationClass === "lahore-remote") return 1;
  if (locationClass === "remote-worldwide") return 2;
  return 3;
}
