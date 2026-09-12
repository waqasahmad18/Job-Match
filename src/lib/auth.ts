const COOKIE = "job_match_session";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function secret() {
  return process.env.AUTH_SECRET || "job-match-dev-secret-change-me";
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function textToBase64Url(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlToText(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return atob(padded + pad);
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function createSessionToken(username: string) {
  const payload = textToBase64Url(JSON.stringify({ u: username, exp: Date.now() + WEEK_MS }));
  return `${payload}.${await sign(payload)}`;
}

export async function readSessionToken(token?: string | null) {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  const expected = await sign(payload);
  if (expected.length !== signature.length) return null;
  const left = new TextEncoder().encode(expected);
  const right = new TextEncoder().encode(signature);
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) mismatch |= left[i] ^ right[i];
  if (mismatch) return null;
  try {
    const data = JSON.parse(base64UrlToText(payload)) as { u: string; exp: number };
    if (!data.exp || data.exp < Date.now()) return null;
    return data.u;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = COOKIE;
