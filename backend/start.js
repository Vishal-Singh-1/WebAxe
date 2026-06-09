import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const processes = [
  { name: "server", script: "server.js" },
  { name: "worker", script: "worker.js" }
].map(({ name, script }) => {
  const child = spawn(process.execPath, [script], {
    stdio: "inherit",
    cwd: __dirname,
    env: process.env
  });

  child.on("exit", (code, signal) => {
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    console.error(`${name} exited with ${reason}`);
    shutdown(code || 1);
  });

  return child;
});

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of processes) {
    if (!child.killed) child.kill("SIGTERM");
  }

  setTimeout(() => process.exit(code), 500);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
