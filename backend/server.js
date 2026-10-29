import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

import connectDB from "./config/db.js";
import { loadBackendEnv } from "./config/loadEnv.js";
import authRoutes from "./routes/auth.routes.js";
import scansRoutes from "./routes/scans.routes.js";
import workerRoutes from "./routes/worker.routes.js";
import schedulesRoutes from "./routes/schedules.routes.js";
import { requireAuth } from "./middleware/auth.js";

loadBackendEnv();
await connectDB();

const app = express();
const port = process.env.PORT || 3000;

const defaultCorsOrigins = process.env.NODE_ENV === "production"
  ? ["https://web-axe.vercel.app"]
  : [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4173",
      "http://127.0.0.1:4173"
    ];
const corsOrigins = new Set([
  ...defaultCorsOrigins,
  ...(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean)
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors({
  origin(origin, callback) {
    // Requests without an Origin header (for example, health checks and CLI tools)
    // are not browser cross-origin requests and remain allowed.
    callback(null, !origin || corsOrigins.has(origin));
  }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const STORAGE_DIR = path.join(__dirname, "storage");
app.use("/storage", express.static(STORAGE_DIR));

app.use("/api", authRoutes);
app.use("/api", requireAuth, scansRoutes);
app.use("/api", requireAuth, schedulesRoutes);
app.use("/api", requireAuth, workerRoutes);

app.get("/", (req, res) => {
  res.json({ status: "WebAxe backend running" });
});

const httpServer = app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  httpServer.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 30_000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
