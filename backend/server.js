import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import connectDB from "./config/db.js";
import { loadBackendEnv } from "./config/loadEnv.js";
import authRoutes from "./routes/auth.routes.js";
import scansRoutes from "./routes/scans.routes.js";
import workerRoutes from "./routes/worker.routes.js";
import { requireAuth } from "./middleware/auth.js";

loadBackendEnv();
await connectDB();

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const STORAGE_DIR = path.join(__dirname, "storage");
app.use("/storage", express.static(STORAGE_DIR));

app.use("/api", authRoutes);
app.use("/api", requireAuth, scansRoutes);
app.use("/api", requireAuth, workerRoutes);

app.get("/", (req, res) => {
  res.json({ status: "WebAxe backend running" });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
