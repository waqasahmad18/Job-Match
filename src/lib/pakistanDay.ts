/** Start of the current calendar day in Pakistan (UTC+5). */
export function startOfPakistanDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return new Date(`${parts}T00:00:00+05:00`);
}

export function formatPakistanDateTime(value?: Date | string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
