import { PROCESS_BATCH_PER_RUN, SEND_BATCH_PER_RUN } from "@/lib/constants";
import { runPipeline } from "@/lib/pipeline";
import { hasMongoUri } from "@/lib/mongodb";
import { NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

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

  const url = new URL(request.url);
  const ingest = url.searchParams.get("ingest") !== "0";
  const sendBatch = Number(url.searchParams.get("batch") || SEND_BATCH_PER_RUN);
  const result = await runPipeline({
    ingest,
    ingestHouses: false,
    limit: Math.max(PROCESS_BATCH_PER_RUN, sendBatch * 2),
    sendBatch,
  });
  return NextResponse.json(result);
}
