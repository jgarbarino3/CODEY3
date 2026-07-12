import { loadConfig } from "../src/config.js";
import { createServer } from "../src/server.js";

const running = createServer(loadConfig());
const listener = running.app.listen(running.config.port, running.config.host, () => {
  console.log(`CODEY 3 Preview listening at http://${running.config.host}:${running.config.port}/mcp`);
  console.log(`Public MCP URL: ${new URL("/mcp", running.config.publicBaseUrl).toString()}`);
  console.log(`Allowed roots: ${running.config.allowedRoots.join(", ")}`);
  console.log(`Subagents: ${running.config.subagents ? "enabled" : "disabled"}`);
});

function shutdown(): void {
  listener.close(() => {
    running.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
