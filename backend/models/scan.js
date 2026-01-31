import mongoose from "mongoose";

const ScanSchema = new mongoose.Schema({
  scanId: { type: String, required: true, unique: true },
  url: String,
  status: String,
  phase: String,

  error: String,
  errorType: String,
  userMessage: String,

  summary: {
    violations: Number,
    passes: Number,
    incomplete: Number
  },

  artifacts: {
    reportPath: String,
    screenshotPath: String
  },

  timings: {
    createdAt: Date,
    startedAt: Date,
    finishedAt: Date,
    durationMs: Number
  }
});

const Scan = mongoose.model("Scan", ScanSchema);

export default Scan; // ✅ THIS LINE FIXES EVERYTHING
