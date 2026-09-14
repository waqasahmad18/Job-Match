import { PROCESS_BATCH_PER_RUN, SEND_BATCH_PER_RUN } from "@/lib/constants";
import { runPipeline } from "@/lib/pipeline";
import { connectMongo, hasMongoUri } from "@/lib/mongodb";
import { SystemLog } from "@/models";
import { NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function cleanSecret(value: string | null | undefined) {
  return (value || "").trim();
}

function isVercelCronRequest(request: Request) {
  const ua = request.headers.get("user-agent") || "";
  return (
    ua.includes("vercel-cron") ||
    Boolean(request.headers.get("x-vercel-cron-schedule")) ||
    request.headers.get("x-vercel-cron") === "1"
  );
}

export async function GET(request: Request) {
  if (!hasMongoUri()) {
    return NextResponse.json({ error: "MONGODB_URI is missing." }, { status: 400 });
  }

  const cronSecret = cleanSecret(process.env.CRON_SECRET);
  const headerSecret = cleanSecret(
    request.headers.get("x-cron-secret") || new URL(request.url).searchParams.get("secret"),
  );
  const bearer = cleanSecret(request.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
  const vercelCron = isVercelCronRequest(request);
  const allowed =
    vercelCron ||
    (cronSecret && (headerSecret === cronSecret || bearer === cronSecret)) ||
    !cronSecret;
  if (!allowed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectMongo();

  const url = new URL(request.url);
  const ingest = url.searchParams.get("ingest") !== "0";
  const sendBatch = Number(url.searchParams.get("batch") || SEND_BATCH_PER_RUN);

  try {
    const result = await runPipeline({
      ingest,
      ingestHouses: false,
      limit: Math.max(PROCESS_BATCH_PER_RUN, sendBatch * 2),
      sendBatch,
      syncBounces: true,
      source: vercelCron ? "vercel-cron" : "github-or-manual",
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await SystemLog.create({
      level: "error",
      message: "Cron run failed",
      context: { error: message, source: vercelCron ? "vercel" : "github-or-manual" },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
