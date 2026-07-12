# CODEY Project Handoff

**Created:** 2026-07-12  
**Purpose:** Continue the personal DevSpace/Codey project: a local MCP coding
workspace for ChatGPT with a compact, Codex-inspired end-of-turn activity card
and a safe path toward local worker orchestration.

## Start here

1. Read `AGENTS.md`.
2. Inspect `git status --short --branch` before editing.
3. Read `docs/goals/codey-activity-widget/GOAL.md`, `PLAN.md`, and
   `EVIDENCE.md` for the existing activity-card work.
4. Read `docs/codey-activity-preview.md` before changing preview setup.

## Current repository state

- `main` starts at commit `0dbea09` (`feat: add Codey activity card preview`).
- The source history comes from the DevSpace fork; this repository is now the
  dedicated home for Codey-specific work.
- The commit adds a server-owned `WorkspaceActivityManager`, a Codex-inspired
  `show_changes` card, concise `report_progress` milestones, and preview-only
  scripts/config isolation.
- `npm run typecheck` and `npm run build` passed for that work. The focused
  `tsx` tests were written but their elevated rerun was blocked by an account
  execution limit at the time; see the evidence ledger instead of assuming a
  full green suite.

## Live versus preview boundaries

- The live Codey service is separate from this checkout. Do not modify its
  launch agent, global npm installation, OAuth secret, or public tunnel unless
  the user explicitly asks for a deliberate cutover.
- The preview lane uses `npm run codey:preview:init` and
  `npm run codey:preview`. It is designed to use a separate port, config,
  state directory, worktree directory, OAuth owner password, and temporary
  tunnel.
- Keep preview allowed roots narrow. A descriptive folder name is not valid;
  ChatGPT must be given an exact absolute path.
- Never place owner passwords, OAuth tokens, or tunnel credentials in Git,
  logs, handoffs, or ChatGPT prompts.

## What the activity card is meant to do

- In `DEVSPACE_WIDGETS=changes` mode, only `show_changes` renders the app card.
- The card shows user-facing activity, changed files, green/red deltas, and
  validation outcomes first.
- Raw diffs stay behind an explicit **View raw diff** control.
- The timeline must never display hidden reasoning, raw commands, tokens,
  credentials, or file contents.

## Subagent direction

DevSpace already has an experimental local-worker substrate:

```text
devspace agents run <profile-or-provider> "focused task"
devspace agents show <agent-id>
```

Workers are local Codex/Claude/etc. processes with persisted local status and
results. They are not autonomous ChatGPT cloud threads. Do not attempt to make
one ChatGPT conversation scrape or control another conversation.

Recommended next product slice:

1. Enable and test one read-only `reviewer` profile in an isolated preview.
2. Expose first-class MCP tools for spawn/list/get/wait/cancel instead of making
   the main chat drive the CLI manually.
3. Add worker status and result summaries to the Codey activity card.
4. Permit at most one write-capable worker per workspace; use a worktree for
   implementation workers and require the main agent to review results.

## Suggested skills for the next Codex task

- `$ask-matt` to route non-trivial design or implementation work.
- `$grill-with-docs` before a new codebase-backed feature plan.
- `$krypton-planning` for the orchestration cutover contract and acceptance
  evidence.
- `$krypton-execution` after that plan is approved.
- `$loops` for bounded worker polling and evidence-gated verification.
- `$frontend-design` for further Codey activity-card UI polish.

## Verification expectations

- Run `npm run typecheck` and `npm run build` after source changes.
- Run focused tests for the touched modules, then the relevant broader suite.
- Verify a preview endpoint returns OAuth-protected `401`, not public `200`.
- Verify the widget in a separate ChatGPT preview connector before replacing
  live Codey.
- Treat a missing app card, missing Codey tools, or unavailable browser test as
  an explicit `implemented but unproven` state—not success.
