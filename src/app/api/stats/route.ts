import { DAILY_SEND_TARGET, LAHORE_DAILY_SEND_TARGET, REMOTE_DAILY_SEND_TARGET } from "@/lib/constants";
import { getOrCreateSettings } from "@/lib/settings";
import { pingMongo } from "@/lib/mongodb";
import { sentTodayCount, sentTodayLocationCounts } from "@/lib/pipeline";
import { Application, Job, JobMatch, SystemLog } from "@/models";
import { formatPakistanDateTime, startOfPakistanDay } from "@/lib/pakistanDay";
import { NextResponse } from "next/server";

export async function GET() {
  const mongoConnected = await pingMongo();
  if (!mongoConnected) {
    return NextResponse.json({
      jobsToday: 0,
      jobsWaiting: 0,
      relevantJobs: 0,
      relevantWaitingEmail: 0,
      applicationsSent: 0,
      sentToday: 0,
      lahoreToday: 0,
      remoteToday: 0,
      dailyTarget: DAILY_SEND_TARGET,
      lahoreTarget: LAHORE_DAILY_SEND_TARGET,
      remoteTarget: REMOTE_DAILY_SEND_TARGET,
      ignoredRejected: 0,
      matchThreshold: 75,
      mongoConnected: false,
      lastCronAt: "",
      lastCronLabel: "Never",
      lastCronNote: "Automatic hunt has not logged a run yet.",
    });
  }

  const { settings } = await getOrCreateSettings();
  const start = startOfPakistanDay();
  const todayJobs = await Job.find({ collectedAt: { $gte: start } }).select("_id");
  const todayIds = todayJobs.map((item) => item._id);

  const [jobsToday, jobsWaiting, relevantJobs, relevantWaitingEmail, applicationsSent, ignoredRejected, sentToday, locationCounts, lastCron] =
    await Promise.all([
      Job.countDocuments({ collectedAt: { $gte: start } }),
      Job.countDocuments({ status: "new", collectedAt: { $gte: start } }),
      JobMatch.countDocuments({ jobId: { $in: todayIds }, relevant: true, rejected: false }),
      Application.countDocuments({
        status: "skipped",
        reason: /No hiring email/i,
        createdAt: { $gte: start },
      }),
      Application.countDocuments({ status: { $in: ["sent", "ready"] } }),
      Application.countDocuments({ status: { $in: ["rejected", "skipped"] } }),
      sentTodayCount(),
      sentTodayLocationCounts(settings),
      SystemLog.findOne({
        message: { $in: ["Hunt run completed", "Cron run completed", "Cron run failed", "Hunt run failed"] },
      }).sort({ createdAt: -1 }),
    ]);

  const cronContext = (lastCron?.context || {}) as {
    processed?: number;
    sentThisRun?: number;
    ingestedNew?: number;
    skipped?: string;
    error?: string;
    source?: string;
  };
  const lastCronNote = lastCron
    ? lastCron.message.includes("failed")
      ? cronContext.error || "Automatic hunt failed"
      : cronContext.skipped ||
        `Fetched ${cronContext.ingestedNew ?? 0} new. Processed ${cronContext.processed ?? 0}. Sent this run: ${cronContext.sentThisRun ?? 0}.`
    : "Automatic hunt has not logged a run yet. Next Vercel run is 8:00–8:59 AM Pakistan time.";

  return NextResponse.json({
    jobsToday,
    jobsWaiting,
    relevantJobs,
    relevantWaitingEmail,
    applicationsSent,
    sentToday,
    lahoreToday: locationCounts.lahore,
    remoteToday: locationCounts.remote,
    dailyTarget: DAILY_SEND_TARGET,
    lahoreTarget: LAHORE_DAILY_SEND_TARGET,
    remoteTarget: REMOTE_DAILY_SEND_TARGET,
    ignoredRejected,
    matchThreshold: settings.matchThreshold,
    mongoConnected: true,
    lastCronAt: lastCron?.createdAt ? new Date(lastCron.createdAt).toISOString() : "",
    lastCronLabel: lastCron?.createdAt ? formatPakistanDateTime(lastCron.createdAt) : "Never",
    lastCronNote,
  });
}
