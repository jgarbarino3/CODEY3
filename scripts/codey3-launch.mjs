import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const [command, ...args] = process.argv.slice(2);
if (!["init", "serve", "config", "doctor"].includes(command)) {
  console.error("Usage: node scripts/codey3-launch.mjs <init|serve|config|doctor> [arguments]");
  process.exit(1);
}
const entry = command === "serve"
  ? ["dist/codey3-preview.js", ...args]
  : ["--import", "tsx", "src/cli.ts", command, ...args];
const child = spawn(process.execPath, entry, {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: "7679",
    DEVSPACE_CONFIG_DIR: ".codey3-preview",
    DEVSPACE_STATE_DIR: ".codey3-preview/state",
    DEVSPACE_WORKTREE_ROOT: ".codey3-preview/worktrees",
    DEVSPACE_SUBAGENTS: "0",
    DEVSPACE_TOOL_MODE: "codex",
    DEVSPACE_WIDGETS: "changes",
  },
});
child.once("error", (error) => {
  console.error(`Unable to start CODEY 3: ${error.message}`);
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  process.exitCode = code ?? (signal === "SIGINT" || signal === "SIGTERM" ? 0 : 1);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
