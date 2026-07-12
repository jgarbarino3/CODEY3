# Goal: CODEY 3 Fullscreen Agent Workspace

Execute `PLAN.md` while preserving CODEY 2 as an untouched compatibility baseline.

Core rules:

- ChatGPT remains the sole coding agent through MCP; V1 has no local workers.
- CODEY 3 uses isolated repository, configuration, state, credentials, port, tunnel, and connector.
- The server owns task, Git, file-delta, and verification truth.
- The inline `show_changes` card remains the fallback; fullscreen opens explicitly.
- Do not install or cut over a persistent service without separate approval.
- Capture target-perspective evidence or report `implemented but unproven`.
