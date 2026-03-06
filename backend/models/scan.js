import mongoose from "mongoose";

const ScanSchema = new mongoose.Schema(
  {
    scanId: { type: String, required: true, unique: true },
    url: String,
    status: String,
    phase: String,

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

const Scan = mongoose.model("Scan", ScanSchema);

export default Scan;
