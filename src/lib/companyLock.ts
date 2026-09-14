import mongoose from "mongoose";
import { Application } from "@/models";
import { startOfPakistanDay } from "@/lib/pakistanDay";

const inFlight = new Set<string>();

export function normalizeCompany(name: string) {
  return name
    .toLowerCase()
    .replace(/,\s*(lahore|remote|pakistan|worldwide).*$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function companyKey(company: string, email?: string) {
  return `${normalizeCompany(company)}|${(email || "").toLowerCase().trim()}`;
}

export function claimInFlight(company: string, email?: string) {
  const keys = [normalizeCompany(company), companyKey(company, email)].filter(Boolean);
  if (keys.some((key) => inFlight.has(key))) return false;
  keys.forEach((key) => inFlight.add(key));
  return true;
}

export function releaseInFlight(company: string, email?: string) {
  inFlight.delete(normalizeCompany(company));
  inFlight.delete(companyKey(company, email));
}

export async function alreadyApproachedCompany(input: {
  company: string;
  email?: string;
  cooldownDays?: number;
}) {
  const since = input.cooldownDays
    ? new Date(Date.now() - input.cooldownDays * 24 * 60 * 60 * 1000)
    : startOfPakistanDay();
  const wantedCompany = normalizeCompany(input.company);
  const wantedEmail = (input.email || "").toLowerCase().trim();

  const apps = await Application.find({
    status: { $in: ["sent", "ready"] },
    createdAt: { $gte: since },
  }).select("companyName emailTo");

  return apps.some((app) => {
    const sameCompany = normalizeCompany(app.companyName || "") === wantedCompany;
    const sameEmail = Boolean(wantedEmail && (app.emailTo || "").toLowerCase() === wantedEmail);
    return sameCompany || sameEmail;
  });
}

let pipelineLocked = false;

export function acquireLocalPipelineLock() {
  if (pipelineLocked) return false;
  pipelineLocked = true;
  return true;
}

export function releaseLocalPipelineLock() {
  pipelineLocked = false;
}

export async function acquireMongoPipelineLock() {
  const col = mongoose.connection.db?.collection("pipelinelocks");
  if (!col) return true;
  const now = new Date();
  const until = new Date(now.getTime() + 70 * 1000);
  const filter = { _id: "pipeline", until: { $lt: now } };
  const stale = await col.findOneAndUpdate(filter as never, { $set: { until } });
  if (stale) return true;
  try {
    await col.insertOne({ _id: "pipeline", until } as never);
    return true;
  } catch {
    return false;
  }
}

export async function releaseMongoPipelineLock() {
  await mongoose.connection.db?.collection("pipelinelocks").updateOne(
    { _id: "pipeline" } as never,
    { $set: { until: new Date(0) } },
  );
}
