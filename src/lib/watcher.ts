const INTERVAL_MS = Number(process.env.WATCH_INTERVAL_MINUTES || 20) * 60 * 1000;

let started = false;

export function startJobWatcher() {
  if (started || process.env.WATCH_JOBS === "false") return;
  started = true;

  const run = async () => {
    if (!process.env.MONGODB_URI) return;
    try {
      const { runPipeline } = await import("@/lib/pipeline");
      const result = await runPipeline({ ingest: true, limit: 30 });
      console.log(`[job-watcher] processed ${result.processed} jobs`);
    } catch (error) {
      console.error("[job-watcher]", error);
    }
  };

  setTimeout(run, 20_000);
  setInterval(run, INTERVAL_MS);
}
