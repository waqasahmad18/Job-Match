import { getMasterCv } from "@/lib/cvStore";
import { extractApplyEmailFromListing, fallbackApplyEmail } from "@/lib/extractEmail";
import { generateApplicationEmail, sendApplicationEmail, smtpConfigured } from "@/lib/email";
import { analyzeJobWithAi } from "@/lib/matching/ai";
import { evaluateHardReject } from "@/lib/matching/exclusions";
import { classifyLocation, evaluateLocationPolicy, locationPriority } from "@/lib/matching/location";
import { evaluateJobRecency } from "@/lib/matching/recency";
import { evaluateMinimumSalary } from "@/lib/matching/salary";
import { scoreJobByKeywords } from "@/lib/matching/keywordScore";
import { DAILY_SEND_TARGET, LAHORE_DAILY_SEND_MAX, LAHORE_DAILY_SEND_MIN } from "@/lib/constants";
import { startOfPakistanDay } from "@/lib/pakistanDay";
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

export async function sentTodayCount() {
  return Application.countDocuments({
    status: { $in: ["sent", "ready"] },
    createdAt: { $gte: startOfPakistanDay() },
  });
}

export async function sentTodayLahoreCount(settings: UserSettings) {
  const apps = await Application.find({
    status: { $in: ["sent", "ready"] },
    createdAt: { $gte: startOfPakistanDay() },
  }).select("jobId");
  if (!apps.length) return 0;
  const jobs = await Job.find({ _id: { $in: apps.map((item) => item.jobId) } });
  return jobs.filter((job) => {
    const locationClass = classifyLocation(job, settings).class;
    return locationClass === "lahore-onsite" || locationClass === "lahore-remote";
  }).length;
}

