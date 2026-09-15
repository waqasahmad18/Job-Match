import { getMasterCv, resolveCvAttachment } from "@/lib/cvStore";
import { extractApplyEmailFromListing, fallbackApplyEmail } from "@/lib/extractEmail";
import { syncGmailBounces } from "@/lib/gmailBounces";
import { loadBouncedEmails, pickDeliverableEmail } from "@/lib/verifyEmail";
import { generateApplicationEmail, sendApplicationEmail, smtpConfigured } from "@/lib/email";
import { analyzeJobWithAi } from "@/lib/matching/ai";
import { evaluateHardReject } from "@/lib/matching/exclusions";
import { classifyLocation, evaluateLocationPolicy } from "@/lib/matching/location";
import { evaluateJobRecency } from "@/lib/matching/recency";
import { evaluateMinimumSalary } from "@/lib/matching/salary";
import { scoreJobByKeywords } from "@/lib/matching/keywordScore";
import {
  alreadyApproachedCompany,
  alreadySkippedNoEmailToday,
  acquireLocalPipelineLock,
  acquireMongoPipelineLock,
  claimInFlight,
  releaseInFlight,
  releaseLocalPipelineLock,
  releaseMongoPipelineLock,
} from "@/lib/companyLock";
import {
  CAREERS_PAGE_ONLY_COMPANIES,
  DAILY_SEND_TARGET,
  LAHORE_DAILY_SEND_TARGET,
  PROCESS_BATCH_PER_RUN,
  REMOTE_DAILY_SEND_TARGET,
  SEND_BATCH_PER_RUN,
} from "@/lib/constants";
import { formatCompanyWithPlace } from "@/lib/format";
import { normalizeCompany } from "@/lib/companyLock";
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
    emailTo: { $exists: true, $nin: [null, ""] },
    createdAt: { $gte: startOfPakistanDay() },
  });
}

