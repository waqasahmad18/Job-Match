import { runPipeline } from "@/lib/pipeline";
import { hasMongoUri } from "@/lib/mongodb";
import { NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasMongoUri()) {
    return NextResponse.json({ error: "Set MONGODB_URI in .env.local first." }, { status: 400 });
  }

  const cronSecret = process.env.CRON_SECRET;
  const headerSecret = request.headers.get("x-cron-secret");
  if (cronSecret && headerSecret && headerSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const result = await runPipeline({
    ingest: body.ingest !== false,
    ingestHouses: body.ingestHouses === true,
    limit: Number(body.limit || 24),
    sendBatch: Number(body.sendBatch || 6),
    syncBounces: false,
    source: "manual",
  });
  return NextResponse.json(result);
}
