import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_DIR = path.join(__dirname, "../storage");
const WORKER_FILE = path.join(STORAGE_DIR, "worker.json");

export async function startHeartbeat(interval = 5000, workerId = null, getCurrentScanId = () => null) {
  await mkdir(STORAGE_DIR, { recursive: true });

  const writeHeartbeat = async () => {
    try {
      await writeFile(
        WORKER_FILE,
        JSON.stringify(
          {
            workerId,
            currentScanId: getCurrentScanId(),
            lastHeartbeat: new Date().toISOString()
          },
          null,
          2
        )
      );
    } catch (err) {
      console.error("Heartbeat error:", err.message);
    }
  };

  await writeHeartbeat();
  const timer = setInterval(writeHeartbeat, interval);
  timer.unref?.();
  return () => clearInterval(timer);
}