function isCareersPageOnly(company: string) {
  const name = normalizeCompany(company);
  return CAREERS_PAGE_ONLY_COMPANIES.some((item) => normalizeCompany(item) === name);
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
  applyUrl?: string;
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
  } else if (
    classifyLocation(job, settings).class === "remote-worldwide" &&
    /full\s*stack|software (engineer|developer)|react|next\.?js|node\.?js|mern/i.test(job.title)
  ) {
    score = Math.max(score, 78);
    relevant = true;
    reason = `${reason} Remote software role boosted for worldwide quota.`;
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

  if (await alreadySkippedNoEmailToday(job.company) && job.source !== "remote-houses" && job.source !== "pakistan-houses") {
    job.status = "processed";
    await job.save();
    return { status: "skipped", score, reason: "Already checked today — no hiring email on careers page." };
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

  const cvs = await CvVersion.find();
  const cv = selectCvVersion(job, cvs) || getMasterCv();
  const attachment = resolveCvAttachment(cv);
  const email = generateApplicationEmail({
    settings,
    job,
    matchedSkills,
  });

  async function applyOnCareersForm() {
    if (!attachment || !job.sourceUrl?.startsWith("http")) return null;
    const source = String(job.source || "");
    const { remoteHouseAts } = await import("@/lib/ingest/remoteHouses");
    const { pakistanHouseAts } = await import("@/lib/ingest/pakistanHouses");
    const preferredAts =
      source === "remote-houses"
        ? remoteHouseAts(job.company)
        : source === "pakistan-houses"
          ? pakistanHouseAts(job.company)
          : null;
    if (
      source !== "pakistan-houses" &&
      source !== "remote-houses" &&
      source !== "jsearch" &&
      !preferredAts &&
      !/greenhouse|lever\.co|ashbyhq/i.test(job.sourceUrl)
    ) {
      return { ok: false as const, error: "Skip careers form for board listings." };
    }
    const { applyOnCareersBoard } = await import("@/lib/careersApply");
    const board = await applyOnCareersBoard({
      sourceUrl: job.sourceUrl,
      settings,
      cvPath: attachment.path,
      cvFileName: attachment.filename,
      coverLetter: email.body,
      preferredAts,
    });
    if (!board.ok) return board;
    job.status = "sent";
    await job.save();
    await logDecision({
      jobId: job._id,
      matchId: match._id,
      cvId: mongoCvId(cv),
      status: "sent",
      emailTo: `careers-form@${board.via}.io`,
      emailSubject: email.subject,
      emailBody: email.body,
      applyUrl: board.jobUrl || job.sourceUrl,
      reason: `CV submitted on the ${board.via} careers page.`,
    });
    return board;
  }

  // Lahore + worldwide houses: try ATS form before requiring a mailbox.
  if (job.source === "remote-houses" || job.source === "pakistan-houses") {
    const board = await applyOnCareersForm();
    if (board?.ok) return { status: "sent", score, reason: "CV submitted on the careers page." };
  }

  if (isCareersPageOnly(job.company) && job.sourceUrl?.startsWith("http")) {
    const board = await applyOnCareersForm();
    if (board?.ok) return { status: "sent", score, reason: "CV submitted on the careers page." };
    job.status = "matched";
    await job.save();
    await logDecision({
      jobId: job._id,
      matchId: match._id,
      status: "ready",
      applyUrl: job.sourceUrl,
      reason: "This company asks applicants to apply on the careers page, not by unsolicited email.",
    });
    return { status: "ready", score, reason: "Apply on the company careers page." };
  }

  const bounced = await loadBouncedEmails();
  const skip = [settings.applicantEmail, ...bounced];
  const { pakistanHouseEmail } = await import("@/lib/ingest/pakistanHouses");
  const curated = job.source === "pakistan-houses" ? pakistanHouseEmail(job.company) : "";
  const extracted = await extractApplyEmailFromListing(job, skip);
  const fallback = fallbackApplyEmail(job.sourceUrl, skip);
  const hiringEmail = await pickDeliverableEmail([extracted, curated, fallback], bounced);
  if (!hiringEmail) {
    const board = await applyOnCareersForm();
    if (board?.ok) return { status: "sent", score, reason: "CV submitted on the careers page." };
    job.status = "processed";
    await job.save();
    await logDecision({
      jobId: job._id,
      matchId: match._id,
      status: "skipped",
      applyUrl: job.sourceUrl?.startsWith("http") ? job.sourceUrl : undefined,
      reason: "No confirmed hiring email. Careers form was not Greenhouse/Lever.",
    });
    return { status: "skipped", score, reason: "No confirmed hiring email." };
  }

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
      applyUrl: job.sourceUrl?.startsWith("http") ? job.sourceUrl : undefined,
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
  syncBounces?: boolean;
  source?: string;
}) {
  if (!acquireLocalPipelineLock()) {
    return {
      processed: 0,
      smtpReady: false,
      aiReady: Boolean(process.env.AI_API_KEY),
      sentToday: await sentTodayCount(),
      skipped: "Pipeline already running. Duplicate send blocked.",
      ingested: 0,
      ingestedKept: 0,
      ingestedNew: 0,
      ingestedDropped: 0,
      results: [],
    };
  }

  const deadline = Date.now() + 50_000;
  let mongoLocked = false;
  try {
  const { settings } = await getOrCreateSettings();
  mongoLocked = await acquireMongoPipelineLock();
  if (!mongoLocked) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    mongoLocked = await acquireMongoPipelineLock();
  }
  if (!mongoLocked) {
    return {
      processed: 0,
      smtpReady: smtpConfigured(settings),
      aiReady: Boolean(process.env.AI_API_KEY),
      sentToday: await sentTodayCount(),
      skipped: "Another pipeline is already sending. Duplicate company mail blocked.",
      ingested: 0,
      ingestedKept: 0,
      ingestedNew: 0,
      ingestedDropped: 0,
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
  let ingestStats = { fetched: 0, kept: 0, inserted: 0, dropped: 0, errors: [] as string[] };

  if (options?.ingest !== false) {
    try {
      const { collectIncomingJobs } = await import("@/lib/ingest/collect");
      const collected = await collectIncomingJobs(settings, {
        ingestHouses: options?.ingestHouses === true,
        limit: options?.limit || 25,
      });
      ingestStats = {
        fetched: collected.fetched,
        kept: collected.kept,
        inserted: 0,
        dropped: collected.dropped,
        errors: collected.errors,
      };

      // Fast path for seeded houses: one query for existing fingerprints, insert only new ones.
      const houseJobs = collected.jobs.filter(
        (job) => job.source === "pakistan-houses" || job.source === "remote-houses",
      );
      const boardJobs = collected.jobs.filter(
        (job) => job.source !== "pakistan-houses" && job.source !== "remote-houses",
      );
      const existingHouse = await Job.find({
        source: { $in: ["pakistan-houses", "remote-houses"] },
      })
        .select("fingerprint status description")
        .lean();
      const houseByFp = new Map(existingHouse.map((row) => [row.fingerprint, row]));
      const toInsert: typeof houseJobs = [];
      for (const job of houseJobs) {
        const prev = houseByFp.get(job.fingerprint);
        if (!prev) {
          toInsert.push(job);
          continue;
        }
        const hasNewEmail = /Apply email:\s*[a-z0-9._%+-]+@/i.test(job.description || "");
        const hadEmail = /Apply email:\s*[a-z0-9._%+-]+@/i.test(String(prev.description || ""));
        if (hasNewEmail && !hadEmail && prev.status !== "sent") {
          await Job.updateOne(
            { fingerprint: job.fingerprint },
            {
              $set: {
                description: job.description,
                status: prev.status === "processed" || prev.status === "rejected" ? "matched" : prev.status,
              },
            },
          );
        }
      }
      if (toInsert.length) {
        try {
          await Job.insertMany(toInsert, { ordered: false });
          ingestStats.inserted += toInsert.length;
        } catch {
          for (const job of toInsert) {
            const outcome = await upsertIncomingJob(job);
            if (outcome === "inserted") ingestStats.inserted += 1;
          }
        }
      }
      for (const job of boardJobs) {
        if (Date.now() > deadline - 32_000) break;
        const outcome = await upsertIncomingJob(job);
        if (outcome === "inserted") ingestStats.inserted += 1;
      }
    } catch (error) {
      await SystemLog.create({
        level: "error",
        message: "Job ingestion failed",
        context: { error: error instanceof Error ? error.message : String(error) },
      });
      ingestStats.errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  await processFreshJobs(settings, results, processLimit, progress, deadline);
  if (!(await dailyTargetReached(progress)) && Date.now() < deadline) {
    await ensureDailyQuotas(settings, results, progress, deadline);
  }

  const bounces =
    options?.syncBounces === false || Date.now() > deadline - 8_000
      ? { checked: false, bounced: 0, released: 0 }
      : await syncGmailBounces().catch(() => ({
          checked: false,
          bounced: 0,
          released: 0,
        }));

  const locationCounts = await sentTodayLocationCounts(settings);
  const payload = {
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
    ingested: ingestStats.fetched,
    ingestedKept: ingestStats.kept,
    ingestedNew: ingestStats.inserted,
    ingestedDropped: ingestStats.dropped,
    ingestErrors: ingestStats.errors,
    bounces,
    results,
  };
  await SystemLog.create({
    level: "info",
    message: "Hunt run completed",
    context: {
      source: options?.source || "pipeline",
      processed: payload.processed,
      sentToday: payload.sentToday,
      sentThisRun: payload.sentThisRun,
      ingestedNew: payload.ingestedNew,
      ingestedKept: payload.ingestedKept,
    },
  }).catch(() => undefined);
  return payload;
  } finally {
    if (mongoLocked) await releaseMongoPipelineLock();
    releaseLocalPipelineLock();
  }
}

async function upsertIncomingJob(
  job: Record<string, unknown> & {
    fingerprint: string;
    description?: string;
    location?: string;
    postedAt?: Date;
    source?: string;
  },
) {
  const existing = await Job.findOne({ fingerprint: job.fingerprint });
  if (!existing) {
    await Job.create(job);
    return "inserted" as const;
  }
  if (existing.status === "sent") return "skipped" as const;

  const houseSeed = job.source === "pakistan-houses" || job.source === "remote-houses";
  existing.description = String(job.description || existing.description);
  existing.location = String(job.location || existing.location);
  if (job.postedAt) existing.postedAt = job.postedAt;

  if (existing.status === "rejected") {
    await existing.save();
    return "skipped" as const;
  }

  // Re-open houses that were closed only because no email was found, so curated emails / ATS can retry.
  if (houseSeed && existing.status === "processed") {
    existing.status = "matched";
  } else if (existing.status === "processed") {
    await existing.save();
    return "skipped" as const;
  }

  if (!houseSeed) existing.collectedAt = new Date();
  await existing.save();
  return "updated" as const;
}

function interleaveJobs<T>(lahore: T[], remote: T[]) {
  const out: T[] = [];
  const max = Math.max(lahore.length, remote.length);
  for (let i = 0; i < max; i += 1) {
    if (i < remote.length) out.push(remote[i]);
    if (i < lahore.length) out.push(lahore[i]);
  }
  return out;
}

async function processFreshJobs(
  settings: UserSettings,
  results: Array<{ jobId: string; status: string; score?: number; reason?: string }>,
  limit: number,
  progress: PipelineProgress,
  deadline = Date.now() + 52_000,
) {
  const fresh = await Job.find({ status: { $in: ["new", "matched"] } }).limit(400);
  const allowed = [...fresh]
    .filter((job) => classifyLocation(job, settings).allowed)
    .sort((left, right) => {
      const leftTime = new Date(left.postedAt || left.collectedAt || 0).getTime();
      const rightTime = new Date(right.postedAt || right.collectedAt || 0).getTime();
      return rightTime - leftTime;
    });
  const lahore = allowed.filter((job) => isLahoreJob(job, settings));
  const remote = allowed.filter((job) => !isLahoreJob(job, settings));
  const jobs = interleaveJobs(lahore, remote).slice(0, Math.max(limit, 40));

  for (const job of jobs) {
    if (Date.now() >= deadline) break;
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
  deadline = Date.now() + 52_000,
) {
  const houseJobs = await Job.find({
    source: { $in: ["pakistan-houses", "remote-houses"] },
    status: { $in: ["new", "matched"] },
  }).limit(80);
  const lahore = houseJobs.filter((job) => job.source === "pakistan-houses");
  const remote = houseJobs.filter((job) => job.source === "remote-houses");
  const ordered = interleaveJobs(lahore, remote);

  for (const job of ordered) {
    if (Date.now() >= deadline) break;
    if (await dailyTargetReached(progress)) break;
    const lahoreJob = isLahoreJob(job, settings);
    if (waveBucketFull(progress, lahoreJob)) continue;
    const buckets = await sentTodayLocationCounts(settings);
    if (lahoreJob && buckets.lahore >= LAHORE_DAILY_SEND_TARGET) continue;
    if (!lahoreJob && buckets.remote >= REMOTE_DAILY_SEND_TARGET) continue;
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
