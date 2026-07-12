import { execFile } from "node:child_process";
import { readdir, realpath, stat } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import type { CodeyTask, CodeyTaskStore } from "./codey-tasks.js";
import { isPathInsideRoot } from "./roots.js";

const execFileAsync = promisify(execFile);
const PAGE_SIZE = 100;

export interface WorkspaceEntry {
  name: string;
  path: string;
  type: "directory" | "file" | "symlink" | "other";
  changed: boolean;
}

export interface VerificationCheck {
  id: "test" | "typecheck" | "build";
  label: string;
  script: string;
}

export interface DashboardSnapshot {
  workspaceId: string;
  cursor: string;
  unchanged?: boolean;
  repository?: {
    name: string;
    branch: string;
    dirty: boolean;
  };
  currentTask?: CodeyTask;
  recentTasks: CodeyTask[];
  files: Array<{ path: string; additions: number; removals: number }>;
}

export async function getDashboard(input: {
  workspaceId: string;
  root: string;
  taskStore: CodeyTaskStore;
  taskId?: string;
  cursor?: string;
}): Promise<DashboardSnapshot> {
  const currentTask = input.taskId
    ? input.taskStore.get(input.taskId)
    : input.taskStore.active(input.workspaceId) ?? input.taskStore.recent(input.workspaceId, 1)[0];
  if (currentTask && currentTask.workspaceId !== input.workspaceId) {
    throw new Error("Task does not belong to this workspace.");
  }
  const [branch, porcelain, numstat] = await Promise.all([
    git(input.root, ["branch", "--show-current"]).catch(() => ""),
    git(input.root, ["status", "--porcelain=v1"]).catch(() => ""),
    git(input.root, ["diff", "--numstat", "HEAD"]).catch(() => ""),
  ]);
  const files = parseNumstat(numstat);
  const cursor = [currentTask?.id ?? "none", currentTask?.version ?? 0, branch, porcelain, numstat]
    .join("|");
  if (input.cursor === cursor) {
    return { workspaceId: input.workspaceId, cursor, unchanged: true, recentTasks: [], files: [] };
  }
  return {
    workspaceId: input.workspaceId,
    cursor,
    repository: {
      name: basename(input.root),
      branch: branch.trim() || "detached",
      dirty: porcelain.trim().length > 0,
    },
    currentTask,
    recentTasks: input.taskStore.recent(input.workspaceId, 6),
    files,
  };
}

export async function listWorkspaceEntries(input: {
  root: string;
  path?: string;
  cursor?: number;
}): Promise<{ path: string; entries: WorkspaceEntry[]; nextCursor?: number }> {
  const root = await realpath(input.root);
  const relativePath = normalizeRelativePath(input.path);
  const requested = resolve(root, relativePath);
  const canonical = await realpath(requested);
  if (!isPathInsideRoot(canonical, root) && canonical !== root) {
    throw new Error("Requested directory escapes the workspace root.");
  }
  const directory = await stat(canonical);
  if (!directory.isDirectory()) throw new Error("Requested path is not a directory.");
  const changed = new Set((await git(root, ["status", "--porcelain=v1"]).catch(() => ""))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).split(" -> ").at(-1) ?? ""));
  const entries = await readdir(canonical, { withFileTypes: true });
  const sorted = entries
    .filter((entry) => entry.name !== ".git" && entry.name !== ".codey3-preview")
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
  const offset = Math.max(0, input.cursor ?? 0);
  const page = sorted.slice(offset, offset + PAGE_SIZE);
  return {
    path: relativePath || ".",
    entries: page.map((entry) => {
      const path = relative(canonical === root ? root : root, join(canonical, entry.name));
      return {
        name: entry.name,
        path,
        type: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : entry.isSymbolicLink() ? "symlink" : "other",
        changed: Array.from(changed).some((changedPath) => changedPath === path || changedPath.startsWith(`${path}/`)),
      };
    }),
    nextCursor: offset + PAGE_SIZE < sorted.length ? offset + PAGE_SIZE : undefined,
  };
}

export function verificationChecks(): VerificationCheck[] {
  return [
    { id: "test", label: "Tests", script: "test" },
    { id: "typecheck", label: "Type check", script: "typecheck" },
    { id: "build", label: "Production build", script: "build" },
  ];
}

export async function runVerification(input: {
  root: string;
  checkId: string;
  timeoutMs?: number;
}): Promise<{ checkId: string; label: string; status: "passed" | "failed"; durationMs: number; exitCode: number }> {
  const check = verificationChecks().find((candidate) => candidate.id === input.checkId);
  if (!check) throw new Error(`Unknown verification check: ${input.checkId}`);
  const started = performance.now();
  try {
    await execFileAsync("npm", ["run", check.script], {
      cwd: input.root,
      timeout: input.timeoutMs ?? 120_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    return { checkId: check.id, label: check.label, status: "passed", durationMs: Math.round(performance.now() - started), exitCode: 0 };
  } catch (error) {
    const exitCode = typeof error === "object" && error && "code" in error && typeof error.code === "number" ? error.code : 1;
    return { checkId: check.id, label: check.label, status: "failed", durationMs: Math.round(performance.now() - started), exitCode };
  }
}

function normalizeRelativePath(value?: string): string {
  const normalized = (value ?? ".").replaceAll("\\", "/").replace(/^\.\//, "");
  if (normalized === "." || normalized === "") return "";
  if (normalized.startsWith("/") || normalized.split("/").includes("..")) {
    throw new Error("Workspace entry paths must be relative and cannot contain '..'.");
  }
  return normalized;
}

function parseNumstat(value: string): Array<{ path: string; additions: number; removals: number }> {
  return value.split(/\r?\n/).filter(Boolean).map((line) => {
    const [additions, removals, ...pathParts] = line.split("\t");
    return {
      path: pathParts.join("\t"),
      additions: additions === "-" ? 0 : Number(additions ?? 0),
      removals: removals === "-" ? 0 : Number(removals ?? 0),
    };
  });
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd, maxBuffer: 4 * 1024 * 1024 });
  return stdout;
}