async function sentToCompanyToday(company: string) {
  const companyJobs = await Job.find({
    company: new RegExp(`^${company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
  }).select("_id");
  return Boolean(
    await Application.exists({
      jobId: { $in: companyJobs.map((item) => item._id) },
      status: { $in: ["sent", "ready"] },
      createdAt: { $gte: startOfPakistanDay() },
    }),
  );
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

export async function processJob(
  jobId: string,
  settings: UserSettings,
  options?: { fillQuota?: boolean },
) {
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

  const recency = evaluateJobRecency(job);
  if (!recency.recent && job.source !== "pakistan-houses") {
    const match = await JobMatch.findOneAndUpdate(
      { jobId: job._id },
      {
        score: 0,
        relevant: false,
        matchedSkills: [],
        missingSkills: [],
        reason: recency.reason,
        rejected: true,
        rejectReason: recency.reason,
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
      reason: recency.reason,
    });
    return { status: "rejected", score: 0, reason: recency.reason };
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

  if (job.source === "pakistan-houses") {
    score = Math.max(score, 80);
    relevant = true;
    if (!matchedSkills.length) matchedSkills = settings.skills.slice(0, 5);
    reason = "Lahore software-house full-stack application.";
  }

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

  const coolingDown = options?.fillQuota
    ? await sentToCompanyToday(job.company)
    : await companyOnCooldown(job.company, settings.cooldownDays);
  if (coolingDown) {
    job.status = "processed";
    await job.save();
    await logDecision({
      jobId: job._id,
      matchId: match._id,
      status: "skipped",
      reason: options?.fillQuota
        ? "Already sent a CV to this company today."
        : `Company cooldown of ${settings.cooldownDays} days is active.`,
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

  const locationClass = classifyLocation(job, settings).class;
  const isLahore = locationClass === "lahore-onsite" || locationClass === "lahore-remote";
  if (isLahore) {
    const lahoreToday = await sentTodayLahoreCount(settings);
    if (lahoreToday >= LAHORE_DAILY_SEND_MAX) {
      job.status = "matched";
      await job.save();
      await logDecision({
        jobId: job._id,
        matchId: match._id,
        status: "skipped",
        reason: `Daily Lahore cap of ${LAHORE_DAILY_SEND_MAX} reached.`,
      });
      return { status: "skipped", score, reason: "Daily Lahore cap reached." };
    }
  }

  const hiringEmail =
    (await extractApplyEmailFromListing(job, [settings.applicantEmail])) ||
    fallbackApplyEmail(job.sourceUrl);
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
      const { fetchPakistanJobs } = await import("@/lib/ingest/pakistanJobs");
      const { fetchAggregatorJobs } = await import("@/lib/ingest/aggregators");
      const { fetchPakistanSoftwareHouses } = await import("@/lib/ingest/pakistanHouses");
      const incoming = [
        ...(await fetchPakistanSoftwareHouses()),
        ...(await fetchPakistanJobs(options?.limit || 50)),
        ...(await fetchAggregatorJobs(options?.limit || 40)),
        ...(await fetchRemoteOkJobs(options?.limit || 40)),
        ...(await fetchPublicBoardJobs(options?.limit || 40)),
      ];
      for (const job of incoming) {
        await upsertIncomingJob(job);
      }
    } catch (error) {
      await SystemLog.create({
        level: "error",
        message: "Job ingestion failed",
        context: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  const fresh = await Job.find({ status: "new" }).limit(300);
  const jobs = [...fresh]
    .sort((left, right) => {
      const leftRank = locationPriority(classifyLocation(left, settings).class);
      const rightRank = locationPriority(classifyLocation(right, settings).class);
      if (leftRank !== rightRank) return leftRank - rightRank;
      const leftTime = new Date(left.postedAt || left.collectedAt || 0).getTime();
      const rightTime = new Date(right.postedAt || right.collectedAt || 0).getTime();
      return rightTime - leftTime;
    })
    .slice(0, options?.limit || 80);
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

  await ensureDailyQuotas(settings, results);

  return {
    processed: results.length,
    smtpReady: smtpConfigured(settings),
    aiReady: Boolean(process.env.AI_API_KEY),
    sentToday: await sentTodayCount(),
    lahoreToday: await sentTodayLahoreCount(settings),
    dailyTarget: DAILY_SEND_TARGET,
    lahoreTarget: `${LAHORE_DAILY_SEND_MIN}-${LAHORE_DAILY_SEND_MAX}`,
    results,
  };
}

async function upsertIncomingJob(job: Record<string, unknown> & { fingerprint: string; description?: string; location?: string; postedAt?: Date }) {
  const existing = await Job.findOne({ fingerprint: job.fingerprint });
  if (!existing) {
    await Job.create(job);
    return;
  }
  if (existing.status === "sent") return;
  existing.description = String(job.description || existing.description);
  existing.location = String(job.location || existing.location);
  existing.status = "new";
  if (job.postedAt) existing.postedAt = job.postedAt;
  await existing.save();
}

async function ensureDailyQuotas(
  settings: UserSettings,
  results: Array<{ jobId: string; status: string; score?: number; reason?: string }>,
) {
  const { fetchPakistanSoftwareHouses } = await import("@/lib/ingest/pakistanHouses");
  try {
    for (const job of await fetchPakistanSoftwareHouses()) {
      await upsertIncomingJob(job);
    }
  } catch {
    // House pages can fail; fallback emails still let quota jobs send.
  }

  const houseJobs = await Job.find({
    source: "pakistan-houses",
    status: { $in: ["new", "matched", "processed"] },
  }).limit(40);

  for (const job of houseJobs) {
    const total = await sentTodayCount();
    const lahore = await sentTodayLahoreCount(settings);
    if (total >= DAILY_SEND_TARGET || lahore >= LAHORE_DAILY_SEND_MAX) break;
    try {
      const result = await processJob(String(job._id), settings, { fillQuota: true });
      results.push({ jobId: String(job._id), ...result });
    } catch (error) {
      results.push({
        jobId: String(job._id),
        status: "failed",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if ((await sentTodayCount()) >= DAILY_SEND_TARGET) return;

  const matches = await JobMatch.find({ relevant: true, rejected: false }).limit(80);
  const retryJobs = await Job.find({
    _id: { $in: matches.map((item) => item.jobId) },
    status: { $in: ["new", "matched", "processed"] },
  });

  for (const job of retryJobs) {
    const total = await sentTodayCount();
    const lahore = await sentTodayLahoreCount(settings);
    if (total >= DAILY_SEND_TARGET) break;
    const locationClass = classifyLocation(job, settings).class;
    const isLahore = locationClass === "lahore-onsite" || locationClass === "lahore-remote";
    const lahoreNeeded = Math.max(0, LAHORE_DAILY_SEND_MIN - lahore);
    if (!isLahore && DAILY_SEND_TARGET - total <= lahoreNeeded) continue;
    try {
      const result = await processJob(String(job._id), settings, { fillQuota: true });
      results.push({ jobId: String(job._id), ...result });
    } catch (error) {
      results.push({
        jobId: String(job._id),
        status: "failed",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
