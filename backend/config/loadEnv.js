import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadBackendEnv() {
  const backendDir = path.resolve(__dirname, "..");
  const envPath = path.join(backendDir, ".env");

  dotenv.config({ path: envPath });

  return envPath;
}
