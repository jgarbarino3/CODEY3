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

## Preview startup repair

- Post-reboot reproduction proved CODEY 3 could spend minutes evaluating the
  public `@earendil-works/pi-coding-agent` barrel before binding port 7679; the
  trace reached unrelated interactive UI modules such as individual
  `highlight.js` languages.
- Root cause: the earlier preview compilation left every dependency external,
  so runtime startup evaluated Pi's full public barrel even though CODEY 3 only
  needs its local coding tools, skill loader, and project-context discovery.
- CODEY 3 Preview now aliases that barrel to a narrow adapter and bundles its
  JavaScript dependency graph, leaving only native `better-sqlite3` external.
  The adapter preserves Pi's coding-tool factories and skill loading while
  implementing the same bounded AGENTS/CLAUDE ancestor discovery without Pi's
  interactive resource-loader UI imports.
- A deterministic startup smoke test now fails if the preview does not listen
  within ten seconds. The repaired preview started in 203ms on the verification
  run; the original bundle failed the five-second repro.
- Full test suite, full typecheck, preview build, local health, local OAuth
  challenge, public health, and public OAuth challenge pass.
- The current temporary connector URL is
  `https://compatible-obtaining-repair-doubt.trycloudflare.com/mcp`.
- CODEY 2 remained untouched.

## User-invoked Desktop launcher

- Added a repo-owned CODEY 3 launcher and installed a separate executable copy
  at `/Users/joegarbarino/Desktop/ChatGPT + CODEY 3 Preview.command`.
- The launcher owns only CODEY 3 PID files, logs, port 7679, isolated config,
  temporary tunnel, and OAuth owner-code clipboard flow. It refuses to replace
  an unknown listener and does not modify CODEY 2's LaunchAgent or ngrok tunnel.
- A healthy existing public endpoint is reused. After reboot, the launcher
  requests a new Cloudflare Quick Tunnel URL, waits for a registered connection,
  retries from automatic/QUIC transport to HTTP/2, updates only CODEY 3's
  `publicBaseUrl`, starts the preview, and checks local and public health.
- Shell syntax validation passed. The real launcher started CODEY 3 locally and
  local `/healthz` returned `{"ok":true,"name":"codey3"}`. The isolated OAuth
  owner code was copied to the macOS clipboard without being printed.
- On the 2026-07-13 network, Cloudflare port 7844 was reset for both QUIC and
  HTTP/2. CODEY 2's existing ngrok endpoint remained online and was deliberately
  not reused or replaced. Public launcher recovery is **implemented but
  unproven** until the network permits a Cloudflare edge connection.

## Initial widget-result hydration repair

- A real ChatGPT `show_changes` call mounted the CODEY 3 iframe but left it at
  `Waiting for a tool result.` even though the tool completed successfully.
- The widget previously handled only later MCP Apps tool-result notifications.
  It now also hydrates once from ChatGPT's initial `toolOutput` and canonical
  `toolResponseMetadata`, and listens for later `openai:set_globals` updates.
- Initial globals and live notifications share one card decoder; no duplicate
  rendering or state-ownership path was introduced.
- Focused regression coverage passes for both a zero-change review and a
  changed-file review. Full tests, typecheck, production widget build, preview
  bundle build, and diff hygiene pass.
- Visibility-aware polling remains unchanged: it runs only while the widget is
  fullscreen, visible, and attached to a workspace.
- A refreshed ChatGPT render and fullscreen interaction remain **implemented
  but unproven** until the connector exercises the repaired widget.
- The first same-conversation retest reused ChatGPT's cached original template
  and still showed the old waiting state. The resource URI is versioned as
  `ui://devspace/workspace-app-v2.html`; CODEY NEW must be reconnected before
  the target-perspective retest so ChatGPT discovers the new descriptor.
