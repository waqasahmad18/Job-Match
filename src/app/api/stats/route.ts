import { DAILY_SEND_TARGET, LAHORE_DAILY_SEND_TARGET, REMOTE_DAILY_SEND_TARGET } from "@/lib/constants";
import { getOrCreateSettings } from "@/lib/settings";
import { pingMongo } from "@/lib/mongodb";
import { sentTodayCount, sentTodayLocationCounts } from "@/lib/pipeline";
import { Application, Job, JobMatch } from "@/models";
import { startOfPakistanDay } from "@/lib/pakistanDay";
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
    });
  }

  const { settings } = await getOrCreateSettings();
  const start = startOfPakistanDay();
  const todayJobs = await Job.find({ collectedAt: { $gte: start } }).select("_id");
  const todayIds = todayJobs.map((item) => item._id);

  const [jobsToday, jobsWaiting, relevantJobs, relevantWaitingEmail, applicationsSent, ignoredRejected, sentToday, locationCounts] =
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
    ]);

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
  });
}
