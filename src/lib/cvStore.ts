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
