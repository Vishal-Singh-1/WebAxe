import express from "express";   // this code is used for routing in worker health status checking
import path from "path";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKER_FILE = path.join(__dirname, "../storage/worker.json");

router.get("/worker/health", async (req, res) => {
  try {
    const raw = await readFile(WORKER_FILE, "utf8");
    const data = JSON.parse(raw);

    const last = new Date(data.lastHeartbeat).getTime();
    const now = Date.now();

    const alive = now - last < 15000;

    res.json({
      status: alive ? "alive" : "dead",
      lastHeartbeat: data.lastHeartbeat
    });
  } catch {
    res.json({
      status: "dead",
      lastHeartbeat: null
    });
  }
});

export default router;
