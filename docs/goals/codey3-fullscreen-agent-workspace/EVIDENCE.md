# CODEY 3 Fullscreen Agent Workspace Evidence

## Baseline

- Source repository: `/Users/joegarbarino/Documents/CODEY`
- Source commit: `4b7e2a8a61d360cf6ec007b6c6c2a7cf240f7df1`
- CODEY 3 repository: `https://github.com/jgarbarino3/CODEY3`
- `npm ci`: passed with zero reported vulnerabilities.
- Inherited `npm test`: produced no failure output.
- Inherited `npm run typecheck`: produced no failure output.
- Inherited `npm run build`: passed with the existing large-chunk advisory.

## Isolation

- CODEY 3 has only `https://github.com/jgarbarino3/CODEY3.git` as its Git remote.
- CODEY 2 repository, service, credentials, connector, global installation, and tunnel were not modified.

## Implementation

- Added persisted CODEY task and event tables with workspace isolation,
  interruption handling, bounded retention, and redacted summaries.
- Added `start_task`, `finish_task`, `get_workspace_dashboard`,
  `list_workspace_entries`, `list_verification_checks`, and
  `run_verification_check` MCP tools.
- Added explicit Apps SDK fullscreen entry, activity-first CODEY workspace,
  metadata-only repository listing, recent-task summaries, and five-second
  visibility-aware polling with backoff.
- Renamed the package to `@jgarbarino3/codey3`; preview scripts use port 7679,
  `.codey3-preview/`, and force subagents off.

## Verification after implementation

- Focused `codey-tasks.test.ts` and `codey-dashboard.test.ts`: passed.
- `npm run typecheck`: passed after removing one recursive UI type discovered
  during the first run.
- Vite production app build: passed with the inherited large-chunk advisory.
- Full suite progressed through the new tests and existing local-agent tests;
  one package-rename regression in PATH isolation was found and fixed. The
  rerun later stalled in the inherited `skills.test.ts`, including after the
  Git repair below, so the full suite is not recorded as green.
- Server TypeScript emit stalled after the app build and was stopped; the full
  production build remains incomplete even though no TypeScript diagnostic was
  emitted.

## Preview evidence

- Preview config and fresh OAuth owner credential exist under ignored
  `.codey3-preview/` with mode `0600`.
- Allowed root is exactly `/Users/joegarbarino/Documents/CODEY3`; subagents are
  disabled; port is 7679.
- Temporary tunnel was created at
  `https://statutes-soldier-serious-columns.trycloudflare.com`.
- The initial local clone contained one truncated Git pack. The corrupt pack,
  index, and reverse index were moved to macOS Trash, the object database was
  refetched from GitHub, and `git fsck --full` then passed.
- The startup block was minimized to the `tsx` loader importing inherited
  `process-sessions.ts`; direct esbuild compilation of that module completed in
  milliseconds. The preview now compiles a small ignored server bundle with
  esbuild before launching Node, bypassing the blocked source-loader path.
- Local `/healthz` returns `{"ok":true,"name":"codey3"}` and local `/mcp`
  returns the expected OAuth-protected `401` challenge.
- Public `/healthz` is healthy and public `/mcp` returns the expected protected
  `401` through
  `https://establishment-judicial-lets-containers.trycloudflare.com/mcp`.
- The server and temporary tunnel are running for ChatGPT connector testing.
  Connector, fullscreen, polling, responsive, and screenshot evidence remain
  **implemented but unproven** until Joe completes the ChatGPT OAuth flow and
  exercises a real task.

## First ChatGPT task repair

- A real read-only ChatGPT task opened the workspace and passed the configured
  typecheck, but `show_changes` failed with `fatal: Needed a single revision`.
- The failure was reproduced deterministically by deleting the workspace review
  baseline ref before calling `reviewChanges`.
- Root cause: workspace open did not await asynchronous review initialization,
  and the manager exposed `gitRoot` before both review refs existed.
- `open_workspace` now awaits baseline creation; review also self-recovers a
  missing ref by comparing against `HEAD`.
- Focused regression test, typecheck, preview bundle build, public health, and
  public OAuth challenge all pass after the repair.
- CODEY 2 remained untouched throughout.

## Cold typecheck timeout repair

- A subsequent ChatGPT task reported that the fixed `typecheck` verification
  exceeded the dashboard's 120-second ceiling and a direct retry appeared idle.
- Process sampling showed TypeScript blocked in filesystem reads across ordinary
  dependency declaration files rather than producing compiler diagnostics.
- The unchanged TypeScript 6 check subsequently passed twice after the cold
  dependency scan completed; the verified run finished inside 30 seconds.
- Fixed repository verification checks now allow up to five minutes so a cold
  macOS dependency scan is not misreported as a failed typecheck.
- Focused dashboard test, full typecheck, and preview bundle build pass. CODEY 2
  and its live service remain untouched.
