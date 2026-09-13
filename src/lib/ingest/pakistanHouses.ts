import { extractApplyEmail, findCompanyApplyEmail } from "@/lib/extractEmail";
import { toJob, type NormalizedJob } from "@/lib/ingest/publicBoards";

const HOUSES = [
  { company: "Arbisoft", url: "https://arbisoft.com/careers", domain: "arbisoft.com" },
  { company: "VentureDive", url: "https://venturedive.com/careers", domain: "venturedive.com" },
  { company: "10Pearls", url: "https://10pearls.com/careers", domain: "10pearls.com" },
  { company: "Confiz", url: "https://www.confiz.com/careers/", domain: "confiz.com" },
  { company: "Devsinc", url: "https://devsinc.com/careers", domain: "devsinc.com" },
  { company: "Folio3", url: "https://www.folio3.com/careers/", domain: "folio3.com" },
  { company: "Techlogix", url: "https://www.techlogix.com/careers/", domain: "techlogix.com" },
  { company: "Tintash", url: "https://www.tintash.com/careers", domain: "tintash.com" },
  { company: "Cubix", url: "https://www.cubix.co/careers", domain: "cubix.co" },
  { company: "Tkxel", url: "https://www.tkxel.com/careers", domain: "tkxel.com" },
  { company: "TekRevol", url: "https://www.tekrevol.com/careers", domain: "tekrevol.com" },
  { company: "Systems Limited", url: "https://www.systemsltd.com/careers", domain: "systemsltd.com" },
  { company: "NetSol Technologies", url: "https://www.netsoltech.com/careers", domain: "netsoltech.com" },
  { company: "KoderLabs", url: "https://koderlabs.com/careers", domain: "koderlabs.com" },
  { company: "47 Billion", url: "https://47billion.com/careers", domain: "47billion.com" },
  { company: "InvoZone", url: "https://invozone.com/careers", domain: "invozone.com" },
  { company: "NorthBay Solutions", url: "https://www.northbaysolutions.com/careers", domain: "northbaysolutions.com" },
  { company: "Nextbridge", url: "https://nextbridge.com/contact-us/", domain: "nextbridge.com" },
  { company: "PureLogics", url: "https://purelogics.com/careers/", domain: "purelogics.com" },
  { company: "Goodcore Software", url: "https://www.goodcore.co.uk/careers/", domain: "goodcore.co.uk" },
  { company: "Techverx", url: "https://techverx.com/careers/", domain: "techverx.com" },
  { company: "Programmers Force", url: "https://www.programmersforce.com/careers", domain: "programmersforce.com" },
  { company: "Avanza Solutions", url: "https://avanzasolutions.com/careers/", domain: "avanzasolutions.com" },
  { company: "CureMD", url: "https://curemd.com/careers/", domain: "curemd.com" },
  { company: "Arrivy", url: "https://arrivy.com/careers", domain: "arrivy.com" },
  { company: "Speridian Technologies", url: "https://www.speridian.com/careers/", domain: "speridian.com" },
  { company: "Contour Software", url: "https://contour-software.com/careers/", domain: "contour-software.com" },
  { company: "Tezo", url: "https://tezo.com/careers/", domain: "tezo.com" },
  { company: "Vizteck Solutions", url: "https://vizteck.com/careers/", domain: "vizteck.com" },
  { company: "i2c", url: "https://www.i2cinc.com/careers/", domain: "i2cinc.com" },
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

function houseJob(
  house: (typeof HOUSES)[number],
  title: string,
  email: string,
  details: string,
): NormalizedJob | null {
  return toJob({
    source: "pakistan-houses",
    sourceUrl: house.url,
    title,
    company: house.company,
    location: "Lahore, Pakistan",
    description: `${details}\n\nLahore full-stack role. Stack: React, Next.js, JavaScript, TypeScript, Node.js, Laravel, Python, MongoDB, MySQL.\nApply email: ${email}`,
    tags: ["fullstack", "lahore", "pakistan"],
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
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    const html = response.ok ? await response.text() : "";
    const text = html ? cleanHtml(html) : "";
    const email =
      extractApplyEmail(`${text} ${house.url}`) || (await findCompanyApplyEmail(house.url)) || "";
    const title =
      [...new Set([...text.matchAll(TITLE_RE)].map((match) => match[1].trim()))].find((item) =>
        ROLE_RE.test(item),
      ) || "Full Stack Developer";
    const job = houseJob(
      house,
      title,
      email,
      text.slice(0, 1800) || `${house.company} is hiring full-stack developers in Lahore.`,
    );
    return job ? [job] : [];
  } catch {
    const email = (await findCompanyApplyEmail(house.url)) || "";
    const job = houseJob(
      house,
      "Full Stack Developer",
      email,
      `${house.company} is hiring full-stack developers in Lahore.`,
    );
    return job ? [job] : [];
  }
}

export async function fetchPakistanSoftwareHouses() {
  const batches = await Promise.allSettled(HOUSES.map((house) => readHouse(house)));
  return batches.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}
