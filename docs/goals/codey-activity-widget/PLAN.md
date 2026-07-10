# Codey Activity Card Implementation Plan

**Intent:** Turn DevSpace's end-of-turn change review into a concise, Codex-inspired activity card that explains what Codey did, what changed, and what validation happened—without making raw code the default view.

**Current Behavior:** In `changes` mode, `show_changes` reports a Git snapshot and renders a general-purpose diff card. Tool-call chronology exists only in logs and ChatGPT's outer transcript.

**Expected Outcome:** A `show_changes` card presents a calm activity timeline, per-file green/red deltas, and validation state. Code and command output stay collapsed until explicitly requested.

**Target-Perspective Output:** After Codey finishes an Iris slice, Joe sees one card such as “Verified CI setup”, a short timeline, changed-file counts, and a clear validation outcome instead of needing to read many raw narration/tool bubbles.

**Truth Owner:** `WorkspaceActivityManager`, owned by the DevSpace server and keyed by `workspaceId`.

**Contract Boundary:** `WorkspaceActivitySnapshot` is attached only to `show_changes` structured content/card metadata. The React widget renders that snapshot; it never parses logs or infers a passed test from prose.

**Cutover:** `show_changes` becomes the activity-review renderer in `changes` mode. Existing Git diff data remains available only behind the card's explicit “View file details” disclosure.

**Displaced Path:** Treating raw ChatGPT narration, individual tool cards, or server logs as the user-facing activity timeline.

**Value Density:** High: this improves every Codey task while leaving the coding-agent contract and workspace permissions unchanged.

**Acceptance Evidence:** Focused manager/card tests, full typecheck/build, an isolated preview-server card with a real file delta, and a screenshot of the compact timeline state.

**Evidence Lane:** `docs/goals/codey-activity-widget/EVIDENCE.md`.

**Kill Criteria:** Do not attach a widget to every tool, parse untrusted log text, claim live streaming, expose raw commands/content by default, or restart/alter the live Codey service.

**Non-goals:** Replacing the outer ChatGPT transcript, recreating the full Codex app, background polling, task cancellation, undo/revert actions, or any change to Iris/Jeggle.

## Architecture Slice

| Concern | Final owner | Allowed files | Evidence |
| --- | --- | --- | --- |
| Activity events | `WorkspaceActivityManager` | `src/workspace-activity.ts`, tests | deterministic event/retention tests |
| Tool instrumentation | `createMcpServer` handlers | `src/server.ts` | show_changes carries factual events |
| Card contract | `ToolResultCard` | `src/ui/card-types.ts`, tests | malformed payload safely degrades |
| UI | workspace app | `src/ui/workspace-app.tsx`, `.css` | compact timeline and collapsed details |
| Render metadata | descriptor helper | `src/server.ts` | ChatGPT-compatible output template and app visibility |

## Tasks

### A1 — Activity contract and manager

- Create a bounded in-memory `WorkspaceActivityManager` with explicit workspace initialization, event recording, per-review snapshot/acknowledgement, and deterministic retention.
- Events contain only factual tool outcome data: timestamp, category, status, concise display title, optional safe path, duration, additions/removals, and a redacted reason on failures.
- **Verify:** focused Node tests cover ordering, acknowledgement, workspace isolation, failure, and retention.

### A2 — `show_changes` instrumentation and metadata cutover

- Initialize activity when a workspace opens; record open/read/search/edit/write/shell/patch outcomes through the server's existing structured handlers.
- Add a narrow optional `report_progress` tool for model-provided, brief narration; validate and bound the text before recording it.
- Attach activity snapshots to `show_changes`; make the widget app-visible and include the ChatGPT output-template compatibility field only on rendered tools.
- **Verify:** server/tool tests prove snapshots contain activity while existing review snapshots/diffs still work.

### A3 — Codex-inspired review UI

- Render `show_changes` as a signal-dense dark activity panel: task status, concise narrative events, file deltas, validation state, and one disclosure for file/diff detail.
- Use host design tokens with safe fallbacks; respect reduced motion; retain light theme legibility.
- **Verify:** focused card tests plus a local fixture/browser screenshot of compact and expanded states.

### A4 — Isolated preview readiness

- Build and run the fork only under a separate preview config/port after automated checks pass.
- Do not create or switch the live Codey connector. Produce a preview handoff with exact cutover/reconnect steps for later approval.
- **Verify:** local protected MCP endpoint health and rendered preview evidence; otherwise report `implemented but unproven`.

## Loop

`inspect contract -> red test -> minimal implementation -> focused check -> repair (max 3) -> expand verification -> append durable evidence`.

## Plan Review Gate

Implementation proceeds because the user has approved this exact first slice. Any expansion into a persistent live feed, app-side command execution, or global-service cutover requires a new approval boundary.
