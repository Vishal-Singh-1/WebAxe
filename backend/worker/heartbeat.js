import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_DIR = path.join(__dirname, "../storage");
const WORKER_FILE = path.join(STORAGE_DIR, "worker.json");

export async function startHeartbeat(interval = 5000) {
  await mkdir(STORAGE_DIR, { recursive: true });

  setInterval(async () => {
    try {
      await writeFile(
        WORKER_FILE,
        JSON.stringify(
          { lastHeartbeat: new Date().toISOString() },
          null,
          2
        )
      );
    } catch (err) {
      console.error("Heartbeat error:", err.message);
    }
  }, interval);
}
