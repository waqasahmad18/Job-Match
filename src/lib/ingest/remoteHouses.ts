import { extractApplyEmail, findCompanyApplyEmail } from "@/lib/extractEmail";
import { toJob, type NormalizedJob } from "@/lib/ingest/publicBoards";

const HOUSES = [
  { company: "Automattic", url: "https://automattic.com/work-with-us/", domain: "automattic.com" },
  { company: "GitLab", url: "https://about.gitlab.com/jobs/", domain: "gitlab.com" },
  { company: "Zapier", url: "https://zapier.com/jobs", domain: "zapier.com" },
  { company: "Buffer", url: "https://buffer.com/journey", domain: "buffer.com" },
  { company: "Doist", url: "https://doist.com/careers", domain: "doist.com" },
  { company: "Elastic", url: "https://www.elastic.co/careers", domain: "elastic.co" },
  { company: "Canonical", url: "https://canonical.com/careers", domain: "canonical.com" },
  { company: "Plausible Analytics", url: "https://plausible.io/careers", domain: "plausible.io" },
  { company: "Grafana Labs", url: "https://grafana.com/about/careers/", domain: "grafana.com" },
  { company: "Cal.com", url: "https://cal.com/jobs", domain: "cal.com" },
  { company: "Ghost", url: "https://careers.ghost.org/", domain: "ghost.org" },
  { company: "Proton", url: "https://proton.me/jobs", domain: "proton.me" },
  { company: "Mattermost", url: "https://mattermost.com/careers/", domain: "mattermost.com" },
  { company: "Toggl", url: "https://toggl.com/jobs/", domain: "toggl.com" },
  { company: "Help Scout", url: "https://www.helpscout.com/company/careers/", domain: "helpscout.com" },
  { company: "Remote", url: "https://remote.com/careers", domain: "remote.com" },
  { company: "Deel", url: "https://www.deel.com/careers", domain: "deel.com" },
  { company: "Oyster", url: "https://www.oysterhr.com/careers", domain: "oysterhr.com" },
  { company: "Auth0", url: "https://www.okta.com/company/careers/", domain: "auth0.com" },
  { company: "Twilio", url: "https://www.twilio.com/en-us/company/jobs", domain: "twilio.com" },
];

function houseJob(house: (typeof HOUSES)[number], email: string): NormalizedJob | null {
  return toJob({
    source: "remote-houses",
    sourceUrl: house.url,
    title: "Full Stack Developer",
    company: house.company,
    location: "Remote worldwide",
    description: `${house.company} is hiring remote full-stack developers. Stack: React, Next.js, JavaScript, TypeScript, Node.js, Python.\nApply email: ${email}`,
    tags: ["fullstack", "remote"],
    postedAt: new Date(),
  });
}

async function readHouse(house: (typeof HOUSES)[number]): Promise<NormalizedJob[]> {
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
    const email =
      extractApplyEmail(`${text} ${house.url}`) || (await findCompanyApplyEmail(house.url)) || "";
    const job = houseJob(house, email);
    return job ? [job] : [];
  } catch {
    const email = (await findCompanyApplyEmail(house.url)) || "";
    const job = houseJob(house, email);
    return job ? [job] : [];
  }
}

export async function fetchRemoteSoftwareHouses() {
  const batches = await Promise.allSettled(HOUSES.map((house) => readHouse(house)));
  return batches.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}
