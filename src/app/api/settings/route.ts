import { DEFAULT_SETTINGS } from "@/lib/constants";
import { hasMongoUri } from "@/lib/mongodb";
import { getOrCreateSettings, toUserSettings } from "@/lib/settings";
import { NextResponse } from "next/server";

export async function GET() {
  if (!hasMongoUri()) {
    return NextResponse.json({ settings: DEFAULT_SETTINGS, mongoConnected: false });
  }
  const { settings } = await getOrCreateSettings();
  return NextResponse.json({
    settings: { ...settings, smtpPassword: "" },
    mongoConnected: true,
  });
}

export async function PUT(request: Request) {
  if (!hasMongoUri()) {
    return NextResponse.json({ error: "Set MONGODB_URI in .env.local first." }, { status: 400 });
  }
  const body = await request.json();
  const { doc } = await getOrCreateSettings();
  const fields = [
    "locations",
    "roles",
    "targetTechnologies",
    "excludedTechnologies",
    "excludedCompanies",
    "onsiteCities",
    "skills",
    "matchThreshold",
    "dailySendLimit",
    "minSalaryPkr",
    "cooldownDays",
    "autoSend",
    "applicantName",
    "applicantEmail",
    "smtpUser",
    "smtpFrom",
  ] as const;

  if (typeof body.smtpPassword === "string" && body.smtpPassword.trim()) {
    doc.set("smtpPassword", body.smtpPassword.replace(/\s+/g, ""));
  }

  for (const field of fields) {
    if (body[field] !== undefined) {
      doc.set(field, body[field]);
    }
  }
  await doc.save();
  const settings = toUserSettings(doc.toObject());
  return NextResponse.json({ settings: { ...settings, smtpPassword: "" } });
}
