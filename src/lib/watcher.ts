const INTERVAL_MS = Number(process.env.WATCH_INTERVAL_MINUTES || 60) * 60 * 1000;

let started = false;

export function startJobWatcher() {
  if (started || process.env.WATCH_JOBS === "false") return;
  started = true;

  const run = async () => {
    if (!process.env.MONGODB_URI) return;
    try {
      const { runPipeline, sentTodayCount } = await import("@/lib/pipeline");
      const { DAILY_SEND_TARGET } = await import("@/lib/constants");
      if ((await sentTodayCount()) >= DAILY_SEND_TARGET) {
        console.log("[job-watcher] daily company quota already reached");
        return;
      }
      const result = await runPipeline({
        ingest: true,
        ingestHouses: false,
        limit: 20,
        sendBatch: 8,
      });
      console.log(`[job-watcher] processed ${result.processed} jobs`);
    } catch (error) {
      console.error("[job-watcher]", error);
    }
  };

  setTimeout(run, 20_000);
  setInterval(run, INTERVAL_MS);
}
