import assert from "node:assert/strict";
import { createWorkspaceActivityManager } from "./workspace-activity.js";

const activity = createWorkspaceActivityManager();
activity.initializeWorkspace({ workspaceId: "iris" });
activity.recordToolCall({
  tool: "read",
  workspaceId: "iris",
  path: "AGENTS.md",
  success: true,
  durationMs: 12,
});
activity.recordToolCall({
  tool: "edit",
  workspaceId: "iris",
  path: "src/ui.ts",
  additions: 14,
  removals: 2,
  success: true,
  durationMs: 35,
});
activity.recordToolCall({
  tool: "exec_command",
  workspaceId: "iris",
  command: "npm run verify",
  success: true,
  durationMs: 120,
});

const first = activity.snapshot({ workspaceId: "iris", acknowledge: true });
assert.equal(first.status, "complete");
assert.deepEqual(first.events.map((event) => event.title), [
  "Opened workspace",
  "Read project context",
  "Updated files",
  "Ran validation",
]);
assert.equal(first.events[2]?.additions, 14);
assert.equal(first.events[2]?.removals, 2);

activity.reportProgress({
  workspaceId: "iris",
  status: "working",
  summary: "I found the responsible UI path and am making the smallest safe change.",
});
activity.recordToolCall({
  tool: "bash",
  workspaceId: "iris",
  command: "npm run typecheck",
  success: false,
  durationMs: 43,
});

const second = activity.snapshot({ workspaceId: "iris" });
assert.equal(second.status, "attention");
assert.deepEqual(second.events.map((event) => event.status), ["working", "failure"]);
assert.equal(second.events[1]?.title, "Ran validation needs attention");

activity.recordToolCall({
  tool: "edit",
  workspaceId: "other",
  path: "separate.ts",
  success: true,
  durationMs: 1,
});
assert.equal(activity.snapshot({ workspaceId: "iris" }).events.length, 2);
assert.equal(activity.snapshot({ workspaceId: "other" }).events.length, 1);
