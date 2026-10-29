import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MAX_RESTART_DELAY_MS = 30_000;
const SHUTDOWN_TIMEOUT_MS = 30_000;
let shuttingDown = false;

const services = ["server.js", "worker.js"].map((script) => ({
  script,
  child: null,
  restartTimer: null,
  restartCount: 0
}));

function scheduleRestart(service, startedAt, reason) {
  if (shuttingDown || service.restartTimer) return;
  if (Date.now() - startedAt > 60_000) service.restartCount = 0;
  service.restartCount += 1;
  const delay = Math.min(1000 * (2 ** (service.restartCount - 1)), MAX_RESTART_DELAY_MS);
  console.error(`${service.script} ${reason}; restarting it in ${delay / 1000}s.`);
  service.restartTimer = setTimeout(() => {
    service.restartTimer = null;
    launch(service);
  }, delay);
}

function launch(service) {
  if (shuttingDown) return;

  console.log(`Starting ${service.script}...`);
  const startedAt = Date.now();
  const child = spawn(process.execPath, [service.script], {
    stdio: "inherit",
    cwd: __dirname,
    env: process.env
  });
  service.child = child;

  child.on("error", (error) => {
    service.child = null;
    console.error(`${service.script} failed to start: ${error.message}`);
    scheduleRestart(service, startedAt, "could not start");
  });

  child.on("exit", (code, signal) => {
    service.child = null;
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    scheduleRestart(service, startedAt, `exited with ${reason}`);
  });
}

for (const service of services) launch(service);

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const service of services) {
    clearTimeout(service.restartTimer);
    service.child?.kill("SIGTERM");
  }

  const deadline = Date.now() + SHUTDOWN_TIMEOUT_MS;
  while (services.some((service) => service.child) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  for (const service of services) service.child?.kill("SIGKILL");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
