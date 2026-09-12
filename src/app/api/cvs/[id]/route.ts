import { unlink } from "fs/promises";
import { connectMongo } from "@/lib/mongodb";
import { CvVersion } from "@/models";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectMongo();
  const { id } = await params;
  const cv = await CvVersion.findByIdAndDelete(id);
  if (cv?.filePath) {
    await unlink(cv.filePath).catch(() => undefined);
  }
  return NextResponse.json({ ok: true });
}
