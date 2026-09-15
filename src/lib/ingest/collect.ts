import { classifyLocation } from "@/lib/matching/location";
import type { UserSettings } from "@/types";
import type { NormalizedJob } from "@/lib/ingest/publicBoards";

export async function collectIncomingJobs(
  settings: UserSettings,
  options?: { ingestHouses?: boolean; limit?: number },
) {
  const limit = Math.max(options?.limit || 40, 40);
  const errors: string[] = [];
  const { seedPakistanSoftwareHouses, fetchPakistanSoftwareHouses } = await import(
    "@/lib/ingest/pakistanHouses"
  );
  const { seedRemoteSoftwareHouses, fetchRemoteSoftwareHouses } = await import("@/lib/ingest/remoteHouses");
  const { fetchAggregatorJobs } = await import("@/lib/ingest/aggregators");
  const { fetchRemoteOkJobs } = await import("@/lib/ingest/remoteok");
  const { fetchPublicBoardJobs } = await import("@/lib/ingest/publicBoards");

  const settled = await Promise.allSettled([
    fetchAggregatorJobs(limit),
    fetchRemoteOkJobs(limit),
    fetchPublicBoardJobs(limit),
    Promise.resolve(seedPakistanSoftwareHouses()),
    Promise.resolve(seedRemoteSoftwareHouses()),
  ]);

  const incoming: NormalizedJob[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") incoming.push(...result.value);
    else errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
  }

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

  // Prefer worldwide remote boards first so Collect does not look “Lahore-only”.
  jobs.sort((left, right) => {
    const leftRemote = left.source === "remote-houses" || /remote|worldwide/i.test(left.location) ? 0 : 1;
    const rightRemote = right.source === "remote-houses" || /remote|worldwide/i.test(right.location) ? 0 : 1;
    if (leftRemote !== rightRemote) return leftRemote - rightRemote;
    return left.source === "pakistan-houses" ? 1 : right.source === "pakistan-houses" ? -1 : 0;
  });

  return {
    jobs,
    errors,
    fetched: incoming.length,
    kept: jobs.length,
    dropped,
  };
}
