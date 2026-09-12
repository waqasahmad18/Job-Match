import { getOrCreateSettings } from "@/lib/settings";
import { pingMongo } from "@/lib/mongodb";
import { Application, Job, JobMatch } from "@/models";
import { NextResponse } from "next/server";

export async function GET() {
  const mongoConnected = await pingMongo();
  if (!mongoConnected) {
    return NextResponse.json({
      jobsToday: 0,
      relevantJobs: 0,
      applicationsSent: 0,
      ignoredRejected: 0,
      matchThreshold: 80,
      mongoConnected: false,
    });
  }

  const { settings } = await getOrCreateSettings();
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const [jobsToday, relevantJobs, applicationsSent, ignoredRejected] = await Promise.all([
    Job.countDocuments({ collectedAt: { $gte: start } }),
    JobMatch.countDocuments({ relevant: true, rejected: false }),
    Application.countDocuments({ status: { $in: ["sent", "ready"] } }),
    Application.countDocuments({ status: { $in: ["rejected", "skipped"] } }),
  ]);

  return NextResponse.json({
    jobsToday,
    relevantJobs,
    applicationsSent,
    ignoredRejected,
    matchThreshold: settings.matchThreshold,
    mongoConnected: true,
  });
}
