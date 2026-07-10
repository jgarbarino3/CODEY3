# Goal: Codex-Style Codey Activity Card

Implement the approved first release in `docs/goals/codey-activity-widget/PLAN.md`.

Core rules:

- Keep the running global DevSpace service and Codey connector untouched.
- `show_changes` remains the only rendered end-of-turn card in `changes` widget mode.
- The server-owned activity feed is the sole source of timeline truth; the model may add concise narration but cannot forge file/test outcomes.
- Hide raw code and command output by default; details remain an explicit expansion.
- Capture focused automated and rendered-preview evidence before any future preview connector cutover.
