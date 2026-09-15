import { extractApplyEmail } from "@/lib/extractEmail";
import { toJob, type NormalizedJob } from "@/lib/ingest/publicBoards";

export type PakistanHouse = {
  company: string;
  url: string;
  domain: string;
  /** Verified hiring / careers email from Contact or Careers page — never a guess. */
  email?: string;
  ats?: { type: "greenhouse" | "lever" | "ashby"; board: string };
};

/** Lahore-focused software houses. CV goes by careers email, Contact page email, or ATS form. */
export const PAKISTAN_HOUSES: PakistanHouse[] = [
  { company: "Arbisoft", url: "https://arbisoft.com/careers", domain: "arbisoft.com" },
  { company: "VentureDive", url: "https://venturedive.com/careers", domain: "venturedive.com" },
  { company: "10Pearls", url: "https://10pearls.com/careers", domain: "10pearls.com" },
  { company: "Confiz", url: "https://www.confiz.com/careers/", domain: "confiz.com" },
  { company: "Devsinc", url: "https://devsinc.com/careers", domain: "devsinc.com", email: "inquiry@devsinc.com" },
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
  {
    company: "Nextbridge",
    url: "https://nextbridge.com/contact-us/",
    domain: "nextbridge.com",
    email: "careers@nextbridge.com",
  },
  { company: "PureLogics", url: "https://purelogics.com/careers/", domain: "purelogics.com" },
  { company: "Goodcore Software", url: "https://www.goodcore.co.uk/careers/", domain: "goodcore.co.uk" },
  { company: "Techverx", url: "https://techverx.com/careers/", domain: "techverx.com", email: "info@techverx.com" },
  { company: "Programmers Force", url: "https://www.programmersforce.com/careers", domain: "programmersforce.com" },
  { company: "Avanza Solutions", url: "https://avanzasolutions.com/careers/", domain: "avanzasolutions.com" },
  { company: "CureMD", url: "https://curemd.com/careers/", domain: "curemd.com", email: "sales@curemd.com" },
  { company: "Arrivy", url: "https://arrivy.com/careers", domain: "arrivy.com" },
  { company: "Speridian Technologies", url: "https://www.speridian.com/careers/", domain: "speridian.com" },
  { company: "Contour Software", url: "https://contour-software.com/careers/", domain: "contour-software.com" },
  { company: "Tezo", url: "https://tezo.com/careers/", domain: "tezo.com" },
  { company: "Vizteck Solutions", url: "https://vizteck.com/careers/", domain: "vizteck.com" },
  { company: "i2c", url: "https://www.i2cinc.com/careers/", domain: "i2cinc.com" },
  { company: "Xgrid", url: "https://xgrid.co/careers", domain: "xgrid.co" },
  { company: "Dubizzle Labs", url: "https://www.dubizzlelabs.com/careers", domain: "dubizzlelabs.com" },
  { company: "Bazaar Technologies", url: "https://bazaar.technology/careers", domain: "bazaar.technology" },
  { company: "Cinnova", url: "https://cinnova.com/careers", domain: "cinnova.com", email: "info@cinnova.com" },
  { company: "Rolustech", url: "https://www.rolustech.com/careers", domain: "rolustech.com" },
  { company: "Ovex Technologies", url: "https://ovextech.com/careers", domain: "ovextech.com", email: "info@ovextech.com" },
  { company: "Coding Crafts", url: "https://codingcrafts.io/careers", domain: "codingcrafts.io" },
  { company: "NayaPay", url: "https://www.nayapay.com/careers", domain: "nayapay.com" },
  { company: "EOcean", url: "https://eocean.com/careers", domain: "eocean.com" },
  { company: "TPS", url: "https://www.tpsworldwide.com/careers", domain: "tpsworldwide.com" },
  { company: "Afiniti", url: "https://www.afiniti.com/careers", domain: "afiniti.com" },
  { company: "ibex", url: "https://www.ibex.co/careers", domain: "ibex.co" },
  { company: "Emumba", url: "https://emumba.com/careers", domain: "emumba.com" },
  { company: "Sofizar", url: "https://www.sofizar.com/careers", domain: "sofizar.com" },
  { company: "Eziline Software", url: "https://eziline.com/careers", domain: "eziline.com" },
  { company: "PureVPN", url: "https://www.purevpn.com/careers", domain: "purevpn.com" },
  { company: "Traverse", url: "https://www.traverse.net/careers", domain: "traverse.net" },
  { company: "SwipBox", url: "https://swipbox.com/careers", domain: "swipbox.com" },
  { company: "Folio3 AI", url: "https://www.folio3.ai/careers", domain: "folio3.ai" },
  { company: "MobileCoderz", url: "https://www.mobilecoderz.com/careers", domain: "mobilecoderz.com" },
  { company: "Appicial", url: "https://www.appicial.com/careers", domain: "appicial.com" },
  { company: "HyperSoft", url: "https://www.hypersoft.com/careers", domain: "hypersoft.com" },
  { company: "Technosoft Solutions", url: "https://www.technosoftsolutions.com/careers", domain: "technosoftsolutions.com" },
  { company: "Broadpeak Technologies", url: "https://broadpeaktechnologies.com/careers", domain: "broadpeaktechnologies.com" },
  { company: "Codility Solutions", url: "https://www.codilitysolutions.com/careers", domain: "codilitysolutions.com" },
  { company: "DevBatch", url: "https://devbatch.com/careers", domain: "devbatch.com" },
  { company: "Elixir Technologies", url: "https://www.elixir.com/careers", domain: "elixir.com" },
  { company: "Falak Solutions", url: "https://falak.pk/careers", domain: "falak.pk" },
  { company: "Gaditek", url: "https://gaditek.com/careers", domain: "gaditek.com" },
  { company: "GoDaddy Pakistan", url: "https://careers.godaddy.com/", domain: "godaddy.com" },
  { company: "Huku Soft", url: "https://www.huku.pk/careers", domain: "huku.pk" },
  { company: "Innovatrix Tech", url: "https://innovatrixtech.com/careers", domain: "innovatrixtech.com" },
  { company: "Jolta Technologies", url: "https://jolta.com/careers", domain: "jolta.com" },
  { company: "KeepTruckin", url: "https://motus.com/careers", domain: "motus.com" },
  { company: "Khaleef Technologies", url: "https://khaleef.com/careers", domain: "khaleef.com" },
  { company: "Logiciel Solutions", url: "https://www.logicielsolutions.com/careers", domain: "logicielsolutions.com" },
  { company: "Mindstorm Studios", url: "https://mindstormstudios.com/careers", domain: "mindstormstudios.com" },
  { company: "Netsol PK", url: "https://www.netsoltech.com/careers", domain: "netsoltech.com" },
  { company: "NextGen Technologies", url: "https://www.nextgentechnologies.co/careers", domain: "nextgentechnologies.co" },
  { company: "Nisum Pakistan", url: "https://nisum.com/careers", domain: "nisum.com" },
  { company: "NybSys", url: "https://nybsys.com/careers", domain: "nybsys.com" },
  { company: "Oben Technology", url: "https://obentechnology.com/careers", domain: "obentechnology.com" },
  { company: "PearlSoft", url: "https://pearlsoft.io/careers", domain: "pearlsoft.io" },
  { company: "QBatch", url: "https://qbatch.com/careers", domain: "qbatch.com" },
  { company: "Relymer Labs", url: "https://relymer.com/careers", domain: "relymer.com" },
  { company: "Sastaticket", url: "https://sastaticket.pk/careers", domain: "sastaticket.pk" },
  { company: "Saviour Softwares", url: "https://savioursoftwares.com/careers", domain: "savioursoftwares.com" },
  { company: "Silicon Technologies", url: "https://silicontech.com.pk/careers", domain: "silicontech.com.pk" },
  { company: "Softaims", url: "https://softaims.com/careers", domain: "softaims.com" },
  { company: "SoftCircles", url: "https://softcircles.com/careers", domain: "softcircles.com" },
  { company: "TechVista", url: "https://techvista.com/careers", domain: "techvista.com" },
  { company: "TPS Retail", url: "https://www.tpsretail.com/careers", domain: "tpsretail.com" },
  { company: "Trafix", url: "https://trafix.com/careers", domain: "trafix.com" },
  { company: "Uraan Soft", url: "https://uraansoft.com/careers", domain: "uraansoft.com" },
  { company: "Veevo Tech", url: "https://veevotech.com/careers", domain: "veevotech.com" },
  { company: "Vizz Web Solutions", url: "https://vizzwebsolutions.com/careers", domain: "vizzwebsolutions.com" },
  { company: "Webxource", url: "https://webxource.com/careers", domain: "webxource.com" },
  { company: "Xavor", url: "https://www.xavor.com/careers", domain: "xavor.com" },
  { company: "Zong CMPak", url: "https://www.zong.com.pk/careers", domain: "zong.com.pk" },
  { company: "Jazz", url: "https://jazz.com.pk/careers", domain: "jazz.com.pk" },
  { company: "Careem", url: "https://www.careem.com/careers", domain: "careem.com" },
  { company: "Bykea", url: "https://bykea.com/careers", domain: "bykea.com" },
  { company: "Foodpanda Pakistan", url: "https://careers.foodpanda.com/", domain: "foodpanda.com" },
  { company: "Daraz", url: "https://careers.daraz.com/", domain: "daraz.com" },
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
  house: PakistanHouse,
  title: string,
  email: string,
  details: string,
): NormalizedJob | null {
  const atsHint = house.ats ? `\nATS: ${house.ats.type}:${house.ats.board}` : "";
  return toJob({
    source: "pakistan-houses",
    sourceUrl: house.url,
    title,
    company: house.company,
    location: "Lahore, Pakistan",
    description: `${details}\n\nLahore full-stack role. Stack: React, Next.js, JavaScript, TypeScript, Node.js, Laravel, Python, MongoDB, MySQL.\nApply email: ${email}${atsHint}`,
    tags: ["fullstack", "lahore", "pakistan"],
    postedAt: new Date(),
  });
}

