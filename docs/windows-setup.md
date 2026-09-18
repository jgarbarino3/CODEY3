# CODEY 3: Windows setup with Codex

Give this page to **Codex running locally on the Windows PC**. A cloud-only chat
cannot install programs or operate that PC unless it already has an appropriate
local connection. CODEY does not require access to the maintainer's Mac.

## Copy this prompt into your friend's Codex

```text
Set up https://github.com/jgarbarino3/CODEY3 on this Windows PC.
Read AGENTS.md and docs/windows-setup.md, then carry out the setup and checks.
Use the Windows-native route, Node 22 LTS >=22.19, Git for Windows, and my own
ngrok account. Inspect existing installations first. Ask which exact project
folders I want ChatGPT to access; do not expose my entire home folder or drive.
Install missing prerequisites from official sources, clone outside OneDrive,
install locked dependencies, build, and configure a fresh local CODEY instance.
Keep credentials out of chat, logs, Git, and shared files. Preserve any existing
CODEY configuration and unrelated processes. Handle routine setup yourself;
bring me to the relevant page for sign-in, MFA, account terms, security prompts,
or approvals you cannot complete. Use my own tunnel URL, never the maintainer's.
Connect ChatGPT with OAuth, then verify actual open_workspace and a read-only
file listing through that connector. Do not equate a health check with success.
Leave me the exact folder path, connector name, URL, start/stop commands, and
which checks passed. Do not install an always-on service unless I request it.
```

## What runs where

```text
Your ChatGPT account
        | HTTPS + OAuth
Your ngrok URL
        | encrypted tunnel
ngrok on your Windows PC
        | http://127.0.0.1:7679
CODEY 3 on that PC
        | local tools
Your selected project folders
```

Codex helps install and configure this. Afterward, ChatGPT uses CODEY's MCP tools
to work on files on this PC. Both CODEY and ngrok must keep running, and the PC
must be awake and online. They can be stopped whenever remote access is unwanted.
A folder allowlist is **not an operating-system sandbox**: shell commands run as
the signed-in Windows user. Connect only your own trusted client.

This guide uses the isolated `codey3:preview` lane. Despite its historical name,
it contains the CODEY 3 interface and keeps config, credentials, SQLite state,
and worktrees together in `.codey3-preview/`. The upstream npm package
`@waishnav/devspace` is a different product; do not substitute it.

## 1. Inspect the PC and choose folders

In PowerShell:

```powershell
Get-Command node,npm.cmd,git,ngrok -ErrorAction SilentlyContinue
node --version
npm.cmd --version
git --version
ngrok version
```

A missing command is a prerequisite to install, not a reason to abandon setup.
Use a local path such as `C:\Users\YourName\Projects\CODEY3`, outside OneDrive,
network drives, or synchronized Documents folders. Confirm a separate exact
project folder to expose, for example `C:/Users/YourName/Projects/MyProject`.
Windows forward-slash paths avoid escaping mistakes. Do not use macOS paths.

## 2. Install missing prerequisites

