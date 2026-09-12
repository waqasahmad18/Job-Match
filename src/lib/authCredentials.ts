import { scryptSync, timingSafeEqual } from "crypto";

function authSecret() {
  return process.env.AUTH_SECRET || "job-match-dev-secret-change-me";
}

function hashCredential(value: string) {
  return scryptSync(value, authSecret(), 64);
}

function matchesHash(plain: string, storedHex?: string) {
  if (!storedHex) return false;
  const computed = hashCredential(plain);
  const stored = Buffer.from(storedHex, "hex");
  if (computed.length !== stored.length) return false;
  return timingSafeEqual(computed, stored);
}

export function authHashesConfigured() {
  return Boolean(process.env.AUTH_USERNAME_HASH && process.env.AUTH_PASSWORD_HASH);
}

export function credentialsMatch(username: string, password: string) {
  return (
    matchesHash(username.trim(), process.env.AUTH_USERNAME_HASH) &&
    matchesHash(password, process.env.AUTH_PASSWORD_HASH)
  );
}
