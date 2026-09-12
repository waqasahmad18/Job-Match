import { getMasterCv } from "@/lib/cvStore";
import { extractApplyEmail } from "@/lib/extractEmail";
import { generateApplicationEmail, sendApplicationEmail, smtpConfigured } from "@/lib/email";
import { analyzeJobWithAi } from "@/lib/matching/ai";
import { evaluateHardReject } from "@/lib/matching/exclusions";
import { evaluateLocationPolicy } from "@/lib/matching/location";
import { evaluateMinimumSalary } from "@/lib/matching/salary";
import { scoreJobByKeywords } from "@/lib/matching/keywordScore";
import { selectCvVersion } from "@/lib/matching/selectCv";
import { getOrCreateSettings } from "@/lib/settings";
import { Application, CvVersion, EmailLog, Job, JobMatch, SystemLog } from "@/models";
import type { ApplicationStatus, UserSettings } from "@/types";

async function alreadyApplied(job: {
  _id: unknown;
  company: string;
  fingerprint: string;
}) {
  const existing = await Application.findOne({
    status: { $in: ["sent", "ready", "duplicate"] },
    $or: [{ jobId: job._id }],
  });
  if (existing) return existing;

  const sibling = await Job.findOne({
    _id: { $ne: job._id },
    fingerprint: job.fingerprint,
  });
  if (sibling) {
    return Application.findOne({
      jobId: sibling._id,
      status: { $in: ["sent", "ready"] },
    });
  }
  return null;
}

