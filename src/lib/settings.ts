import { DEFAULT_SETTINGS } from "@/lib/constants";
import { getMasterCv } from "@/lib/cvStore";
import { connectMongo } from "@/lib/mongodb";
import { CvVersion, UserPreference } from "@/models";
import type { UserSettings } from "@/types";

function mergeUnique(current: string[] | undefined, extras: string[]) {
  const values = [...(current || [])];
  for (const extra of extras) {
    if (!values.some((item) => item.toLowerCase() === extra.toLowerCase())) {
      values.push(extra);
    }
  }
  return values;
}

export function toUserSettings(doc?: Record<string, unknown> | null): UserSettings {
  return {
    locations: (doc?.locations as string[]) || DEFAULT_SETTINGS.locations,
    roles: (doc?.roles as string[]) || DEFAULT_SETTINGS.roles,
    targetTechnologies: (doc?.targetTechnologies as string[]) || DEFAULT_SETTINGS.targetTechnologies,
    excludedTechnologies:
      (doc?.excludedTechnologies as string[]) || DEFAULT_SETTINGS.excludedTechnologies,
    excludedCompanies: mergeUnique(
      doc?.excludedCompanies as string[] | undefined,
      DEFAULT_SETTINGS.excludedCompanies,
    ),
    onsiteCities: (doc?.onsiteCities as string[])?.length
      ? (doc?.onsiteCities as string[])
      : DEFAULT_SETTINGS.onsiteCities,
    skills: (doc?.skills as string[]) || DEFAULT_SETTINGS.skills,
    matchThreshold: Number(doc?.matchThreshold ?? DEFAULT_SETTINGS.matchThreshold),
    dailySendLimit: Number(doc?.dailySendLimit ?? DEFAULT_SETTINGS.dailySendLimit),
    minSalaryPkr: Number(doc?.minSalaryPkr ?? DEFAULT_SETTINGS.minSalaryPkr),
    cooldownDays: Number(doc?.cooldownDays ?? DEFAULT_SETTINGS.cooldownDays),
    autoSend: doc?.autoSend !== false,
    applicantName: String(doc?.applicantName || DEFAULT_SETTINGS.applicantName),
    applicantEmail: String(doc?.applicantEmail || DEFAULT_SETTINGS.applicantEmail),
    smtpUser: String(doc?.smtpUser || process.env.SMTP_USER || DEFAULT_SETTINGS.smtpUser),
    smtpPassword: String(doc?.smtpPassword || process.env.SMTP_PASSWORD || ""),
    smtpFrom: String(doc?.smtpFrom || process.env.EMAIL_FROM || DEFAULT_SETTINGS.smtpFrom),
    smtpReady: Boolean((doc?.smtpPassword || process.env.SMTP_PASSWORD || "").toString().trim()),
  };
}

export async function getOrCreateSettings() {
  await connectMongo();
  let doc = await UserPreference.findOne();
  if (!doc) {
    doc = await UserPreference.create(DEFAULT_SETTINGS);
  } else {
    const companies = mergeUnique(doc.excludedCompanies, DEFAULT_SETTINGS.excludedCompanies);
    const onsiteCities = doc.onsiteCities?.length ? doc.onsiteCities : DEFAULT_SETTINGS.onsiteCities;
    const storedLimit = Number(doc.dailySendLimit || 0);
    const dailySendLimit = storedLimit <= 20 ? 50 : storedLimit;
    const matchThreshold = [60, 80].includes(Number(doc.matchThreshold))
      ? 75
      : Number(doc.matchThreshold || 75);
    if (
      companies.length !== (doc.excludedCompanies || []).length ||
      !(doc.onsiteCities || []).length ||
      dailySendLimit !== doc.dailySendLimit ||
      matchThreshold !== doc.matchThreshold
    ) {
      doc.excludedCompanies = companies;
      doc.onsiteCities = onsiteCities;
      doc.dailySendLimit = dailySendLimit;
      doc.matchThreshold = matchThreshold;
      await doc.save();
    }
  }
  await ensureMasterCvRecord();
  return { doc, settings: toUserSettings(doc.toObject()) };
}

async function ensureMasterCvRecord() {
  const master = getMasterCv();
  if (!master) return;
  const existing = await CvVersion.findOne({ fileName: master.fileName });
  if (existing) {
    existing.name = master.name;
    existing.filePath = master.filePath;
    existing.isDefault = true;
    existing.focus = master.focus;
    await existing.save();
    return;
  }
  await CvVersion.updateMany({}, { isDefault: false });
  await CvVersion.create({
    name: master.name,
    focus: master.focus,
    filePath: master.filePath,
    fileName: master.fileName,
    isDefault: true,
  });
}
