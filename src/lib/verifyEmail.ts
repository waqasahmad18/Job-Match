import { resolveMx } from "dns/promises";
import { BouncedEmail } from "@/models";

const HIRING_LOCALS = ["jobs", "careers", "hr", "apply", "talent", "recruiting", "people", "hello", "contact"];

export function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

export async function loadBouncedEmails() {
  const rows = await BouncedEmail.find().select("email");
  return new Set(rows.map((row) => normalizeEmail(row.email)));
}

export async function rememberBouncedEmail(email: string, reason?: string) {
  const value = normalizeEmail(email);
  if (!value.includes("@")) return;
  await BouncedEmail.updateOne(
    { email: value },
    { $setOnInsert: { email: value, reason: reason || "Gmail bounce: invalid address", firstSeenAt: new Date() } },
    { upsert: true },
  );
}

export async function domainHasMx(email: string) {
  const host = email.split("@")[1] || "";
  if (!host) return false;
  try {
    const records = await resolveMx(host);
    return records.length > 0;
  } catch {
    return false;
  }
}

export function hiringAliases(emailOrHost: string) {
  const host = emailOrHost.includes("@") ? emailOrHost.split("@")[1] : emailOrHost;
  if (!host) return [];
  return HIRING_LOCALS.map((local) => `${local}@${host.toLowerCase()}`);
}

export function hostAlreadyBounced(emailOrHost: string, bounced: Set<string>) {
  return bounced.has(normalizeEmail(emailOrHost));
}

export async function pickDeliverableEmail(candidates: Array<string | null | undefined>, bounced: Set<string>) {
  const unique = [...new Set(candidates.map((item) => (item ? normalizeEmail(item) : "")).filter(Boolean))];
  for (const email of unique) {
    if (bounced.has(email)) continue;
    if (hostAlreadyBounced(email, bounced)) continue;
    if (!(await domainHasMx(email))) continue;
    return email;
  }
  return null;
}
