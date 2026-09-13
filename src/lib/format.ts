export function formatJobPlace(location?: string) {
  const raw = (location || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  if (/\blahore\b/i.test(raw)) return "Lahore, Pakistan";
  if (/\bpakistan\b/i.test(raw) && /\bremote\b/i.test(raw)) return "Remote, Pakistan";
  if (/\b(remote|worldwide|anywhere|distributed)\b/i.test(raw)) return "Remote, Worldwide";
  return raw;
}

export function formatCompanyWithPlace(company?: string, location?: string) {
  const name = (company || "").trim();
  const place = formatJobPlace(location);
  if (!name) return place;
  if (!place) return name;
  if (name.toLowerCase().includes(place.toLowerCase())) return name;
  return `${name}, ${place}`;
}

export function listFromText(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatDate(value?: string | Date) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function statusTone(status: string) {
  if (status === "sent" || status === "matched" || status === "ready") return "text-[var(--ok)]";
  if (status === "rejected" || status === "failed") return "text-[var(--danger)]";
  if (status === "duplicate" || status === "skipped") return "text-[var(--accent)]";
  return "text-[var(--muted)]";
}