- **Node.js 22 LTS, at least 22.19**, from [Node.js](https://nodejs.org/en/download).
  The package accepts Node >=22.19 and <27. Node 22 is the CI baseline; using it
  also reduces native-addon compatibility surprises. Match the PC architecture.
- **Git for Windows**, including Git Bash, from [gitforwindows.org](https://gitforwindows.org/).
  Its standard installation includes `C:\Program Files\Git\bin\bash.exe`.
- **ngrok**, from the [official Windows instructions](https://ngrok.com/download/windows).
  The vendor recommends its Microsoft Store distribution. Its documented
  PowerShell installation command is `winget install ngrok -s msstore`.

The user must accept any installer/account terms or elevation prompts required
by their environment. Reopen terminals after installation so PATH is refreshed.
Use `npm.cmd` in PowerShell if its execution policy blocks `npm.ps1`; do not
weaken the machine's execution policy just for this project.

Run `git --version`, `node --version`, `npm.cmd --version`, and `ngrok version`
again. Keep the Windows Node/Git installation together. WSL is an alternative
Linux installation with its own Node, Git, paths, and checkout, not a mixture
of Windows executables and Linux paths.

## 3. Clone and build this fork

In PowerShell, from the chosen parent folder:

```powershell
git clone https://github.com/jgarbarino3/CODEY3.git
Set-Location CODEY3
npm.cmd ci
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run build:preview
npm.cmd run test:preview-startup
```

If the checkout already exists, inspect `git status` and its remote before
reusing it. Preserve local changes; do not reset or overwrite them.
`npm ci` installs exactly the lockfile versions, including native dependencies.
Downloads can be large because the inherited dependency tree includes optional
agent runtimes even though this lane disables local subagents.

Run all commands from the repository root. Do not start `npm start`: that is the
inherited generic DevSpace entrypoint with different default config/port.

## 4. Authenticate your own ngrok installation

Open [Your Authtoken](https://dashboard.ngrok.com/get-started/your-authtoken).
Let the user sign in/create an account and complete MFA. Configure the existing
token locally with the command displayed by ngrok:

```text
ngrok config add-authtoken <YOUR_OWN_TOKEN>
```

The placeholder is not a real credential. Do not ask the user to paste a token
into chat or put it into the repository. Prefer local secure entry and do not
capture the command with its token in a shared transcript. Then run:

```powershell
ngrok config check
```

ngrok's token authenticates the tunnel client. It is **different from CODEY's
owner password**, which is generated in the next section for ChatGPT approval.

## 5. Start the tunnel

In a separate terminal:

```powershell
ngrok http http://127.0.0.1:7679
```

Keep this terminal open. Copy its actual HTTPS forwarding origin, such as
`https://your-own-host.ngrok-free.app`. The real hostname comes from this user's
ngrok account; the example is not usable. If the account has an assigned domain,
use that same domain consistently according to ngrok's dashboard instructions.

No router port forwarding or inbound public Windows firewall port is required
for this arrangement. CODEY listens on loopback; ngrok makes the outgoing tunnel.
Do not bind CODEY to `0.0.0.0` as a troubleshooting shortcut.

## 6. Configure CODEY 3

In an interactive terminal in the CODEY3 checkout:

```powershell
npm.cmd run codey3:preview:init
```

Supply:

| Setup field | Value |
| --- | --- |
| Project roots | Exact approved absolute Windows paths; comma-separated for multiple folders |
| Port | **7679**, even if the inherited prompt suggests 7676 |
| Public base URL | The user's HTTPS ngrok origin, **without `/mcp`** |

The initializer generates a CODEY owner password. Keep it private; it lives in
`.codey3-preview/auth.json`. Never replace it with the ngrok token.

### If Codex cannot operate an interactive prompt

After the user has approved exact roots and the public URL, Codex may create
`.codey3-preview/config.json` using these fields, with actual local values:

```json
{
  "host": "127.0.0.1",
  "port": 7679,
  "allowedRoots": ["C:/Users/YourName/Projects/MyProject"],
  "publicBaseUrl": "https://YOUR-OWN-NGROK-HOST"
}
```

For a **new** setup only, generate `.codey3-preview/auth.json` locally as
`{"ownerToken":"<cryptographically random secret>"}` using Node's
`crypto.randomBytes(32).toString("base64url")`, creating the file exclusively
(`flag: "wx"`) and without printing the secret. Preserve an existing auth file.
Do not derive secrets from usernames, machine names, or the example text.
Restrict credential files to the current user's access using appropriate Windows
ACLs; Unix file modes alone do not enforce Windows ACLs.

Do not delete `.codey3-preview/state` during upgrades. It contains persistent
OAuth client registrations; losing them can cause `Invalid client_id`.

## 7. Start CODEY and check the local server

In the CODEY3 terminal:

```powershell
npm.cmd run codey3:preview
```

Keep it open alongside ngrok. In another terminal in the checkout:

```powershell
node scripts/codey3-launch.mjs doctor
curl.exe -i http://127.0.0.1:7679/healthz
curl.exe -i http://127.0.0.1:7679/mcp
```

Doctor should find a compatible Node, Git, Bash, and working SQLite dependency.
Doctor prints diagnostics; check their contents, not only its process exit code.
Health must return HTTP 200 with `{"ok":true,"name":"codey3"}`.
Unauthenticated `/mcp` must return **401**. This is expected protection.

Repeat those requests against the real public origin (replace the example):

```powershell
curl.exe -i -H "ngrok-skip-browser-warning: 1" https://YOUR-OWN-NGROK-HOST/healthz
curl.exe -i -H "ngrok-skip-browser-warning: 1" https://YOUR-OWN-NGROK-HOST/mcp
```

A local 200 proves only local startup. A public 200/401 pair proves reachability
and an authentication boundary, but not a working ChatGPT connector.

## 8. Connect ChatGPT

Use an account/workspace with custom MCP development access. Follow the
[current OpenAI connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt);
labels and availability can change. In the web UI, find Apps/Plugins and its
custom app creation control (developer mode may need enabling).

Create a distinctly named connection such as **CODEY 3 Windows**:

- Server URL: the exact public origin followed by **`/mcp`**.
- Authentication: **OAuth**, using discovery/default dynamic registration.
- Keep the security acknowledgment visible for the user to review and approve.

Let the user complete login, consent, and any warning requiring manual action.
The free ngrok browser notice may appear before CODEY's own authorization page.
On CODEY's page, approve with the **CODEY owner password**, not the ngrok token.
Codex can help copy the local password to the user's clipboard without displaying
it in chat, when authorized. Never disable OAuth to get past a connection error.

Select the new connector in a chat, then ask:

```text
Use CODEY 3 Windows to open C:/Users/YourName/Projects/MyProject in checkout mode.
List only the top-level file and folder names. Do not modify files.
```

Replace that path with a real approved folder. Require an actual successful
`open_workspace` result and a listing tool call; an assistant's claim alone is
not sufficient. Reuse its workspaceId for later calls in that folder. Test a
small README read and `show_changes` if available; verify the card renders.
The optional card is separate from successful filesystem access.

## 9. Everyday use and stopping

After setup, open two terminals:

```powershell
# Terminal 1 (any folder)
ngrok http http://127.0.0.1:7679
```

```powershell
# Terminal 2 (CODEY3 checkout)
npm.cmd run codey3:preview
```

Check that ngrok's URL still matches CODEY's saved public URL and ChatGPT's
connector URL. If it changed, use the recovery steps below before reconnecting.
Press **Ctrl+C in both terminals** to stop. Closing them, logging out, sleeping,
or shutting down can end availability. There is no automatic Windows service.
Codex may create a local shortcut for these commands once the first setup works;
a scheduled task/always-on service needs a separate user request.

## 10. Updating and changing folders

Stop CODEY, inspect `git status`, then update a clean checkout with:

```powershell
git pull --ff-only
npm.cmd ci
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:preview-startup
npm.cmd run codey3:preview
```

Preserve `.codey3-preview/`. Rebuild before expecting new UI/assets.
For new approved project folders, edit only `allowedRoots` in the local
`.codey3-preview/config.json` and restart CODEY. Preserve the host, port, URL,
owner password, and state. Do not add broad roots without the user's approval.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| `npm.ps1` cannot run | Use `npm.cmd`; keep execution policy unchanged. |
| Node unsupported or native-addon ABI error | Use supported Node 22 LTS, then reinstall locked dependencies with `npm.cmd ci`. |
| SQLite/native installation fails | Inspect the actual npm error. Allow required package install scripts if package-manager policy blocked them; `npm.cmd rebuild better-sqlite3` can retry after approval. If no matching prebuild exists, follow node-gyp's Windows prerequisites for Python and Visual Studio C++ Build Tools. |
| `bash` unavailable | Install standard Git for Windows including Git Bash, reopen terminals, rerun doctor. Do not treat WSL's bash stub as Git Bash. |
| `EADDRINUSE` | Inspect the process on 7679. Stop only a known CODEY instance; do not kill an unrelated process. Keep tunnel and server ports consistent. |
| ngrok authentication fails | Use this user's ngrok token locally and `ngrok config check`; account MFA is a user step. |
| Health works locally but not publicly | Check the tunnel process, destination port, network, and current URL. A blocked corporate network may require IT help. |
| `/mcp` returns 401 to curl | Expected without OAuth. Check the authenticated client separately. |
| `Invalid client_id` | Connector registration no longer matches server state. Preserve state; create a fresh connector registration against the correct URL. Repeatedly reconnecting the same stale registration may not help. |
| `open_workspace` gives an internal error, no server request appears | Inspect the connector's saved URL. It may still point to an obsolete tunnel. Confirm exact endpoint and reauthorize; do not expand folder permissions to fix a routing error. |
| Outside allowed roots / access denied | Use the exact Windows path and confirm the approved root plus Windows access permissions. Avoid synchronized/online-only folders. |
| Public URL changed | Run the command below, restart CODEY, and update/recreate the client connection if its URL cannot be edited. |
| UI card missing but tools work | Check the freshly built UI and the client's app support/metadata refresh. Report tool access and card rendering separately. |

```powershell
node scripts/codey3-launch.mjs config set publicBaseUrl https://YOUR-NEW-NGROK-HOST
```

### Completion report for Codex

Leave the user: checkout path, Node version, exact approved roots, public MCP URL,
connector name, start/stop commands, and evidence for install/build/tests, local
health + 401, public health + 401, authenticated workspace open + listing, and
optional rendered card. Mark incomplete stages honestly. Never include secrets.

Do not commit `.codey3-preview`, `.env`, passwords, tokens, logs, or SQLite state.
The repository's CI covers Linux, macOS, and Windows; a green Windows build does
not establish that this user's ngrok/ChatGPT account is connected. Only the final
live client check establishes that.
