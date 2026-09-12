import { DAILY_SEND_TARGET, LAHORE_DAILY_SEND_MAX, LAHORE_DAILY_SEND_MIN } from "@/lib/constants";
import { getOrCreateSettings } from "@/lib/settings";
import { pingMongo } from "@/lib/mongodb";
import { sentTodayCount, sentTodayLahoreCount } from "@/lib/pipeline";
import { Application, Job, JobMatch } from "@/models";
import { startOfPakistanDay } from "@/lib/pakistanDay";
import { NextResponse } from "next/server";

export async function GET() {
  const mongoConnected = await pingMongo();
  if (!mongoConnected) {
    return NextResponse.json({
      jobsToday: 0,
      relevantJobs: 0,
      relevantWaitingEmail: 0,
      applicationsSent: 0,
      sentToday: 0,
      lahoreToday: 0,
      dailyTarget: DAILY_SEND_TARGET,
      lahoreTarget: `${LAHORE_DAILY_SEND_MIN}-${LAHORE_DAILY_SEND_MAX}`,
      ignoredRejected: 0,
      matchThreshold: 80,
      mongoConnected: false,
    });
  }

  const { settings } = await getOrCreateSettings();
  const start = startOfPakistanDay();

  const [jobsToday, relevantJobs, relevantWaitingEmail, applicationsSent, ignoredRejected, sentToday, lahoreToday] =
    await Promise.all([
      Job.countDocuments({ collectedAt: { $gte: start } }),
      JobMatch.countDocuments({ relevant: true, rejected: false }),
      Application.countDocuments({
        status: "skipped",
        reason: /No hiring email/i,
      }),
      Application.countDocuments({ status: { $in: ["sent", "ready"] } }),
      Application.countDocuments({ status: { $in: ["rejected", "skipped"] } }),
      sentTodayCount(),
      sentTodayLahoreCount(settings),
    ]);

  return NextResponse.json({
    jobsToday,
    relevantJobs,
    relevantWaitingEmail,
    applicationsSent,
    sentToday,
    lahoreToday,
    dailyTarget: DAILY_SEND_TARGET,
    lahoreTarget: `${LAHORE_DAILY_SEND_MIN}-${LAHORE_DAILY_SEND_MAX}`,
    ignoredRejected,
    matchThreshold: settings.matchThreshold,
    mongoConnected: true,
  });
}
