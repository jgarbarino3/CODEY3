# CODEY 3 Fullscreen Agent Workspace Implementation Plan

**Intent:** Give one ChatGPT conversation a Codex-like agent workspace while it operates CODEY MCP directly.

**Current Behavior:** CODEY 2 exposes coding tools and a compact end-of-turn activity card.

**Expected Outcome:** CODEY 3 preserves that coding path and adds persistent tasks, safe dashboards, repository metadata, allowlisted verification, and an explicit fullscreen activity workspace.

**Target-Perspective Output:** Joe sees what ChatGPT is doing, green/red file deltas, validation state, and recent tasks in a calm fullscreen surface while the native composer remains available.

**Truth Owner:** The CODEY 3 server and isolated SQLite state.

**Contract Boundary:** Workspace-scoped task, dashboard, tree, and verification MCP tools plus the `show_changes` card payload.

**Cutover:** A separate CODEY 3 Preview connector on port 7679; CODEY 2 remains live and unchanged.

**Displaced Path:** Card-only review is demoted to the compact fallback, not deleted.

**Acceptance Evidence:** Automated checks, protected preview endpoint, and rendered ChatGPT fullscreen evidence.

**Evidence Lane:** `EVIDENCE.md`.

**Kill Criteria:** No shared credentials/state, no automatic fullscreen, no arbitrary widget shell/edit/revert, no workers, and no live-service replacement.

## Tasks

1. Preserve and record the inherited CODEY 2 baseline.
2. Add persisted server-owned task/dashboard state.
3. Add metadata-only repository browsing and allowlisted verification.
4. Add explicit fullscreen activity UI with visibility-aware polling.
5. Verify repository behavior and isolated preview behavior.

## Plan Review Gate

Requires post-plan correctness, maintainability, and target-perspective evidence review before completion.
