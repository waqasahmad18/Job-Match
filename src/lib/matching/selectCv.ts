import type { CvFocus } from "@/types";

type CvLike = {
  _id: unknown;
  focus: CvFocus;
  isDefault?: boolean;
};

export function selectCvFocus(job: {
  title: string;
  description: string;
  tags?: string[];
}): CvFocus {
  const text = `${job.title} ${job.description} ${(job.tags || []).join(" ")}`.toLowerCase();

  if (/laravel|php/.test(text) && !/react|next\.js|node\.js|mern/.test(text)) {
    return "laravel";
  }
  if (/django|python/.test(text) && !/react|next\.js|node\.js|mern/.test(text)) {
    return "python";
  }
  if (/mern|react|next\.js|node\.js|mongodb|express/.test(text)) {
    return "mern";
  }
  return "fullstack";
}

export function selectCvVersion<T extends CvLike>(
  job: {
    title: string;
    description: string;
    tags?: string[];
  },
  cvs: T[],
) {
  if (!cvs.length) return null;
  return (
    cvs.find((cv) => cv.isDefault) ||
    cvs.find((cv) => cv.focus === "fullstack") ||
    cvs.find((cv) => cv.focus === selectCvFocus(job)) ||
    cvs[0]
  );
}
