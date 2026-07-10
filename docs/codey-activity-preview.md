# Codey Activity Card Preview

This fork includes a separate preview lane for the Codex-inspired end-of-turn
activity card. It deliberately does **not** replace a running DevSpace service,
reuse its OAuth owner token, share its SQLite state, or bind its port.

## What the preview changes

- `show_changes` is the only tool with an app card in `DEVSPACE_WIDGETS=changes` mode.
- One card summarizes workspace opens, reads, edits, commands, validations, and
  concise `report_progress` milestones.
- File additions and removals are visible without opening a diff.
- Raw patch content loads only after selecting **View raw diff**.

## Start an isolated local preview

Use three terminals from the fork root.

1. Start a temporary public tunnel on a new port. Cloudflare quick tunnels are
   a convenient choice because they do not affect an existing ngrok tunnel:

   ```bash
   brew install cloudflared
   cloudflared tunnel --url http://127.0.0.1:7678
   ```

   Copy the displayed `https://…trycloudflare.com` origin, without `/mcp`.

2. Initialize the preview's completely separate configuration directory:

   ```bash
   npm run codey:preview:init
   ```

   Choose the narrow project roots you want for the preview, port `7678`, and
   paste the temporary tunnel origin. The command prints a new preview-only
   owner password. Keep it private.

3. Start the preview service:

   ```bash
   npm run codey:preview
   ```

Then add a **new** ChatGPT Developer Mode connector whose server URL is
`https://…trycloudflare.com/mcp`, choose OAuth, and approve it with the
preview-only owner password. Keep the existing Codey connector unchanged.

## Expected test prompt

In the new connector chat, ask:

```text
Open ~/devspace-test, inspect README.md, add one short sentence, run the
appropriate verification, report concise milestones, then call show_changes
exactly once before your final response.
```

The end of the turn should render one **Codey activity** card rather than a
widget per tool call. If it falls back to plain transcript output, first confirm
that Developer Mode is enabled and Enforce CSP is enabled, then reconnect the
preview connector so ChatGPT rescans its tools and app metadata.

## Stop and discard

Stop the preview server and tunnel with `Ctrl-C`. Deleting `.codey-preview/`
removes only preview credentials and state; it does not modify the live service.
