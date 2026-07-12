import { spawn } from "node:child_process";
import net from "node:net";

const port = 17679;
const timeoutMs = 10_000;
const startedAt = Date.now();
let diagnostics = "";
let settled = false;

const child = spawn(process.execPath, ["dist/codey3-preview.js"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(port),
    DEVSPACE_CONFIG_DIR: ".codey3-preview",
    DEVSPACE_STATE_DIR: ".codey3-preview/state",
    DEVSPACE_WORKTREE_ROOT: ".codey3-preview/worktrees",
    DEVSPACE_SUBAGENTS: "0",
    DEVSPACE_TOOL_MODE: "codex",
    DEVSPACE_WIDGETS: "changes",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

child.stdout.on("data", (chunk) => {
  diagnostics += chunk;
});
child.stderr.on("data", (chunk) => {
  diagnostics += chunk;
});

function finish(error) {
  if (settled) return;
  settled = true;
  child.kill("SIGTERM");
  if (error) {
    console.error(error);
    if (diagnostics.trim()) console.error(diagnostics.trim());
    process.exitCode = 1;
    return;
  }
  console.log(`CODEY 3 preview ready in ${Date.now() - startedAt}ms`);
}

child.once("exit", (code) => {
  if (!settled) finish(`CODEY 3 preview exited before listening (code ${code ?? "unknown"}).`);
});

const deadline = Date.now() + timeoutMs;
function checkPort() {
  const socket = net.connect(port, "127.0.0.1");
  socket.once("connect", () => {
    socket.destroy();
    finish();
  });
  socket.once("error", () => {
    socket.destroy();
    if (Date.now() >= deadline) {
      finish(`CODEY 3 preview did not listen within ${timeoutMs}ms.`);
      return;
    }
    setTimeout(checkPort, 100);
  });
}

checkPort();
