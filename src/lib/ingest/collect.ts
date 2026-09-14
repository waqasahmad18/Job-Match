import { classifyLocation } from "@/lib/matching/location";
import type { UserSettings } from "@/types";
import type { NormalizedJob } from "@/lib/ingest/publicBoards";

export async function collectIncomingJobs(
  settings: UserSettings,
  options?: { ingestHouses?: boolean; limit?: number },
) {
  const limit = options?.limit || 25;
  const errors: string[] = [];
  const { seedPakistanSoftwareHouses, fetchPakistanSoftwareHouses } = await import(
    "@/lib/ingest/pakistanHouses"
  );
  const { seedRemoteSoftwareHouses, fetchRemoteSoftwareHouses } = await import("@/lib/ingest/remoteHouses");

  const incoming: NormalizedJob[] = [...seedPakistanSoftwareHouses(), ...seedRemoteSoftwareHouses()];

  const boardFetch = (async () => {
    const { fetchAggregatorJobs } = await import("@/lib/ingest/aggregators");
    const { fetchRemoteOkJobs } = await import("@/lib/ingest/remoteok");
    const { fetchPublicBoardJobs } = await import("@/lib/ingest/publicBoards");
    const settled = await Promise.allSettled([
      fetchAggregatorJobs(limit),
      fetchRemoteOkJobs(limit),
      fetchPublicBoardJobs(limit),
    ]);
    const jobs: NormalizedJob[] = [];
    for (const result of settled) {
      if (result.status === "fulfilled") jobs.push(...result.value);
      else errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
    }
    return jobs;
  })();

  const boards = await Promise.race([
    boardFetch,
    new Promise<NormalizedJob[]>((resolve) => setTimeout(() => resolve([]), 12_000)),
  ]);
  incoming.push(...boards);

  if (options?.ingestHouses) {
    const houses = await Promise.allSettled([fetchPakistanSoftwareHouses(), fetchRemoteSoftwareHouses()]);
    for (const result of houses) {
      if (result.status === "fulfilled") incoming.push(...result.value);
      else errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
    }
  }

  const seen = new Set<string>();
  const jobs: NormalizedJob[] = [];
  let dropped = 0;
  for (const job of incoming) {
    if (seen.has(job.fingerprint)) continue;
    seen.add(job.fingerprint);
    if (!classifyLocation(job, settings).allowed) {
      dropped += 1;
      continue;
    }
    jobs.push(job);
  }

  return {
    jobs,
    errors,
    fetched: incoming.length,
    kept: jobs.length,
    dropped,
  };
}
