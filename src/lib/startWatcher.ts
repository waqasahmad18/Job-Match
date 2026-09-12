export function ensureLocalWatcher() {
  if (process.env.VERCEL || process.env.WATCH_JOBS === "false") return;
  void import("./watcher")
    .then((mod) => mod.startJobWatcher())
    .catch((error) => console.error("[job-watcher] start failed", error));
}
