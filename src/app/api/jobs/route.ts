import { jobFingerprint } from "@/lib/fingerprint";
import { parsePastedJob } from "@/lib/ingest/parseJobPaste";
import { connectMongo, hasMongoUri } from "@/lib/mongodb";
import { getOrCreateSettings } from "@/lib/settings";
import { processJob } from "@/lib/pipeline";
import { Job, JobMatch } from "@/models";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  if (!hasMongoUri()) {
    return NextResponse.json({ jobs: [], mongoConnected: false });
  }

  await connectMongo();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const query = status ? { status } : {};
  const jobs = await Job.find(query).sort({ collectedAt: -1 }).limit(100).lean();
  const matches = await JobMatch.find({
    jobId: { $in: jobs.map((job) => job._id) },
  }).lean();
  const matchMap = new Map(matches.map((match) => [String(match.jobId), match]));

  return NextResponse.json({
    mongoConnected: true,
    jobs: jobs.map((job) => ({
      ...job,
      _id: String(job._id),
      postedAt: job.postedAt?.toISOString(),
      collectedAt: job.collectedAt?.toISOString(),
      createdAt: job.createdAt?.toISOString(),
      match: matchMap.get(String(job._id))
        ? {
            ...matchMap.get(String(job._id)),
            _id: String(matchMap.get(String(job._id))?._id),
            jobId: String(job._id),
          }
        : null,
    })),
  });
}

export async function POST(request: Request) {
  if (!hasMongoUri()) {
    return NextResponse.json({ error: "Set MONGODB_URI in .env.local first." }, { status: 400 });
  }
  await connectMongo();
  const body = await request.json();
  const pasted = String(body.pastedText || "").trim() ? parsePastedJob(String(body.pastedText)) : null;
  const title = String(body.title || pasted?.title || "").trim();
  const company = String(body.company || pasted?.company || "").trim();
  const sourceUrl = String(body.sourceUrl || "").trim() || `manual://${encodeURIComponent(title)}`;
  const description = String(body.description || pasted?.description || "").trim();
  const location = String(body.location || pasted?.location || "Lahore, Pakistan").trim();

  if (!title || !company || !description) {
    return NextResponse.json({ error: "Title, company and description are required." }, { status: 400 });
  }

  const fingerprint = jobFingerprint({
    sourceUrl,
    externalId: body.externalId,
    company,
    title,
    description,
  });

  const job = await Job.findOneAndUpdate(
    { fingerprint },
    {
      $setOnInsert: {
        source: body.source || (pasted ? "pakistan-paste" : "manual"),
        externalId: body.externalId,
        sourceUrl: sourceUrl.startsWith("http") ? sourceUrl : `manual://${encodeURIComponent(title)}`,
        title,
        company,
        location,
        description,
        tags: Array.isArray(body.tags) ? body.tags : [],
        fingerprint,
        status: "new",
        collectedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );

  if (body.processNow) {
    const { settings } = await getOrCreateSettings();
    const result = await processJob(String(job._id), settings);
    return NextResponse.json({ job, result });
  }

  return NextResponse.json({ job });
}
