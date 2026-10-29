import express from "express";
import { randomUUID } from "crypto";
import ScanSchedule from "../models/scanSchedule.js";
import { resolveScanProfile } from "../config/scanProfiles.js";

const router = express.Router();

const asyncRoute = (handler) => (req, res) =>
  Promise.resolve(handler(req, res)).catch((error) => {
    console.error("Scheduled scan request failed:", error);
    if (!res.headersSent) res.status(500).json({ error: "Unable to process scheduled scan request." });
  });

function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

router.get("/schedules", asyncRoute(async (req, res) => {
  const schedules = await ScanSchedule.find({ ownerId: req.user.id })
    .sort({ nextRunAt: 1 })
    .lean();
  res.json({ schedules });
}));

router.post("/schedules", asyncRoute(async (req, res) => {
  const url = typeof req.body?.url === "string" ? req.body.url.trim() : "";
  if (req.body?.scheduleType && !["once", "recurring"].includes(req.body.scheduleType)) {
    return res.status(400).json({ error: "scheduleType must be once or recurring." });
  }
  const scheduleType = req.body?.scheduleType === "once" ? "once" : "recurring";
  const intervalHours = Number(req.body?.intervalHours);
  const startsAt = new Date(req.body?.startsAt);
  const endsAt = req.body?.endsAt ? new Date(req.body.endsAt) : null;

  if (!isValidUrl(url)) {
    return res.status(400).json({ error: "A valid HTTP or HTTPS URL is required." });
  }
  if (scheduleType === "recurring" && (!Number.isInteger(intervalHours) || intervalHours < 1 || intervalHours > 720)) {
    return res.status(400).json({ error: "intervalHours must be an integer from 1 to 720." });
  }
  if (!Number.isFinite(startsAt.getTime()) || startsAt.getTime() < Date.now() + 60_000) {
    return res.status(400).json({ error: "startsAt must be at least one minute in the future." });
  }
  if (endsAt && (!Number.isFinite(endsAt.getTime()) || endsAt <= startsAt)) {
    return res.status(400).json({ error: "endsAt must be after the first scheduled run." });
  }
  if (scheduleType === "once" && endsAt) {
    return res.status(400).json({ error: "A one-time scan does not use an end date." });
  }

  const schedule = await ScanSchedule.create({
    scheduleId: randomUUID(),
    ownerId: req.user.id,
    url,
    scanProfile: resolveScanProfile(req.body?.sector),
    scheduleType,
    intervalHours: scheduleType === "recurring" ? intervalHours : undefined,
    nextRunAt: startsAt,
    endsAt
  });

  res.status(201).json({ schedule });
}));

router.patch("/schedules/:scheduleId", asyncRoute(async (req, res) => {
  if (typeof req.body?.active !== "boolean") {
    return res.status(400).json({ error: "active must be true or false." });
  }

  const current = await ScanSchedule.findOne({ scheduleId: req.params.scheduleId, ownerId: req.user.id });
  if (!current) return res.status(404).json({ error: "Schedule not found." });
  if (req.body.active && (current.completedAt || (current.endsAt && current.endsAt <= new Date()))) {
    return res.status(409).json({ error: "This schedule has ended and cannot be resumed." });
  }

  const schedule = await ScanSchedule.findOneAndUpdate(
    { scheduleId: req.params.scheduleId, ownerId: req.user.id },
    { $set: { active: req.body.active } },
    { new: true }
  ).lean();

  if (!schedule) return res.status(404).json({ error: "Schedule not found." });
  res.json({ schedule });
}));

router.delete("/schedules/:scheduleId", asyncRoute(async (req, res) => {
  const schedule = await ScanSchedule.findOneAndDelete({
    scheduleId: req.params.scheduleId,
    ownerId: req.user.id
  });

  if (!schedule) return res.status(404).json({ error: "Schedule not found." });
  res.json({ message: "Schedule deleted." });
}));

export default router;
