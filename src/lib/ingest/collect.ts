import { classifyLocation } from "@/lib/matching/location";
import type { UserSettings } from "@/types";
import type { NormalizedJob } from "@/lib/ingest/publicBoards";

/**
 * Vercel Hobby hard-stops at ~60s. Keep network work small so CVs can still send.
 */
export async function collectIncomingJobs(
  settings: UserSettings,
  options?: { ingestHouses?: boolean; limit?: number },
) {
  const limit = Math.min(Math.max(options?.limit || 30, 20), 35);
  const errors: string[] = [];
  const { seedPakistanSoftwareHouses, fetchPakistanSoftwareHouses } = await import(
    "@/lib/ingest/pakistanHouses"
  );
  const { seedRemoteSoftwareHouses } = await import("@/lib/ingest/remoteHouses");
  const { fetchAggregatorJobs } = await import("@/lib/ingest/aggregators");
  const { fetchRemoteOkJobs } = await import("@/lib/ingest/remoteok");
  const { fetchPublicBoardJobs } = await import("@/lib/ingest/publicBoards");
  const { fetchLahoreGoogleJobs } = await import("@/lib/ingest/googleJobs");

  const incoming: NormalizedJob[] = [...seedPakistanSoftwareHouses(), ...seedRemoteSoftwareHouses()];

  const settled = await Promise.allSettled([
    fetchLahoreGoogleJobs(Math.min(limit, 16)),
    fetchRemoteOkJobs(15),
    fetchPublicBoardJobs(12),
    fetchAggregatorJobs(12),
    fetchPakistanSoftwareHouses(options?.ingestHouses ? 10 : 6),
  ]);

  for (const result of settled) {
    if (result.status !== "fulfilled") {
      errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
      continue;
    }
    const value = result.value as NormalizedJob[] | { jobs: NormalizedJob[]; error?: string };
    if (Array.isArray(value)) incoming.push(...value);
    else {
      incoming.push(...value.jobs);
      if (value.error) errors.push(value.error);
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

  jobs.sort((left, right) => {
    const rank = (job: NormalizedJob) => {
      if (job.source === "pakistan-houses") return 0;
      if (job.source === "jsearch") return 1;
      if (job.source === "remote-houses") return 2;
      return 3;
    };
    return rank(left) - rank(right);
  });

  return {
    jobs,
    errors,
    fetched: incoming.length,
    kept: jobs.length,
    dropped,
  };
}
