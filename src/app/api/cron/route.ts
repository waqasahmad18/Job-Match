import { runPipeline } from "@/lib/pipeline";
import { hasMongoUri } from "@/lib/mongodb";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  if (!hasMongoUri()) {
    return NextResponse.json({ error: "MONGODB_URI is missing." }, { status: 400 });
  }

  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = request.headers.get("x-cron-secret") || new URL(request.url).searchParams.get("secret");
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const vercelCron = request.headers.get("x-vercel-cron") === "1";
  const allowed =
    vercelCron ||
    (cronSecret && (headerSecret === cronSecret || bearer === cronSecret)) ||
    !cronSecret;
  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runPipeline({ ingest: true, limit: 80 });
  return NextResponse.json(result);
}
