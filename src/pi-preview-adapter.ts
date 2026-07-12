import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export {
  createBashTool,
  createEditTool,
  createFindTool,
  createGrepTool,
  createLsTool,
  createReadTool,
  createWriteTool,
} from "../node_modules/@earendil-works/pi-coding-agent/dist/core/tools/index.js";
export { loadSkills } from "../node_modules/@earendil-works/pi-coding-agent/dist/core/skills.js";

interface ProjectContextFile {
  path: string;
  content: string;
}

function contextFileFromDirectory(directory: string): ProjectContextFile | undefined {
  for (const filename of ["AGENTS.md", "AGENTS.MD", "CLAUDE.md", "CLAUDE.MD"]) {
    const path = join(directory, filename);
    if (!existsSync(path)) continue;
    try {
      return { path, content: readFileSync(path, "utf8") };
    } catch {
      // Match Pi's context discovery: unreadable optional files are skipped.
    }
  }
  return undefined;
}

export function loadProjectContextFiles(options: {
  cwd: string;
  agentDir: string;
}): ProjectContextFile[] {
  const cwd = resolve(options.cwd);
  const agentDir = resolve(options.agentDir);
  const files: ProjectContextFile[] = [];
  const seen = new Set<string>();
  const globalContext = contextFileFromDirectory(agentDir);
  if (globalContext) {
    files.push(globalContext);
    seen.add(globalContext.path);
  }

  const ancestors: ProjectContextFile[] = [];
  let directory = cwd;
  while (true) {
    const context = contextFileFromDirectory(directory);
    if (context && !seen.has(context.path)) {
      ancestors.unshift(context);
      seen.add(context.path);
    }
    const parent = resolve(directory, "..");
    if (parent === directory) break;
    directory = parent;
  }

  return [...files, ...ancestors];
}
