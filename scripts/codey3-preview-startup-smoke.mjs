import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";

// Never read a developer's preview credentials or SQLite database in this test.
const temporaryRoot = mkdtempSync(join(tmpdir(), "codey3-startup-"));
const reservation = net.createServer();
await new Promise((resolve, reject) => {
  reservation.once("error", reject);
  reservation.listen(0, "127.0.0.1", resolve);
});
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const origin = `http://127.0.0.1:${port}`;
let diagnostics = "";
let spawnError;
const child = spawn(process.execPath, ["dist/codey3-preview.js"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: String(port),
    DEVSPACE_CONFIG_DIR: join(temporaryRoot, "config"),
    DEVSPACE_STATE_DIR: join(temporaryRoot, "state"),
    DEVSPACE_WORKTREE_ROOT: join(temporaryRoot, "worktrees"),
    DEVSPACE_ALLOWED_ROOTS: temporaryRoot,
    DEVSPACE_ALLOWED_HOSTS: "127.0.0.1,localhost",
    DEVSPACE_PUBLIC_BASE_URL: origin,
    DEVSPACE_OAUTH_OWNER_TOKEN: randomBytes(32).toString("base64url"),
    DEVSPACE_SUBAGENTS: "0",
    DEVSPACE_TOOL_MODE: "codex",
    DEVSPACE_WIDGETS: "changes",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
child.stdout.on("data", (chunk) => { diagnostics += chunk; });
child.stderr.on("data", (chunk) => { diagnostics += chunk; });
child.once("error", (error) => { spawnError = error; });
const exited = new Promise((resolve) => child.once("close", resolve));
try {
  let healthy = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error(`Server exited: ${child.exitCode}`);
    try {
      const response = await fetch(`${origin}/healthz`, { signal: AbortSignal.timeout(1000) });
      const body = await response.json();
      if (response.ok && body.ok === true && body.name === "codey3") {
        healthy = true;
        break;
      }
    } catch { /* Startup can take a moment on CI. */ }
    await delay(100);
  }
  assert(healthy, "CODEY 3 did not become healthy");
  const unauthenticated = await fetch(`${origin}/mcp`, { signal: AbortSignal.timeout(5000) });
  assert.equal(unauthenticated.status, 401, "MCP must require OAuth");
  console.log("CODEY 3 startup passed: health 200, unauthenticated MCP 401.");
} catch (error) {
  console.error(error.message);
  if (diagnostics.trim()) console.error(diagnostics.trim());
  process.exitCode = 1;
} finally {
  child.kill("SIGTERM");
  const stopped = await Promise.race([exited.then(() => true), delay(3000).then(() => false)]);
  if (!stopped) {
    child.kill("SIGKILL");
    await exited;
  }
}
