import { connectMongo, hasMongoUri } from "@/lib/mongodb";
import { Application, JobMatch } from "@/models";
import { NextResponse } from "next/server";

export async function GET() {
  if (!hasMongoUri()) {
    return NextResponse.json({ applications: [], mongoConnected: false });
  }

  await connectMongo();
  const applications = await Application.find()
    .sort({ createdAt: -1 })
    .limit(80)
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
              sourceUrl: job.sourceUrl,
            }
          : undefined,
        cvName: cv && "name" in cv ? cv.name : undefined,
        score: match?.score,
      };
    }),
  });
}