export function seedPakistanSoftwareHouses() {
  return PAKISTAN_HOUSES.map((house) =>
    houseJob(
      house,
      "Full Stack Developer",
      house.email || "",
      `${house.company} is hiring full-stack developers in Lahore.`,
    ),
  ).filter((job): job is NormalizedJob => Boolean(job));
}

export function pakistanHouseAts(company: string) {
  const wanted = company.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return (
    PAKISTAN_HOUSES.find((house) => house.company.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === wanted)
      ?.ats || null
  );
}

export function pakistanHouseEmail(company: string) {
  const wanted = company.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return (
    PAKISTAN_HOUSES.find((house) => house.company.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === wanted)
      ?.email || ""
  );
}

async function readHouse(house: PakistanHouse): Promise<NormalizedJob[]> {
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
    const text = html ? cleanHtml(html) : "";
    const email = extractApplyEmail(`${text} ${house.url}`) || house.email || "";
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
    const job = houseJob(
      house,
      "Full Stack Developer",
      house.email || "",
      `${house.company} is hiring full-stack developers in Lahore.`,
    );
    return job ? [job] : [];
  }
}

/** Scrape a rotating batch so Vercel stays under 60s. */
export async function fetchPakistanSoftwareHouses(limit = 20) {
  const start = Math.floor(Date.now() / (6 * 60 * 60 * 1000)) % Math.max(1, PAKISTAN_HOUSES.length);
  const batch = [...PAKISTAN_HOUSES.slice(start), ...PAKISTAN_HOUSES.slice(0, start)].slice(0, limit);
  const batches = await Promise.allSettled(batch.map((house) => readHouse(house)));
  return batches.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}
