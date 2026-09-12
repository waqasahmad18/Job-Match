export const RECENT_JOB_MAX_DAYS = Number(process.env.RECENT_JOB_MAX_DAYS || 14);

export function evaluateJobRecency(job: { postedAt?: Date | string; collectedAt?: Date | string }) {
  const stamp = job.postedAt || job.collectedAt;
  if (!stamp) {
    return { recent: true, ageDays: 0, reason: "No post date; treating as a newly collected listing." };
  }

  const ageMs = Date.now() - new Date(stamp).getTime();
  const ageDays = Math.max(0, Math.floor(ageMs / 86_400_000));
  if (ageDays > RECENT_JOB_MAX_DAYS) {
    return {
      recent: false,
      ageDays,
      reason: `Skipped older posting (${ageDays} days). Only last ${RECENT_JOB_MAX_DAYS} days are applied.`,
    };
  }

  return {
    recent: true,
    ageDays,
    reason: ageDays === 0 ? "Posted today." : `Posted ${ageDays} day(s) ago.`,
  };
}
