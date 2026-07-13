#!/usr/bin/env bash
set -euo pipefail

export PATH="/Users/joegarbarino/.local/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"

PROJECT="/Users/joegarbarino/Documents/CODEY3"
RUNTIME="$PROJECT/.codey3-preview"
CONFIG="$RUNTIME/config.json"
AUTH="$RUNTIME/auth.json"
RUN_DIR="$RUNTIME/run"
LOG_DIR="$RUNTIME/logs"
SERVER_PID_FILE="$RUN_DIR/server.pid"
TUNNEL_PID_FILE="$RUN_DIR/tunnel.pid"
SERVER_LOG="$LOG_DIR/server.log"
TUNNEL_LOG="$LOG_DIR/tunnel.log"
PORT="7679"
CHATGPT_URL="https://chatgpt.com/"

mkdir -p "$RUN_DIR" "$LOG_DIR"
cd "$PROJECT"

echo "Starting CODEY 3 Preview..."

fail() {
  echo
  echo "CODEY 3 could not start: $1"
  echo "Server log: $SERVER_LOG"
  echo "Tunnel log: $TUNNEL_LOG"
  read -r -p "Press Return to close this window..."
  exit 1
}

pid_is_running() {
  local pid_file="$1"
  [ -f "$pid_file" ] || return 1
  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

stop_recorded_process() {
  local pid_file="$1"
  if pid_is_running "$pid_file"; then
    local pid
    pid="$(cat "$pid_file")"
    kill "$pid" 2>/dev/null || true
    for _ in $(seq 1 20); do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.1
    done
  fi
  : > "$pid_file"
}

local_health() {
  curl -fsS --max-time 3 "http://127.0.0.1:${PORT}/healthz" 2>/dev/null \
    | grep -q '"name":"codey3"'
}

config_public_url() {
  node -e '
const fs = require("node:fs");
try {
  const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (typeof value.publicBaseUrl === "string") process.stdout.write(value.publicBaseUrl.replace(/\/$/, ""));
} catch {}
' "$CONFIG"
}

public_health() {
  local public_url="$1"
  [ -n "$public_url" ] || return 1
  curl -fsS --max-time 8 "${public_url}/healthz" 2>/dev/null \
    | grep -q '"name":"codey3"'
}

copy_owner_code() {
  [ -f "$AUTH" ] || fail "Missing isolated OAuth credentials at $AUTH"
  local owner_code
  owner_code="$(node -e '
const fs = require("node:fs");
const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (typeof value.ownerToken !== "string" || !value.ownerToken) process.exit(1);
process.stdout.write(value.ownerToken);
' "$AUTH")" || fail "Could not read CODEY 3's OAuth owner code."
  printf "%s" "$owner_code" | pbcopy || fail "Could not copy the OAuth owner code to the clipboard."
}

start_cloudflare_tunnel() {
  local protocol="${1:-}"
  : > "$TUNNEL_LOG"
  if [ -n "$protocol" ]; then
    nohup cloudflared tunnel --url "http://127.0.0.1:${PORT}" --no-autoupdate --protocol "$protocol" \
      > "$TUNNEL_LOG" 2>&1 &
  else
    nohup cloudflared tunnel --url "http://127.0.0.1:${PORT}" --no-autoupdate \
      > "$TUNNEL_LOG" 2>&1 &
  fi
  echo "$!" > "$TUNNEL_PID_FILE"
}

wait_for_cloudflare_connection() {
  public_url=""
  for _ in $(seq 1 35); do
    public_url="$(grep -Eo 'https://[a-z-]+\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1 || true)"
    if [ -n "$public_url" ] && grep -q "Registered tunnel connection" "$TUNNEL_LOG" 2>/dev/null; then
      return 0
    fi
    pid_is_running "$TUNNEL_PID_FILE" || return 1
    sleep 1
  done
  return 1
}

public_url="$(config_public_url)"
if local_health && public_health "$public_url"; then
  echo "CODEY 3 is already healthy; reusing its current tunnel."
else
  stop_recorded_process "$SERVER_PID_FILE"
  stop_recorded_process "$TUNNEL_PID_FILE"

  if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    fail "Port $PORT is already occupied by a process not owned by this launcher."
  fi

  command -v cloudflared >/dev/null 2>&1 || fail "cloudflared is not installed."
  command -v npm >/dev/null 2>&1 || fail "npm is not available."

  echo "Trying Cloudflare Quick Tunnel over automatic/QUIC transport..."
  start_cloudflare_tunnel
  if ! wait_for_cloudflare_connection; then
    echo "QUIC did not connect; retrying over HTTP/2..."
    stop_recorded_process "$TUNNEL_PID_FILE"
    start_cloudflare_tunnel "http2"
    wait_for_cloudflare_connection \
      || fail "Cloudflare QUIC and HTTP/2 transports are blocked. Disable the VPN/firewall restriction and run this shortcut again."
  fi

  node -e '
const fs = require("node:fs");
const path = process.argv[1];
const publicBaseUrl = process.argv[2];
const value = JSON.parse(fs.readFileSync(path, "utf8"));
value.publicBaseUrl = publicBaseUrl;
const temporary = `${path}.tmp`;
fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
fs.renameSync(temporary, path);
' "$CONFIG" "$public_url" || fail "Could not update CODEY 3's isolated public URL."

  : > "$SERVER_LOG"
  nohup npm run codey3:preview > "$SERVER_LOG" 2>&1 &
  echo "$!" > "$SERVER_PID_FILE"

  for _ in $(seq 1 45); do
    local_health && break
    pid_is_running "$SERVER_PID_FILE" || fail "The CODEY 3 preview server exited early."
    sleep 1
  done
  local_health || fail "The CODEY 3 preview did not become healthy on port $PORT."

  for _ in $(seq 1 60); do
    public_health "$public_url" && break
    pid_is_running "$TUNNEL_PID_FILE" || fail "The Cloudflare tunnel exited before becoming healthy."
    sleep 1
  done
  public_health "$public_url" || fail "The public CODEY 3 health check did not become ready."
fi

mcp_url="${public_url}/mcp"
copy_owner_code

echo
echo "CODEY 3 MCP URL:"
echo "  $mcp_url"
echo
echo "CODEY 3 OAuth owner code copied to your clipboard."
echo "Paste it when ChatGPT asks you to authorize the connector."
echo
echo "Note: free Cloudflare Quick Tunnel hostnames change after a reboot."
echo "This launcher automatically discovers the replacement URL and updates CODEY 3."

if [ "${CODEY3_LAUNCHER_NO_OPEN:-}" != "1" ]; then
  open -a "Google Chrome" "$CHATGPT_URL" >/dev/null 2>&1 || open "$CHATGPT_URL" >/dev/null 2>&1 || true
fi

echo
echo "This window can be closed; CODEY 3 will keep running."
sleep 3
