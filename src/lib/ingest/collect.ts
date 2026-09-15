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
  const { fetchLahoreGoogleJobs } = await import("@/lib/ingest/googleJobs");

  // Always seed every Lahore + remote house so Collect targets the full house list.
  const incoming: NormalizedJob[] = [...seedPakistanSoftwareHouses(), ...seedRemoteSoftwareHouses()];

  const settled = await Promise.allSettled([
    fetchLahoreGoogleJobs(limit),
    fetchAggregatorJobs(limit),
    fetchRemoteOkJobs(limit),
    fetchPublicBoardJobs(limit),
    // Fresh careers-page scrape for a rotating Lahore batch (emails + open roles).
    fetchPakistanSoftwareHouses(24),
  ]);

  for (const result of settled) {
    if (result.status !== "fulfilled") {
      errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
      continue;
    }
    const value = result.value as NormalizedJob[] | { jobs: NormalizedJob[]; error?: string };
    if (Array.isArray(value)) {
      incoming.push(...value);
    } else {
      incoming.push(...value.jobs);
      if (value.error) errors.push(value.error);
    }
  }

  if (options?.ingestHouses) {
    const houses = await Promise.allSettled([fetchPakistanSoftwareHouses(30), fetchRemoteSoftwareHouses()]);
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

  // Lahore houses + Google Jobs first, then worldwide remote.
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
