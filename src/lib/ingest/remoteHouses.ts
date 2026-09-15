import { extractApplyEmail } from "@/lib/extractEmail";
import { toJob, type NormalizedJob } from "@/lib/ingest/publicBoards";

export type RemoteHouse = {
  company: string;
  url: string;
  domain: string;
  ats?: { type: "greenhouse" | "lever" | "ashby"; board: string };
};

export const REMOTE_HOUSES: RemoteHouse[] = [
  { company: "Automattic", url: "https://automattic.com/work-with-us/", domain: "automattic.com" },
  { company: "GitLab", url: "https://about.gitlab.com/jobs/", domain: "gitlab.com" },
  { company: "Zapier", url: "https://zapier.com/jobs", domain: "zapier.com" },
  { company: "Buffer", url: "https://buffer.com/journey", domain: "buffer.com" },
  { company: "Doist", url: "https://doist.com/careers", domain: "doist.com" },
  { company: "Elastic", url: "https://www.elastic.co/careers", domain: "elastic.co" },
  {
    company: "Canonical",
    url: "https://canonical.com/careers",
    domain: "canonical.com",
    ats: { type: "greenhouse", board: "canonical" },
  },
  { company: "Plausible Analytics", url: "https://plausible.io/about", domain: "plausible.io" },
  { company: "Grafana Labs", url: "https://grafana.com/careers/", domain: "grafana.com" },
  { company: "Cal.com", url: "https://cal.com/jobs", domain: "cal.com" },
  { company: "Ghost", url: "https://careers.ghost.org/", domain: "ghost.org" },
  { company: "Proton", url: "https://proton.me/jobs", domain: "proton.me" },
  { company: "Mattermost", url: "https://mattermost.com/careers/", domain: "mattermost.com" },
  { company: "Toggl", url: "https://toggl.com/jobs/", domain: "toggl.com" },
  {
    company: "Help Scout",
    url: "https://www.helpscout.com/company/careers/",
    domain: "helpscout.com",
    ats: { type: "ashby", board: "helpscout" },
  },
  { company: "Remote", url: "https://remote.com/careers", domain: "remote.com" },
  { company: "Deel", url: "https://www.deel.com/careers", domain: "deel.com" },
  { company: "Oyster", url: "https://www.oysterhr.com/careers", domain: "oysterhr.com" },
  { company: "Auth0", url: "https://www.okta.com/company/careers/", domain: "auth0.com" },
  { company: "Twilio", url: "https://www.twilio.com/en-us/company/jobs", domain: "twilio.com" },
  {
    company: "Cloudflare",
    url: "https://www.cloudflare.com/careers/jobs/",
    domain: "cloudflare.com",
    ats: { type: "greenhouse", board: "cloudflare" },
  },
  {
    company: "HashiCorp",
    url: "https://www.hashicorp.com/careers/open-positions",
    domain: "hashicorp.com",
    ats: { type: "greenhouse", board: "hashicorp" },
  },
  {
    company: "Stripe",
    url: "https://stripe.com/jobs",
    domain: "stripe.com",
    ats: { type: "greenhouse", board: "stripe" },
  },
  {
    company: "Datadog",
    url: "https://careers.datadoghq.com/",
    domain: "datadoghq.com",
    ats: { type: "greenhouse", board: "datadog" },
  },
  {
    company: "MongoDB",
    url: "https://www.mongodb.com/careers",
    domain: "mongodb.com",
    ats: { type: "greenhouse", board: "mongodb" },
  },
  {
    company: "DuckDuckGo",
    url: "https://duckduckgo.com/hiring",
    domain: "duckduckgo.com",
  },
  {
    company: "Postman",
    url: "https://www.postman.com/company/careers/",
    domain: "postman.com",
    ats: { type: "greenhouse", board: "postman" },
  },
];

function houseJob(house: RemoteHouse, email: string): NormalizedJob | null {
  const atsHint = house.ats
    ? `\nATS: ${house.ats.type}:${house.ats.board}`
    : "";
  return toJob({
    source: "remote-houses",
    sourceUrl: house.url,
    title: "Full Stack Developer",
    company: house.company,
    location: "Remote worldwide",
    description: `${house.company} is hiring remote full-stack developers. Stack: React, Next.js, JavaScript, TypeScript, Node.js, Python.\nApply email: ${email}${atsHint}`,
    tags: ["fullstack", "remote"],
    postedAt: new Date(),
  });
}

export function seedRemoteSoftwareHouses() {
  return REMOTE_HOUSES.map((house) => houseJob(house, "")).filter((job): job is NormalizedJob => Boolean(job));
}

export function remoteHouseAts(company: string) {
  const wanted = company.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return (
    REMOTE_HOUSES.find((house) => house.company.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === wanted)?.ats ||
    null
  );
}

async function readHouse(house: RemoteHouse): Promise<NormalizedJob[]> {
  try {
    const response = await fetch(house.url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "job-match-automation/1.0",
      },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    const html = response.ok ? await response.text() : "";
    const text = html.replace(/<[^>]+>/g, " ");
    const email = extractApplyEmail(`${text} ${house.url}`) || "";
    const job = houseJob(house, email);
    return job ? [job] : [];
  } catch {
    const job = houseJob(house, "");
    return job ? [job] : [];
  }
}

export async function fetchRemoteSoftwareHouses() {
  const batches = await Promise.allSettled(REMOTE_HOUSES.map((house) => readHouse(house)));
  return batches.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}
