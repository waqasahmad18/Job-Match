export type JobStatus =
  | "new"
  | "processed"
  | "rejected"
  | "matched"
  | "sent";

export type ApplicationStatus =
  | "sent"
  | "skipped"
  | "rejected"
  | "duplicate"
  | "failed"
  | "ready";

export type CvFocus = "fullstack" | "mern" | "laravel" | "python";

export type MatchMethod = "rules" | "ai" | "hybrid";

export type SerializedJob = {
  _id: string;
  source: string;
  externalId?: string;
  sourceUrl: string;
  title: string;
  company: string;
  location: string;
  description: string;
  tags: string[];
  fingerprint: string;
  status: JobStatus;
  postedAt?: string;
  collectedAt: string;
  createdAt: string;
};

export type SerializedMatch = {
  _id: string;
  jobId: string;
  score: number;
  relevant: boolean;
  matchedSkills: string[];
  missingSkills: string[];
  reason: string;
  rejected: boolean;
  rejectReason?: string;
  method: MatchMethod;
  createdAt: string;
};

export type SerializedApplication = {
  _id: string;
  jobId: string;
  matchId?: string;
  cvId?: string;
  status: ApplicationStatus;
  emailTo?: string;
  emailSubject?: string;
  emailBody?: string;
  reason?: string;
  createdAt: string;
  job?: Pick<SerializedJob, "_id" | "title" | "company" | "sourceUrl">;
  cvName?: string;
  score?: number;
};

export type SerializedCv = {
  _id: string;
  name: string;
  focus: CvFocus;
  fileName: string;
  isDefault: boolean;
  createdAt: string;
};

export type UserSettings = {
  locations: string[];
  roles: string[];
  targetTechnologies: string[];
  excludedTechnologies: string[];
  excludedCompanies: string[];
  onsiteCities: string[];
  skills: string[];
  matchThreshold: number;
  dailySendLimit: number;
  cooldownDays: number;
  autoSend: boolean;
  applicantName: string;
  applicantEmail: string;
  smtpUser: string;
  smtpPassword: string;
  smtpFrom: string;
  smtpReady: boolean;
};

export type DashboardStats = {
  jobsToday: number;
  relevantJobs: number;
  applicationsSent: number;
  ignoredRejected: number;
  matchThreshold: number;
  mongoConnected: boolean;
};
