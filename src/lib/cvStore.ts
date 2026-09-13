import path from "path";
import { existsSync } from "fs";

export const MASTER_CV = {
  name: "Waqas Rafique Full Stack CV",
  focus: "fullstack" as const,
  fileName: "Waqas_Rafique_CV.pdf",
  isDefault: true,
};

export function masterCvPath() {
  const candidates = [
    path.join(process.cwd(), "cv", MASTER_CV.fileName),
    path.join(process.cwd(), "uploads", "cv", MASTER_CV.fileName),
  ];
  return candidates.find((filePath) => existsSync(filePath)) || candidates[0];
}

export function getMasterCv() {
  const filePath = masterCvPath();
  if (!existsSync(filePath)) return null;
  return {
    _id: "master-cv",
    ...MASTER_CV,
    filePath,
  };
}

export function resolveCvAttachment(cv?: { fileName?: string; filePath?: string } | null) {
  const fileName = cv?.fileName || MASTER_CV.fileName;
  const candidates = [
    cv?.filePath,
    path.join(process.cwd(), "cv", fileName),
    path.join(process.cwd(), "uploads", "cv", fileName),
    path.join(process.cwd(), "cv", MASTER_CV.fileName),
    path.join(process.cwd(), "uploads", "cv", MASTER_CV.fileName),
  ].filter((item): item is string => Boolean(item));
  const filePath = candidates.find((item) => existsSync(item));
  if (!filePath) return null;
  return { filename: fileName, path: filePath };
}