async function companyOnCooldown(company: string, cooldownDays: number) {
  if (!cooldownDays) return false;
  const since = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000);
  const companyJobs = await Job.find({
    company: new RegExp(`^${company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
  }).select("_id");
  return Boolean(
    await Application.exists({
      jobId: { $in: companyJobs.map((item) => item._id) },
      status: "sent",
      createdAt: { $gte: since },
    }),
  );
}

async function sentTodayCount() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Application.countDocuments({
    status: { $in: ["sent", "ready"] },
    createdAt: { $gte: start },
  });
}

function mongoCvId(cv: { _id?: unknown } | null) {
  if (!cv?._id || String(cv._id) === "master-cv") return undefined;
  return cv._id;
}

async function logDecision(input: {
  jobId: unknown;
  matchId?: unknown;
  cvId?: unknown;
  status: ApplicationStatus;
  companyName?: string;
  jobTitle?: string;
  reason?: string;
  emailTo?: string;
  emailSubject?: string;
  emailBody?: string;
}) {
  if (!input.companyName || !input.jobTitle) {
    const job = await Job.findById(input.jobId).select("company title");
    input.companyName = input.companyName || job?.company;
    input.jobTitle = input.jobTitle || job?.title;
  }
  return Application.create(input);
}

export async function processJob(jobId: string, settings: UserSettings) {
  const job = await Job.findById(jobId);
  if (!job) throw new Error("Job not found");

  const location = evaluateLocationPolicy(job, settings);
  if (!location.allowed) {
    const match = await JobMatch.findOneAndUpdate(
      { jobId: job._id },
      {
        score: 0,
        relevant: false,
        matchedSkills: [],
        missingSkills: [],
        reason: location.reason,
        rejected: true,
        rejectReason: location.reason,
        method: "rules",
      },
      { upsert: true, new: true },
    );
    job.status = "rejected";
    await job.save();
    await logDecision({
      jobId: job._id,
      matchId: match._id,
      status: "rejected",
      reason: location.reason,
    });
    return { status: "rejected", score: 0, reason: location.reason };
  }

  const salary = evaluateMinimumSalary(
    `${job.title} ${job.location} ${job.description} ${(job.tags || []).join(" ")}`,
    settings.minSalaryPkr || 80_000,
  );
  if (!salary.allowed) {
    const match = await JobMatch.findOneAndUpdate(
      { jobId: job._id },
      {
        score: 0,
        relevant: false,
        matchedSkills: [],
        missingSkills: [],
        reason: salary.reason,
        rejected: true,
        rejectReason: salary.reason,
        method: "rules",
      },
      { upsert: true, new: true },
    );
    job.status = "rejected";
    await job.save();
    await logDecision({
      jobId: job._id,
      matchId: match._id,
      status: "rejected",
      reason: salary.reason,
    });
    return { status: "rejected", score: 0, reason: salary.reason };
  }

  const exclusion = evaluateHardReject({
    title: job.title,
    description: job.description,
    tags: job.tags,
    excludedTechnologies: settings.excludedTechnologies,
    targetTechnologies: settings.targetTechnologies,
  });

  if (exclusion.rejected) {
    const match = await JobMatch.findOneAndUpdate(
      { jobId: job._id },
      {
        score: 0,
        relevant: false,
        matchedSkills: [],
        missingSkills: [],
        reason: exclusion.reason,
        rejected: true,
        rejectReason: exclusion.reason,
        method: "rules",
      },
      { upsert: true, new: true },
    );
    job.status = "rejected";
    await job.save();
    await logDecision({
      jobId: job._id,
      matchId: match._id,
      status: "rejected",
      reason: exclusion.reason,
    });
    return { status: "rejected", score: 0, reason: exclusion.reason };
  }

  const keyword = scoreJobByKeywords(job, settings);
  let score = keyword.score;
  let relevant = keyword.relevant;
  let matchedSkills = keyword.matchedSkills;
  let missingSkills = keyword.missingSkills;
  let reason = keyword.reason;
  let method: "rules" | "ai" | "hybrid" = "rules";

  if (keyword.relevant && process.env.AI_API_KEY) {
    try {
      const ai = await analyzeJobWithAi(job, settings);
      if (ai) {
        score = ai.score;
        relevant = ai.relevant;
        matchedSkills = ai.matched_skills;
        missingSkills = ai.missing_skills;
        reason = ai.reason;
        method = "hybrid";
      }
    } catch (error) {
      method = "rules";
      reason = `${keyword.reason} AI fallback: ${error instanceof Error ? error.message : "failed"}`;
    }
  }

  const match = await JobMatch.findOneAndUpdate(
    { jobId: job._id },
    {
      score,
      relevant,
      matchedSkills,
      missingSkills,
      reason,
      rejected: false,
      method,
    },
    { upsert: true, new: true },
  );

  if (!relevant || score < settings.matchThreshold) {
    job.status = "processed";
    await job.save();
    await logDecision({
      jobId: job._id,
      matchId: match._id,
      status: "skipped",
      reason: `Score ${score} below threshold ${settings.matchThreshold}. ${reason}`,
    });
    return { status: "skipped", score, reason };
  }

  const duplicate = await alreadyApplied(job);
  if (duplicate) {
    job.status = "processed";
    await job.save();
    await logDecision({
      jobId: job._id,
      matchId: match._id,
      status: "duplicate",
      reason: "Duplicate job or previous application already exists.",
    });
    return { status: "duplicate", score, reason: "Duplicate application prevented." };
  }

  if (await companyOnCooldown(job.company, settings.cooldownDays)) {
    job.status = "processed";
    await job.save();
    await logDecision({
      jobId: job._id,
      matchId: match._id,
      status: "skipped",
      reason: `Company cooldown of ${settings.cooldownDays} days is active.`,
    });
    return { status: "skipped", score, reason: "Company cooldown." };
  }

  const today = await sentTodayCount();
  if (today >= settings.dailySendLimit) {
    job.status = "matched";
    await job.save();
    await logDecision({
      jobId: job._id,
      matchId: match._id,
      status: "skipped",
      reason: `Daily send limit of ${settings.dailySendLimit} reached.`,
    });
    return { status: "skipped", score, reason: "Daily send limit reached." };
  }

  const hiringEmail = extractApplyEmail(
    `${job.description} ${job.sourceUrl}`,
    [settings.applicantEmail],
  );
  if (!hiringEmail) {
    job.status = "matched";
    await job.save();
    await logDecision({
      jobId: job._id,
      matchId: match._id,
      status: "skipped",
      reason: "No hiring email found in the job posting.",
    });
    return { status: "skipped", score, reason: "No hiring email found in the job posting." };
  }

  const cvs = await CvVersion.find();
  const cv = selectCvVersion(job, cvs) || getMasterCv();
  const email = generateApplicationEmail({
    settings,
    job,
    matchedSkills,
  });
  const to = hiringEmail;

  if (!settings.autoSend) {
    job.status = "matched";
    await job.save();
    await logDecision({
      jobId: job._id,
      matchId: match._id,
      cvId: mongoCvId(cv),
      status: "ready",
      emailTo: to,
      emailSubject: email.subject,
      emailBody: email.body,
      reason: "Auto-send disabled. Application prepared.",
    });
    return { status: "ready", score, reason: "Prepared without sending." };
  }

  try {
    const result = await sendApplicationEmail({
      to,
      subject: email.subject,
      body: email.body,
      replyTo: settings.applicantEmail || undefined,
      attachment: cv ? { filename: cv.fileName, path: cv.filePath } : undefined,
      settings,
    });

    const status: ApplicationStatus = result.sent ? "sent" : "ready";
    job.status = result.sent ? "sent" : "matched";
    await job.save();
    const application = await logDecision({
      jobId: job._id,
      matchId: match._id,
      cvId: mongoCvId(cv),
      status,
      emailTo: to,
      emailSubject: email.subject,
      emailBody: email.body,
      reason: result.sent ? "Email sent." : result.error,
    });
    await EmailLog.create({
      applicationId: application._id,
      jobId: job._id,
      to,
      subject: email.subject,
      success: Boolean(result.sent),
      error: result.sent ? undefined : result.error,
    });
    return { status, score, reason: result.sent ? "Email sent." : result.error };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email failed";
    job.status = "matched";
    await job.save();
    await logDecision({
      jobId: job._id,
      matchId: match._id,
      cvId: mongoCvId(cv),
      status: "failed",
      emailTo: to,
      emailSubject: email.subject,
      emailBody: email.body,
      reason: message,
    });
    return { status: "failed", score, reason: message };
  }
}

export async function runPipeline(options?: { ingest?: boolean; limit?: number }) {
  const { settings } = await getOrCreateSettings();
  const results: Array<{ jobId: string; status: string; score?: number; reason?: string }> = [];

  if (options?.ingest !== false) {
    const { fetchRemoteOkJobs } = await import("@/lib/ingest/remoteok");
    const { fetchPublicBoardJobs } = await import("@/lib/ingest/publicBoards");
    try {
      const incoming = [
        ...(await fetchRemoteOkJobs(options?.limit || 40)),
        ...(await fetchPublicBoardJobs(options?.limit || 40)),
      ];
      for (const job of incoming) {
        await Job.updateOne({ fingerprint: job.fingerprint }, { $setOnInsert: job }, { upsert: true });
      }
    } catch (error) {
      await SystemLog.create({
        level: "error",
        message: "Job ingestion failed",
        context: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  const jobs = await Job.find({ status: "new" }).limit(options?.limit || 40);
  for (const job of jobs) {
    try {
      const result = await processJob(String(job._id), settings);
      results.push({ jobId: String(job._id), ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await SystemLog.create({
        level: "error",
        message: "Job processing failed",
        context: { jobId: String(job._id), error: message },
      });
      results.push({ jobId: String(job._id), status: "failed", reason: message });
    }
  }

  return {
    processed: results.length,
    smtpReady: smtpConfigured(settings),
    aiReady: Boolean(process.env.AI_API_KEY),
    results,
  };
}
