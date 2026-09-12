import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getMasterCv } from "@/lib/cvStore";
import { connectMongo, hasMongoUri } from "@/lib/mongodb";
import { CvVersion } from "@/models";
import { NextResponse } from "next/server";

function serializeMaster() {
  const master = getMasterCv();
  if (!master) return [];
  return [
    {
      _id: master._id,
      name: master.name,
      focus: master.focus,
      fileName: master.fileName,
      isDefault: true,
      createdAt: new Date().toISOString(),
    },
  ];
}

export async function GET() {
  const master = serializeMaster();
  if (!hasMongoUri()) {
    return NextResponse.json({ cvs: master, mongoConnected: false });
  }
  await connectMongo();
  const cvs = await CvVersion.find().sort({ createdAt: -1 }).lean();
  const uploaded = cvs.map((cv) => ({
    _id: String(cv._id),
    name: cv.name,
    focus: cv.focus,
    fileName: cv.fileName,
    isDefault: cv.isDefault,
    createdAt: cv.createdAt,
  }));
  const alreadyListed = uploaded.some((cv) => cv.fileName === "Waqas_Rafique_CV.pdf");
  return NextResponse.json({
    mongoConnected: true,
    cvs: alreadyListed ? uploaded : [...master, ...uploaded],
  });
}

export async function POST(request: Request) {
  if (!hasMongoUri()) {
    return NextResponse.json({ error: "Set MONGODB_URI in .env.local first." }, { status: 400 });
  }
  await connectMongo();
  const form = await request.formData();
  const file = form.get("file");
  const name = String(form.get("name") || "").trim();
  const focus = String(form.get("focus") || "fullstack");
  const isDefault = String(form.get("isDefault") || "") === "true";

  if (!(file instanceof File) || !name) {
    return NextResponse.json({ error: "CV name and file are required." }, { status: 400 });
  }

  const uploadDir = path.join(process.cwd(), "uploads", "cv");
  await mkdir(uploadDir, { recursive: true });
  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const filePath = path.join(uploadDir, safeName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  if (isDefault) {
    await CvVersion.updateMany({}, { isDefault: false });
  }

  const cv = await CvVersion.create({
    name,
    focus,
    filePath,
    fileName: file.name,
    isDefault,
  });

  return NextResponse.json({ cv });
}
