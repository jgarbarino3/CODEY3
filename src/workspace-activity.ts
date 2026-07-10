export type WorkspaceActivityKind =
  | "workspace"
  | "inspect"
  | "change"
  | "validate"
  | "narration";

export type WorkspaceActivityStatus =
  | "success"
  | "failure"
  | "working"
  | "blocked"
  | "complete";

export interface WorkspaceActivityEvent {
  id: string;
  kind: WorkspaceActivityKind;
  status: WorkspaceActivityStatus;
  title: string;
  path?: string;
  additions?: number;
  removals?: number;
  durationMs?: number;
  createdAt: string;
}

export interface WorkspaceActivitySnapshot {
  status: "complete" | "attention";
  events: WorkspaceActivityEvent[];
}

export interface ToolActivityInput {
  tool: string;
  workspaceId?: string;
  path?: string;
  workingDirectory?: string;
  command?: string;
  success: boolean;
  durationMs: number;
  additions?: number;
  removals?: number;
}

export interface WorkspaceActivityManager {
  initializeWorkspace(input: { workspaceId: string }): void;
  recordToolCall(input: ToolActivityInput): void;
  reportProgress(input: {
    workspaceId: string;
    status: "working" | "blocked" | "complete";
    summary: string;
  }): void;
  snapshot(input: { workspaceId: string; acknowledge?: boolean }): WorkspaceActivitySnapshot;
}

interface WorkspaceActivityState {
  events: WorkspaceActivityEvent[];
  lastShown: number;
  nextId: number;
}

const MAX_EVENTS_PER_WORKSPACE = 64;
const VALIDATION_COMMAND = /\b(test|build|typecheck|lint|verify|check)\b/i;

export function createWorkspaceActivityManager(): WorkspaceActivityManager {
  const states = new Map<string, WorkspaceActivityState>();

  function stateFor(workspaceId: string): WorkspaceActivityState {
    let state = states.get(workspaceId);
    if (!state) {
      state = { events: [], lastShown: 0, nextId: 1 };
      states.set(workspaceId, state);
    }
    return state;
  }

  function append(
    workspaceId: string,
    event: Omit<WorkspaceActivityEvent, "id" | "createdAt">,
  ): void {
    const state = stateFor(workspaceId);
    state.events.push({
      ...event,
      id: `activity-${state.nextId++}`,
      createdAt: new Date().toISOString(),
    });

    const excess = state.events.length - MAX_EVENTS_PER_WORKSPACE;
    if (excess > 0) {
      state.events.splice(0, excess);
      state.lastShown = Math.max(0, state.lastShown - excess);
    }
  }

  return {
    initializeWorkspace({ workspaceId }) {
      const state = stateFor(workspaceId);
      if (state.events.length > 0) return;
      append(workspaceId, {
        kind: "workspace",
        status: "success",
        title: "Opened workspace",
      });
    },

    recordToolCall(input) {
      if (!input.workspaceId || input.tool === "show_changes" || input.tool === "report_progress") return;

      const mapped = mapToolCall(input);
      append(input.workspaceId, mapped);
    },

    reportProgress({ workspaceId, status, summary }) {
      append(workspaceId, {
        kind: "narration",
        status,
        title: safeSummary(summary),
      });
    },

    snapshot({ workspaceId, acknowledge = false }) {
      const state = stateFor(workspaceId);
      const events = state.events.slice(state.lastShown);
      if (acknowledge) state.lastShown = state.events.length;
      return {
        status: events.some((event) => event.status === "failure" || event.status === "blocked")
          ? "attention"
          : "complete",
        events,
      };
    },
  };
}

function mapToolCall(input: ToolActivityInput): Omit<WorkspaceActivityEvent, "id" | "createdAt"> {
  const failure = !input.success;
  const action = actionForTool(input.tool, input.command);
  const kind = kindForTool(input.tool, input.command);

  return {
    kind,
    status: failure ? "failure" : "success",
    title: failure ? `${action} needs attention` : action,
    path: input.path ?? input.workingDirectory,
    additions: input.additions,
    removals: input.removals,
    durationMs: input.durationMs,
  };
}

function actionForTool(tool: string, command?: string): string {
  if (tool === "open_workspace") return "Opened workspace";
  if (tool === "read") return "Read project context";
  if (tool === "grep" || tool === "glob" || tool === "ls") return "Inspected workspace";
  if (tool === "write") return "Created file";
  if (tool === "edit" || tool === "apply_patch") return "Updated files";
  if (tool === "exec_command" || tool === "bash" || tool === "write_stdin") {
    return command && VALIDATION_COMMAND.test(command)
      ? "Ran validation"
      : "Ran workspace command";
  }
  return "Completed workspace action";
}

function kindForTool(tool: string, command?: string): WorkspaceActivityKind {
  if (tool === "open_workspace") return "workspace";
  if (tool === "read" || tool === "grep" || tool === "glob" || tool === "ls") return "inspect";
  if (tool === "write" || tool === "edit" || tool === "apply_patch") return "change";
  if (tool === "exec_command" || tool === "bash" || tool === "write_stdin") {
    return command && VALIDATION_COMMAND.test(command) ? "validate" : "inspect";
  }
  return "inspect";
}

function safeSummary(summary: string): string {
  const compact = summary.replace(/\s+/g, " ").trim();
  if (!compact) return "Progress update";
  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}
