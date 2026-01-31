import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";

import connectDB from "./config/db.js";
import scansRoutes from "./routes/scans.routes.js";
import workerRoutes from "./routes/worker.routes.js";

/* ---------------- CONFIG ---------------- */

dotenv.config();
await connectDB(); // ✅ IMPORTANT

const app = express();
const port = process.env.PORT || 3000;

/* ---------------- GLOBALS ---------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------------- MIDDLEWARE ---------------- */

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ---------------- STATIC STORAGE ---------------- */

const STORAGE_DIR = path.join(__dirname, "storage");
app.use("/storage", express.static(STORAGE_DIR));

/* ---------------- ROUTES ---------------- */

app.use("/api", scansRoutes);
app.use("/api", workerRoutes);

/* ---------------- HEALTH CHECK ---------------- */

app.get("/", (req, res) => {
  res.json({ status: "WebAxe backend running" });
});

/* ---------------- START SERVER ---------------- */

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
