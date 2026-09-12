import { extractApplyEmail } from "@/lib/extractEmail";
import { toJob, type NormalizedJob } from "@/lib/ingest/publicBoards";

const HOUSES = [
  { company: "Arbisoft", url: "https://arbisoft.com/careers", location: "Lahore, Pakistan" },
  { company: "VentureDive", url: "https://venturedive.applytojob.com/apply", location: "Lahore, Pakistan" },
  { company: "10Pearls", url: "https://10pearls.applytojob.com/apply", location: "Lahore, Pakistan" },
  { company: "Confiz", url: "https://www.confiz.com/careers/", location: "Lahore, Pakistan" },
  { company: "Devsinc", url: "https://devsinc.com/careers", location: "Lahore, Pakistan" },
  { company: "Folio3", url: "https://www.folio3.com/careers/", location: "Lahore, Pakistan" },
  { company: "Techlogix", url: "https://www.techlogix.com/careers/", location: "Lahore, Pakistan" },
  { company: "Tintash", url: "https://www.tintash.com/careers", location: "Lahore, Pakistan" },
  { company: "Cubix", url: "https://www.cubix.co/careers", location: "Lahore, Pakistan" },
  { company: "Tkxel", url: "https://www.tkxel.com/careers", location: "Lahore, Pakistan" },
  { company: "TekRevol", url: "https://www.tekrevol.com/careers", location: "Lahore, Pakistan" },
  { company: "Systems Limited", url: "https://www.systemsltd.com/careers", location: "Lahore, Pakistan" },
  { company: "NetSol Technologies", url: "https://www.netsoltech.com/careers", location: "Lahore, Pakistan" },
  { company: "KoderLabs", url: "https://koderlabs.com/careers", location: "Lahore, Pakistan" },
  { company: "47 Billion", url: "https://47billion.com/careers", location: "Lahore, Pakistan" },
  { company: "InvoZone", url: "https://invozone.com/careers", location: "Lahore, Pakistan" },
  { company: "NorthBay Solutions", url: "https://www.northbaysolutions.com/careers", location: "Lahore, Pakistan" },
  { company: "Nextbridge", url: "https://nextbridge.pk/careers/", location: "Lahore, Pakistan" },
];

const ROLE_RE = /full\s*stack|mern|react|next\.js|node\.js|laravel|software engineer|software developer|php developer/i;
const TITLE_RE =
  /([A-Z][A-Za-z0-9+./#\s-]{6,70}(?:Developer|Engineer|Architect|Programmer))/g;

function cleanHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function readHouse(house: (typeof HOUSES)[number]): Promise<NormalizedJob[]> {
  try {
    const response = await fetch(house.url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "job-match-automation/1.0",
      },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!response.ok) return [];
    const html = await response.text();
    const text = cleanHtml(html);
    const email = extractApplyEmail(`${text} ${house.url}`);
    if (!email || !ROLE_RE.test(text)) return [];

    const titles = [...new Set([...text.matchAll(TITLE_RE)].map((match) => match[1].trim()))]
      .filter((title) => ROLE_RE.test(title))
      .slice(0, 4);

    const roles = titles.length ? titles : ["Full Stack Developer"];
    return roles
      .map((title) =>
        toJob({
          source: "pakistan-houses",
          sourceUrl: house.url,
          title,
          company: house.company,
          location: house.location,
          description: `${text.slice(0, 2500)}\n\nApply email: ${email}`,
          tags: ["fullstack", "lahore", "pakistan"],
        }),
      )
      .filter((job): job is NormalizedJob => Boolean(job));
  } catch {
    return [];
  }
}

export async function fetchPakistanSoftwareHouses() {
  const batches = await Promise.allSettled(HOUSES.map((house) => readHouse(house)));
  return batches.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}
