import { createHash } from "crypto";
import Scan from "../models/scan.js";
import ScanSchedule from "../models/scanSchedule.js";
import normalizeUrl from "../utils/normalizeUrl.js";

export const DEFAULT_MAX_ATTEMPTS = 3;
export const LEASE_DURATION_MS = 2 * 60 * 1000;

function scheduledScanId(scheduleId, scheduledFor) {
  const hex = createHash("sha256")
    .update(`${scheduleId}:${scheduledFor.toISOString()}`)
    .digest("hex")
    .slice(0, 32)
    .split("");
  hex[12] = "5";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export async function recoverExpiredJobs(now = new Date()) {
  const staleJobs = await Scan.find({
    status: "running",
    $or: [{ leaseExpiresAt: { $lte: now } }, { leaseExpiresAt: { $exists: false } }]
  })
    .select("scanId attempts maxAttempts leaseExpiresAt")
    .lean();

  for (const job of staleJobs) {
    const hasAttempts = Number.isFinite(job.attempts);
    const attempts = hasAttempts ? job.attempts : 1;
    const maxAttempts = job.maxAttempts || DEFAULT_MAX_ATTEMPTS;
    const shouldRetry = attempts < maxAttempts;
    const leaseCondition = job.leaseExpiresAt
      ? { leaseExpiresAt: job.leaseExpiresAt }
      : { leaseExpiresAt: { $exists: false } };

    await Scan.updateOne(
      { scanId: job.scanId, status: "running", ...leaseCondition },
      {
        $set: {
          status: shouldRetry ? "queued" : "failed",
          phase: shouldRetry ? "waiting" : "unknown",
          errorType: "WORKER_INTERRUPTED",
          error: "The worker stopped before the scan finished.",
          userMessage: shouldRetry
            ? "The scan was interrupted and will be retried."
            : "The scan was interrupted too many times and could not be completed.",
          ...(shouldRetry ? { nextAttemptAt: now } : { "timings.finishedAt": now })
        },
        $unset: { workerId: 1, leaseExpiresAt: 1 }
      }
    );
  }

  if (staleJobs.length) {
    console.log(`Recovered ${staleJobs.length} interrupted scan(s).`);
  }
}

export async function claimNextJob(workerId, now = new Date()) {
  return Scan.findOneAndUpdate(
    {
      status: "queued",
      $or: [{ nextAttemptAt: { $exists: false } }, { nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }]
    },
    {
      $set: {
        status: "running",
        phase: "navigation",
        workerId,
        leaseExpiresAt: new Date(now.getTime() + LEASE_DURATION_MS),
        "timings.startedAt": now
      },
      $inc: { attempts: 1 },
      $unset: { nextAttemptAt: 1, error: 1, errorType: 1, userMessage: 1 }
    },
    { sort: { "timings.createdAt": 1 }, new: true }
  );
}

export async function enqueueDueSchedule(now = new Date()) {
  const schedule = await ScanSchedule.findOne({ active: true, nextRunAt: { $lte: now } })
    .sort({ nextRunAt: 1 })
    .lean();

  if (!schedule) return false;

  const scheduledFor = schedule.nextRunAt;
  if (schedule.endsAt && schedule.endsAt <= now) {
    await ScanSchedule.updateOne(
      { scheduleId: schedule.scheduleId, active: true, nextRunAt: scheduledFor },
      { $set: { active: false, completedAt: now } }
    );
    console.log(`Expired scheduled scans ${schedule.scheduleId} after its end date.`);
    return true;
  }

  const scanId = scheduledScanId(schedule.scheduleId, scheduledFor);
  try {
    await Scan.updateOne(
      { scanId },
      {
        $setOnInsert: {
          scanId,
          url: schedule.url,
          urlNormalized: normalizeUrl(schedule.url),
          status: "queued",
          phase: "waiting",
          attempts: 0,
          maxAttempts: DEFAULT_MAX_ATTEMPTS,
          scanProfile: schedule.scanProfile,
          timings: { createdAt: now },
          scheduleId: schedule.scheduleId,
          scheduledFor
        }
      },
      { upsert: true }
    );
  } catch (error) {
    // A second worker may have inserted the same occurrence concurrently.
    if (error?.code !== 11000) throw error;
  }

  if (schedule.scheduleType === "once") {
    await ScanSchedule.updateOne(
      { scheduleId: schedule.scheduleId, active: true, nextRunAt: scheduledFor },
      { $set: { active: false, lastEnqueuedAt: scheduledFor, completedAt: now } }
    );
    console.log(`Queued one-time scheduled scan ${schedule.scheduleId} for ${schedule.url}`);
    return true;
  }

  const intervalMs = schedule.intervalHours * 60 * 60 * 1000;
  const missedIntervals = Math.max(1, Math.floor((now.getTime() - scheduledFor.getTime()) / intervalMs) + 1);
  const nextRunAt = new Date(scheduledFor.getTime() + missedIntervals * intervalMs);
  const shouldComplete = schedule.endsAt && nextRunAt > schedule.endsAt;

  await ScanSchedule.updateOne(
    { scheduleId: schedule.scheduleId, active: true, nextRunAt: scheduledFor },
    {
      $set: shouldComplete
        ? { active: false, lastEnqueuedAt: scheduledFor, completedAt: now }
        : { nextRunAt, lastEnqueuedAt: scheduledFor }
    }
  );

  console.log(`Queued scheduled scan ${schedule.scheduleId} for ${schedule.url}${shouldComplete ? " (schedule complete)" : ""}`);
  return true;
}
