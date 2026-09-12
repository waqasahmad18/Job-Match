import { connectMongo } from "@/lib/mongodb";
import { getOrCreateSettings } from "@/lib/settings";
import { Application, Job, JobMatch } from "@/models";
import { processJob } from "@/lib/pipeline";
import { NextResponse } from "next/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectMongo();
  const { id } = await params;
  const job = await Job.findById(id).lean();
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const match = await JobMatch.findOne({ jobId: job._id }).lean();
  const applications = await Application.find({ jobId: job._id }).sort({ createdAt: -1 }).lean();
  return NextResponse.json({ job, match, applications });
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectMongo();
  const { id } = await params;
  const { settings } = await getOrCreateSettings();
  const result = await processJob(id, settings);
  return NextResponse.json(result);
}
