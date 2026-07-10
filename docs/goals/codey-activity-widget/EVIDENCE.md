# Codey Activity Card Evidence

## Baseline

- Fork: `jgarbarino3/devspace`, branch `codey-activity-widget`.
- Isolation: the global DevSpace service and existing Codey connector are out of scope.
- Node 24 typecheck and production build passed before UI work.
- Upstream full test suite has one pre-existing `process-sessions.test.ts` PTY timing failure on this Mac; it is not modified by this goal.

## A1

Verified in source and TypeScript compilation.

- `WorkspaceActivityManager` owns bounded activity streams per workspace.
- The manager records only concise titles, paths, deltas, duration, and explicit
  milestones. It does not render raw commands, tool output, token data, or
  secrets.

## A2

Verified in source and production build.

- `show_changes` now attaches the app card in changes mode; ordinary tools do
  not attach blank widget frames.
- Tool metadata includes model and app visibility plus the
  `openai/outputTemplate` compatibility field.
- `show_changes` returns the acknowledged activity snapshot.
- `report_progress` is opt-in and explicitly disallows private reasoning or
  sensitive content.

## A3

Verified in source and production build.

- The default card is a compact timeline with file deltas and status.
- Raw patch rendering is behind **View raw diff**.

## A4

Prepared but not started.

- `npm run codey:preview:init` and `npm run codey:preview` isolate config,
  SQLite state, worktrees, owner token, and port `7678` from the live service.
- `docs/codey-activity-preview.md` documents the temporary tunnel and separate
  ChatGPT connector flow.

## Verification

- `npm run typecheck` passed after implementation.
- `npm run build` passed after implementation. Vite emitted its existing
  large-chunk advisory but completed successfully.
- Focused `tsx` tests were attempted but could not start in the sandbox because
  `tsx` needed a temporary IPC socket. The required elevated rerun was rejected
  by the account usage limit, so activity runtime tests remain **implemented but
  unproven** in this session.
- No ChatGPT connector preview has been started. Live app rendering remains
  **unproven** until the separate temporary preview is connected.
