const FETCH_MS = 8_000;

export async function fetchJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "job-match-automation/1.0",
      ...headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_MS),
  });
  if (!response.ok) {
    throw new Error(`Request failed ${response.status}`);
  }
  return (await response.json()) as T;
}
