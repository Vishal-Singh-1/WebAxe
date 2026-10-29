import mongoose from "mongoose";

const ScanScheduleSchema = new mongoose.Schema(
  {
    scheduleId: { type: String, required: true, unique: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    url: { type: String, required: true },
    scanProfile: {
      key: { type: String, default: "general" },
      label: { type: String, default: "General website" },
      weights: { type: Object, default: {} }
    },
    scheduleType: { type: String, enum: ["once", "recurring"], default: "recurring", index: true },
    intervalHours: { type: Number, min: 1, max: 720 },
    active: { type: Boolean, default: true },
    nextRunAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, default: null },
    lastEnqueuedAt: Date,
    completedAt: Date,
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: false }
);

export default mongoose.model("ScanSchedule", ScanScheduleSchema);
