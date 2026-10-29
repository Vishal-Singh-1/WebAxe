import mongoose from "mongoose";
import normalizeUrl from "../utils/normalizeUrl.js";

const ScanSchema = new mongoose.Schema(
  {
    scanId: { type: String, required: true, unique: true },
    url: String,
    /** Canonical form of url for querying scan history per site */
    urlNormalized: { type: String, index: true },
    status: String,
    phase: String,
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    nextAttemptAt: Date,
    workerId: String,
    leaseExpiresAt: Date,
    scheduleId: String,
    scheduledFor: Date,

    scanProfile: {
      key: { type: String, default: "general" },
      label: { type: String, default: "General website" },
      weights: { type: Object, default: {} }
    },

    error: String,
    errorType: String,
    userMessage: String,

    /* ===== NEW WEEK 3 STRUCTURED SUMMARY ===== */
    summary: {
      critical: { type: Number, default: 0 },
      warning: { type: Number, default: 0 },
      info: { type: Number, default: 0 },
      total: { type: Number, default: 0 }
    },

    /* ===== STRUCTURED ISSUES ===== */
    issues: {
      type: Object, // stores { CRITICAL: [], WARNING: [], INFO: [] }
      default: {}
    },

    audit: {
      overallScore: Number,
      categories: { type: Object, default: {} },
      ruleResults: { type: Array, default: [] },
      trustIndicators: { type: Array, default: [] },
      stats: { type: Object, default: {} },
      evidence: { type: Object, default: {} }
    },

    /* ===== ARTIFACTS ===== */
    artifacts: {
      rawReportPath: String,
      screenshotPath: String
    },

    /* ===== TIMINGS ===== */
    timings: {
      createdAt: { type: Date, default: Date.now },
      startedAt: Date,
      finishedAt: Date,
      durationMs: Number
    }
  },
  {
    strict: true // only defined fields allowed
  }
);

ScanSchema.index(
  { scheduleId: 1, scheduledFor: 1 },
  {
    unique: true,
    partialFilterExpression: {
      scheduleId: { $type: "string" },
      scheduledFor: { $type: "date" }
    }
  }
);
ScanSchema.index({ status: 1, "timings.createdAt": 1 });
ScanSchema.index({ status: 1, leaseExpiresAt: 1 });

ScanSchema.pre("save", function setUrlNormalized() {
  if (this.url) {
    this.urlNormalized = normalizeUrl(this.url);
  }
});

const Scan = mongoose.model("Scan", ScanSchema);

export default Scan;
