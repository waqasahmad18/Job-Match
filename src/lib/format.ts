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
