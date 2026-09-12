import { createHash } from "crypto";

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function jobFingerprint(input: {
  sourceUrl?: string;
  externalId?: string;
  company: string;
  title: string;
  description: string;
}) {
  const url = input.sourceUrl?.trim().toLowerCase();
  if (url) {
    return createHash("sha256").update(`url:${url}`).digest("hex");
  }

  if (input.externalId) {
    return createHash("sha256")
      .update(`ext:${input.externalId}:${normalizeText(input.company)}`)
      .digest("hex");
  }

  const payload = [
    normalizeText(input.company),
    normalizeText(input.title),
    normalizeText(input.description).slice(0, 400),
  ].join("|");

  return createHash("sha256").update(payload).digest("hex");
}
