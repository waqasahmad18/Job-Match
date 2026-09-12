import { fetchAggregatorJobs } from "@/lib/ingest/aggregators";
import { fetchPublicBoardJobs } from "@/lib/ingest/publicBoards";
import { fetchRemoteOkJobs } from "@/lib/ingest/remoteok";

function isPakistanJob(job: { location?: string; description?: string; title?: string; source?: string }) {
  return (
    job.source === "jsearch" ||
    /pakistan|lahore|karachi|islamabad/i.test(`${job.location || ""} ${job.title || ""} ${job.description || ""}`)
  );
}

export async function fetchPakistanJobs(limit = 40) {
  const [boards, remoteOk, aggregators] = await Promise.allSettled([
    fetchPublicBoardJobs(80),
    fetchRemoteOkJobs(80),
    fetchAggregatorJobs(40),
  ]);
  const incoming = [
    ...(aggregators.status === "fulfilled" ? aggregators.value : []),
    ...(boards.status === "fulfilled" ? boards.value : []),
    ...(remoteOk.status === "fulfilled" ? remoteOk.value : []),
  ].filter(isPakistanJob);

  return incoming.slice(0, limit);
}
