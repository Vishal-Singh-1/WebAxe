import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_DIR = path.join(__dirname, "../storage");

export async function cleanupScan(scanId) {
  const scanDir = path.join(STORAGE_DIR, scanId);

  try {
    await fs.rm(scanDir, { recursive: true, force: true });
  } catch {
    // silently ignore
  }
}
