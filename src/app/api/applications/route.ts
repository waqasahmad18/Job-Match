import { connectMongo, hasMongoUri } from "@/lib/mongodb";
import { Application, JobMatch } from "@/models";
import { NextResponse } from "next/server";

function pakistanDayRange(dateValue: string) {
  const start = new Date(`${dateValue}T00:00:00+05:00`);
  const end = new Date(`${dateValue}T23:59:59.999+05:00`);
  return { start, end };
}

export async function GET(request: Request) {
  if (!hasMongoUri()) {
    return NextResponse.json({ applications: [], mongoConnected: false });
  }

  await connectMongo();
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const status = searchParams.get("status") || undefined;
  const query: Record<string, unknown> = {};
  if (status) {
    const statuses = status.split(",").map((item) => item.trim()).filter(Boolean);
    query.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
  }
  if (date) {
    const { start, end } = pakistanDayRange(date);
    query.createdAt = { $gte: start, $lte: end };
  }

  const applications = await Application.find(query)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("jobId")
    .populate("cvId")
    .lean();

  const matchIds = applications.map((item) => item.matchId).filter(Boolean);
  const matches = await JobMatch.find({ _id: { $in: matchIds } }).lean();
  const matchMap = new Map(matches.map((match) => [String(match._id), match]));

  return NextResponse.json({
    mongoConnected: true,
    applications: applications.map((item) => {
      const job = item.jobId && typeof item.jobId === "object" ? item.jobId : null;
      const cv = item.cvId && typeof item.cvId === "object" ? item.cvId : null;
      const match = item.matchId ? matchMap.get(String(item.matchId)) : null;
      return {
        _id: String(item._id),
        jobId: job && "_id" in job ? String(job._id) : String(item.jobId),
        status: item.status,
        companyName: item.companyName || (job && "company" in job ? job.company : undefined),
        jobTitle: item.jobTitle || (job && "title" in job ? job.title : undefined),
        emailTo: item.emailTo,
        emailSubject: item.emailSubject,
        emailBody: item.emailBody,
        reason: item.reason,
        createdAt: item.createdAt,
            job: job && "title" in job
          ? {
              _id: String(job._id),
              title: job.title,
              company: job.company,
              location: "location" in job ? String(job.location || "") : "",
              sourceUrl: job.sourceUrl,
            }
          : undefined,
        cvName: cv && "name" in cv ? cv.name : undefined,
        score: match?.score,
      };
    }),
  });
}
