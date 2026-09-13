import { getMasterCv, resolveCvAttachment } from "@/lib/cvStore";
import { extractApplyEmailFromListing, fallbackApplyEmail } from "@/lib/extractEmail";
import { generateApplicationEmail, sendApplicationEmail, smtpConfigured } from "@/lib/email";
import { analyzeJobWithAi } from "@/lib/matching/ai";
import { evaluateHardReject } from "@/lib/matching/exclusions";
import { classifyLocation, evaluateLocationPolicy, locationPriority } from "@/lib/matching/location";
import { evaluateJobRecency } from "@/lib/matching/recency";
import { evaluateMinimumSalary } from "@/lib/matching/salary";
import { scoreJobByKeywords } from "@/lib/matching/keywordScore";
import {
  alreadyApproachedCompany,
  acquireLocalPipelineLock,
  acquireMongoPipelineLock,
  claimInFlight,
  releaseInFlight,
  releaseLocalPipelineLock,
  releaseMongoPipelineLock,
} from "@/lib/companyLock";
import {
  DAILY_SEND_TARGET,
  LAHORE_DAILY_SEND_TARGET,
  PROCESS_BATCH_PER_RUN,
  REMOTE_DAILY_SEND_TARGET,
  SEND_BATCH_PER_RUN,
} from "@/lib/constants";
import { formatCompanyWithPlace } from "@/lib/format";
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
    status: { $in: ["sent", "ready"] },
    jobId: job._id,
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


export async function sentTodayCount() {
  return Application.countDocuments({
    status: { $in: ["sent", "ready"] },
    createdAt: { $gte: startOfPakistanDay() },
  });
}

async function releaseStuckReservations() {
  await Application.updateMany(
    {
      status: "ready",
      reason: "Reserved so this company is not emailed twice.",
      createdAt: { $lt: new Date(Date.now() - 2 * 60 * 1000) },
    },
    {
      $set: {
        status: "failed",
        reason: "Send did not finish. Reservation released so another company can be emailed.",
      },
    },
  );
}

export async function sentTodayLocationCounts(settings: UserSettings) {
  const apps = await Application.find({
    status: { $in: ["sent", "ready"] },
    createdAt: { $gte: startOfPakistanDay() },
  }).select("jobId");
  if (!apps.length) return { lahore: 0, remote: 0 };
  const jobs = await Job.find({ _id: { $in: apps.map((item) => item.jobId) } });
  return jobs.reduce(
    (counts, job) => {
      const locationClass = classifyLocation(job, settings).class;
      if (locationClass === "lahore-onsite" || locationClass === "lahore-remote") counts.lahore += 1;
      if (locationClass === "remote-worldwide") counts.remote += 1;
      return counts;
    },
    { lahore: 0, remote: 0 },
  );
}

export async function sentTodayLahoreCount(settings: UserSettings) {
  return (await sentTodayLocationCounts(settings)).lahore;
}

export async function sentTodayRemoteCount(settings: UserSettings) {
  return (await sentTodayLocationCounts(settings)).remote;
}

function isLahoreJob(job: { title: string; company: string; location?: string; description: string; tags?: string[]; source?: string }, settings: UserSettings) {
  const locationClass = classifyLocation(job, settings).class;
  return locationClass === "lahore-onsite" || locationClass === "lahore-remote";
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
    const job = await Job.findById(input.jobId).select("company title location");
    input.companyName = input.companyName || formatCompanyWithPlace(job?.company, job?.location);
    input.jobTitle = input.jobTitle || job?.title;
  }
  return Application.create(input);
}

