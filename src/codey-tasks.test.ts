import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CodeyTaskStore } from "./codey-tasks.js";

const stateDir = mkdtempSync(join(tmpdir(), "codey3-tasks-"));
const store = new CodeyTaskStore(stateDir);

const first = store.start("ws-one", "  Build   fullscreen workspace  ");
assert.equal(first.title, "Build fullscreen workspace");
assert.equal(first.status, "working");
assert.equal(store.active("ws-one")?.id, first.id);

store.record("ws-one", {
  tool: "apply_patch",
  workspaceId: "ws-one",
  success: true,
  durationMs: 12,
  additions: 9,
  removals: 2,
});
assert.equal(store.get(first.id)?.events.at(-1)?.kind, "change");
assert.equal(store.get(first.id)?.events.at(-1)?.additions, 9);

const second = store.start("ws-one", "Second task");
assert.equal(store.get(first.id)?.status, "interrupted");
assert.equal(store.active("ws-one")?.id, second.id);

const completed = store.finish("ws-one", "complete", "All checks passed");
assert.equal(completed.status, "complete");
assert.equal(completed.summary, "All checks passed");
assert.equal(store.active("ws-one"), undefined);

const isolated = store.start("ws-two", "Other workspace");
assert.equal(store.recent("ws-one").some((task) => task.id === isolated.id), false);

store.close();
