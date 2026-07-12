# CODEY 3 Project Handoff

**Created:** 2026-07-12  
**Baseline:** CODEY 2 commit `4b7e2a8a61d360cf6ec007b6c6c2a7cf240f7df1`  
**Repository:** `https://github.com/jgarbarino3/CODEY3`

## Product

CODEY 3 preserves CODEY 2's single-ChatGPT-agent MCP coding behavior and adds a
Codex-inspired fullscreen activity workspace. The compact `show_changes` card
remains the normal and fallback result.

## Isolation

- Local checkout: `/Users/joegarbarino/Documents/CODEY3`
- Preview port: `7679`
- Preview state: `.codey3-preview/`
- Intended connector name: `CODEY 3 Preview`
- CODEY 2 repository, port 7676 service, global installation, OAuth material,
  connector, and tunnel are out of scope and must remain untouched.

## Continue

Read `docs/goals/codey3-fullscreen-agent-workspace/{GOAL,PLAN,EVIDENCE}.md`.
Run focused tests, the full suite, typecheck, and build before claiming
completion. Missing rendered ChatGPT fullscreen evidence means `implemented but
unproven`.