export async function processJob(
  jobId: string,
  settings: UserSettings,
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
  if (!recency.recent && job.source !== "pakistan-houses" && job.source !== "remote-houses") {
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

  if (job.source === "pakistan-houses" || job.source === "remote-houses") {
    score = Math.max(score, 80);
    relevant = true;
    if (!matchedSkills.length) matchedSkills = settings.skills.slice(0, 5);
    reason =
      job.source === "pakistan-houses"
        ? "Lahore software-house full-stack application."
        : "Remote company-site full-stack application.";
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

  if (await alreadyApproachedCompany({ company: job.company, cooldownDays: settings.cooldownDays || 14 })) {
    job.status = "processed";
    await job.save();
    await logDecision({
      jobId: job._id,
      matchId: match._id,
      status: "duplicate",
      reason: "This company was already approached. One company gets one CV.",
    });
    return { status: "duplicate", score, reason: "Company already approached." };
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
  const buckets = await sentTodayLocationCounts(settings);
  if (isLahore && buckets.lahore >= LAHORE_DAILY_SEND_TARGET) {
    job.status = "matched";
    await job.save();
    await logDecision({
      jobId: job._id,
      matchId: match._id,
      status: "skipped",
      reason: `Daily Lahore cap of ${LAHORE_DAILY_SEND_TARGET} reached.`,
    });
    return { status: "skipped", score, reason: "Daily Lahore cap reached." };
  }
  if (!isLahore && buckets.remote >= REMOTE_DAILY_SEND_TARGET) {
    job.status = "matched";
    await job.save();
    await logDecision({
      jobId: job._id,
      matchId: match._id,
      status: "skipped",
      reason: `Daily worldwide-remote cap of ${REMOTE_DAILY_SEND_TARGET} reached.`,
    });
    return { status: "skipped", score, reason: "Daily worldwide-remote cap reached." };
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
  const attachment = resolveCvAttachment(cv);
  if (!attachment) {
    job.status = "matched";
    await job.save();
    await logDecision({
      jobId: job._id,
      matchId: match._id,
      cvId: mongoCvId(cv),
      status: "skipped",
      reason: "CV file is missing, so the email was not sent.",
    });
    return { status: "skipped", score, reason: "CV file is missing, so the email was not sent." };
  }

  const email = generateApplicationEmail({
    settings,
    job,
    matchedSkills,
  });
  const to = hiringEmail;

  if (await alreadyApproachedCompany({ company: job.company, email: to, cooldownDays: settings.cooldownDays || 14 })) {
    job.status = "processed";
    await job.save();
    await logDecision({
      jobId: job._id,
      matchId: match._id,
      status: "duplicate",
      reason: "This company or hiring email was already approached.",
    });
    return { status: "duplicate", score, reason: "Company or email already approached." };
  }

  if (!claimInFlight(job.company, to)) {
    job.status = "processed";
    await job.save();
    await logDecision({
      jobId: job._id,
      matchId: match._id,
      status: "duplicate",
      reason: "A send to this company is already in progress.",
    });
    return { status: "duplicate", score, reason: "Company send already in progress." };
  }

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
    releaseInFlight(job.company, to);
    return { status: "ready", score, reason: "Prepared without sending." };
  }

  let reservation: Awaited<ReturnType<typeof logDecision>> | undefined;
  try {
    reservation = await logDecision({
      jobId: job._id,
      matchId: match._id,
      cvId: mongoCvId(cv),
      status: "ready",
      emailTo: to,
      emailSubject: email.subject,
      emailBody: email.body,
      reason: "Reserved so this company is not emailed twice.",
    });

    const result = await sendApplicationEmail({
      to,
      subject: email.subject,
      body: email.body,
      replyTo: settings.applicantEmail || undefined,
      attachment,
      settings,
    });

    const status: ApplicationStatus = result.sent ? "sent" : "ready";
    job.status = result.sent ? "sent" : "matched";
    await job.save();
    reservation.status = status;
    reservation.reason = result.sent ? "Email sent." : result.error;
    await reservation.save();
    await EmailLog.create({
      applicationId: reservation._id,
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
    if (reservation) {
      reservation.status = "failed";
      reservation.reason = message;
      await reservation.save();
    } else {
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
    }
    return { status: "failed", score, reason: message };
  } finally {
    releaseInFlight(job.company, to);
  }
}

type PipelineProgress = {
  sentThisRun: number;
  sentThisRunLahore: number;
  sentThisRunRemote: number;
  sendBatch: number;
  dailyTarget: number;
};

async function dailyTargetReached(progress: PipelineProgress) {
  if (progress.sentThisRun >= progress.sendBatch) return true;
  return (await sentTodayCount()) >= progress.dailyTarget;
}

function waveBucketFull(progress: PipelineProgress, isLahore: boolean) {
  const lahoreWave = Math.ceil(progress.sendBatch / 2);
  const remoteWave = Math.floor(progress.sendBatch / 2);
  return isLahore ? progress.sentThisRunLahore >= lahoreWave : progress.sentThisRunRemote >= remoteWave;
}

function countSuccessfulSend(progress: PipelineProgress, status: string, isLahore: boolean) {
  if (status !== "sent" && status !== "ready") return;
  progress.sentThisRun += 1;
  if (isLahore) progress.sentThisRunLahore += 1;
  else progress.sentThisRunRemote += 1;
}

export async function runPipeline(options?: {
  ingest?: boolean;
  ingestHouses?: boolean;
  limit?: number;
  sendBatch?: number;
}) {
  if (!acquireLocalPipelineLock()) {
    return {
      processed: 0,
      smtpReady: false,
      aiReady: Boolean(process.env.AI_API_KEY),
      sentToday: await sentTodayCount(),
      skipped: "Pipeline already running. Duplicate send blocked.",
      results: [],
    };
  }

  let mongoLocked = false;
  try {
  const { settings } = await getOrCreateSettings();
  mongoLocked = await acquireMongoPipelineLock();
  if (!mongoLocked) {
    return {
      processed: 0,
      smtpReady: smtpConfigured(settings),
      aiReady: Boolean(process.env.AI_API_KEY),
      sentToday: await sentTodayCount(),
      skipped: "Another pipeline is already sending. Duplicate company mail blocked.",
      results: [],
    };
  }
  const results: Array<{ jobId: string; status: string; score?: number; reason?: string }> = [];
  await releaseStuckReservations();
  const progress: PipelineProgress = {
    sentThisRun: 0,
    sentThisRunLahore: 0,
    sentThisRunRemote: 0,
    sendBatch: options?.sendBatch || SEND_BATCH_PER_RUN,
    dailyTarget: settings.dailySendLimit || DAILY_SEND_TARGET,
  };
  const processLimit = options?.limit || PROCESS_BATCH_PER_RUN;

  await processFreshJobs(settings, results, processLimit, progress);
  if (!(await dailyTargetReached(progress))) {
    await ensureDailyQuotas(settings, results, progress);
  }

  if (options?.ingest !== false) {
    const { fetchRemoteOkJobs } = await import("@/lib/ingest/remoteok");
    const { fetchPublicBoardJobs } = await import("@/lib/ingest/publicBoards");
    try {
      const { fetchPakistanJobs } = await import("@/lib/ingest/pakistanJobs");
      const { fetchAggregatorJobs } = await import("@/lib/ingest/aggregators");
      const incoming = [
        ...(await fetchPakistanJobs(options?.limit || 20)),
        ...(await fetchAggregatorJobs(options?.limit || 15)),
        ...(await fetchRemoteOkJobs(options?.limit || 15)),
        ...(await fetchPublicBoardJobs(options?.limit || 15)),
      ];
      if (options?.ingestHouses !== false) {
        const { fetchPakistanSoftwareHouses } = await import("@/lib/ingest/pakistanHouses");
        const { fetchRemoteSoftwareHouses } = await import("@/lib/ingest/remoteHouses");
        incoming.unshift(...(await fetchPakistanSoftwareHouses()), ...(await fetchRemoteSoftwareHouses()));
      }
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

    if (!(await dailyTargetReached(progress))) {
      await processFreshJobs(settings, results, processLimit, progress);
      if (!(await dailyTargetReached(progress))) {
        await ensureDailyQuotas(settings, results, progress);
      }
    }
  }

  const locationCounts = await sentTodayLocationCounts(settings);
  return {
    processed: results.length,
    smtpReady: smtpConfigured(settings),
    aiReady: Boolean(process.env.AI_API_KEY),
    sentToday: await sentTodayCount(),
    lahoreToday: locationCounts.lahore,
    remoteToday: locationCounts.remote,
    dailyTarget: progress.dailyTarget,
    sentThisRun: progress.sentThisRun,
    lahoreTarget: LAHORE_DAILY_SEND_TARGET,
    remoteTarget: REMOTE_DAILY_SEND_TARGET,
    results,
  };
  } finally {
    if (mongoLocked) await releaseMongoPipelineLock();
    releaseLocalPipelineLock();
  }
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

async function processFreshJobs(
  settings: UserSettings,
  results: Array<{ jobId: string; status: string; score?: number; reason?: string }>,
  limit: number,
  progress: PipelineProgress,
) {
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
    .slice(0, limit);
  for (const job of jobs) {
    if (await dailyTargetReached(progress)) break;
    const lahoreJob = isLahoreJob(job, settings);
    if (waveBucketFull(progress, lahoreJob)) continue;
    try {
      const result = await processJob(String(job._id), settings);
      countSuccessfulSend(progress, result.status, lahoreJob);
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
}

async function ensureDailyQuotas(
  settings: UserSettings,
  results: Array<{ jobId: string; status: string; score?: number; reason?: string }>,
  progress: PipelineProgress,
) {
  const houseJobs = await Job.find({
    source: { $in: ["pakistan-houses", "remote-houses"] },
    status: { $in: ["new", "matched", "processed"] },
  }).limit(60);
  const lahoreFirst = [...houseJobs].sort((left, right) => {
    const leftLahore = left.source === "pakistan-houses" ? 0 : 1;
    const rightLahore = right.source === "pakistan-houses" ? 0 : 1;
    return leftLahore - rightLahore;
  });

  for (const job of lahoreFirst) {
    if (await dailyTargetReached(progress)) break;
    const lahoreJob = isLahoreJob(job, settings);
    if (waveBucketFull(progress, lahoreJob)) continue;
    const buckets = await sentTodayLocationCounts(settings);
    if (lahoreJob && buckets.lahore >= LAHORE_DAILY_SEND_TARGET) continue;
    if (!lahoreJob && buckets.remote >= REMOTE_DAILY_SEND_TARGET) continue;
    const lahoreNeeded = Math.max(0, LAHORE_DAILY_SEND_TARGET - buckets.lahore);
    if (!lahoreJob && progress.dailyTarget - buckets.lahore - buckets.remote <= lahoreNeeded) continue;
    try {
      const result = await processJob(String(job._id), settings);
      countSuccessfulSend(progress, result.status, lahoreJob);
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
