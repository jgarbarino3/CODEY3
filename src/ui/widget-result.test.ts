import assert from "node:assert/strict";
import { cardFromOpenAiGlobals } from "./widget-result.js";

const noChanges = cardFromOpenAiGlobals({
  toolOutput: { result: "No changes since last review." },
  toolResponseMetadata: {
    mcp_tool_result: {
      structuredContent: { result: "No changes since last review." },
      _meta: {
        tool: "show_changes",
        card: {
          workspaceId: "workspace-clean",
          summary: { files: 0 },
          files: [],
        },
      },
    },
  },
});

assert.deepEqual(noChanges, {
  tool: "show_changes",
  workspaceId: "workspace-clean",
  summary: { files: 0 },
  files: [],
  result: "No changes since last review.",
});

const changedFiles = cardFromOpenAiGlobals({
  toolOutput: { result: "1 file changed." },
  toolResponseMetadata: {
    call_tool_result: {
      structuredContent: { result: "1 file changed." },
      _meta: {
        tool: "show_changes",
        card: {
          workspaceId: "workspace-dirty",
          summary: { files: 1, additions: 2, removals: 1 },
          files: [{ path: "README.md", additions: 2, removals: 1 }],
        },
      },
    },
  },
});

assert.equal(changedFiles?.tool, "show_changes");
assert.equal(changedFiles?.workspaceId, "workspace-dirty");
assert.deepEqual(changedFiles?.files, [
  { path: "README.md", additions: 2, removals: 1 },
]);

assert.equal(cardFromOpenAiGlobals({ toolOutput: { result: "Missing metadata" } }), undefined);
