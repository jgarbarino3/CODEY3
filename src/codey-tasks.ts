import { randomUUID } from "node:crypto";
import { openDatabase, type DatabaseHandle } from "./db/client.js";
import type { ToolActivityInput, WorkspaceActivityEvent } from "./workspace-activity.js";

export type CodeyTaskStatus = "working" | "complete" | "attention" | "interrupted";

export interface CodeyTask {
  id: string;
  workspaceId: string;
  title: string;
  status: CodeyTaskStatus;
  summary?: string;
  startedAt: string;
  finishedAt?: string;
  version: number;
  events: WorkspaceActivityEvent[];
}

interface TaskRow {
  id: string;
  workspace_id: string;
  title: string;
  status: string;
  summary: string | null;
  started_at: string;
  finished_at: string | null;
  version: number;
}

interface EventRow {
  id: number;
  kind: string;
  status: string;
  title: string;
  path: string | null;
  additions: number | null;
  removals: number | null;
  duration_ms: number | null;
  created_at: string;
}

const MAX_TITLE = 120;
const MAX_SUMMARY = 240;
const MAX_TASKS = 20;
const MAX_EVENTS = 100;
const VALIDATION_COMMAND = /\b(test|build|typecheck|lint|verify|check)\b/i;

export class CodeyTaskStore {
  private readonly database: DatabaseHandle;

  constructor(stateDir: string) {
    this.database = openDatabase(stateDir);
  }

  start(workspaceId: string, title: string): CodeyTask {
    this.interruptActive(workspaceId);
    const id = `task_${randomUUID().replaceAll("-", "").slice(0, 10)}`;
    const now = new Date().toISOString();
    const safeTitle = safeText(title, MAX_TITLE, "Untitled task");
    this.database.sqlite.prepare(
      `insert into codey_tasks (id, workspace_id, title, status, started_at, version)
       values (?, ?, ?, 'working', ?, 1)`,
    ).run(id, workspaceId, safeTitle, now);
    this.appendEvent(id, {
      kind: "workspace",
      status: "working",
      title: `Started ${safeTitle}`,
    });
    this.prune(workspaceId);
    return this.get(id)!;
  }

  finish(workspaceId: string, outcome: "complete" | "attention", summary?: string): CodeyTask {
    const task = this.active(workspaceId);
    if (!task) throw new Error("No active CODEY task exists for this workspace.");
    const now = new Date().toISOString();
    const safeSummary = summary ? safeText(summary, MAX_SUMMARY) : undefined;
    this.database.sqlite.prepare(
      `update codey_tasks set status = ?, summary = ?, finished_at = ?, version = version + 1
       where id = ?`,
    ).run(outcome, safeSummary ?? null, now, task.id);
    this.appendEvent(task.id, {
      kind: "narration",
      status: outcome === "complete" ? "complete" : "blocked",
      title: safeSummary ?? (outcome === "complete" ? "Task complete" : "Task needs attention"),
    });
    return this.get(task.id)!;
  }

  record(workspaceId: string, input: ToolActivityInput): void {
    const task = this.active(workspaceId);
    if (!task || input.tool === "show_changes" || input.tool === "report_progress") return;
    const validation = Boolean(input.command && VALIDATION_COMMAND.test(input.command));
    const change = input.tool === "write" || input.tool === "edit" || input.tool === "apply_patch";
    const failure = !input.success;
    this.appendEvent(task.id, {
      kind: change ? "change" : validation ? "validate" : "inspect",
      status: failure ? "failure" : "success",
      title: failure
        ? validation ? "Validation needs attention" : change ? "Change needs attention" : "Workspace action needs attention"
        : validation ? "Ran validation" : change ? "Updated files" : "Inspected workspace",
      path: input.path ?? input.workingDirectory,
      additions: input.additions,
      removals: input.removals,
      durationMs: input.durationMs,
    });
  }

  active(workspaceId: string): CodeyTask | undefined {
    const row = this.database.sqlite.prepare(
      `select * from codey_tasks where workspace_id = ? and status = 'working'
       order by started_at desc limit 1`,
    ).get(workspaceId) as TaskRow | undefined;
    return row ? this.inflate(row) : undefined;
  }

  recent(workspaceId: string, limit = 6): CodeyTask[] {
    const rows = this.database.sqlite.prepare(
      `select * from codey_tasks where workspace_id = ? order by started_at desc limit ?`,
    ).all(workspaceId, Math.max(1, Math.min(limit, 20))) as TaskRow[];
    return rows.map((row) => this.inflate(row));
  }

  get(id: string): CodeyTask | undefined {
    const row = this.database.sqlite.prepare("select * from codey_tasks where id = ?")
      .get(id) as TaskRow | undefined;
    return row ? this.inflate(row) : undefined;
  }

  close(): void {
    this.database.close();
  }

  private interruptActive(workspaceId: string): void {
    const active = this.active(workspaceId);
    if (!active) return;
    const now = new Date().toISOString();
    this.database.sqlite.prepare(
      `update codey_tasks set status = 'interrupted', finished_at = ?, version = version + 1 where id = ?`,
    ).run(now, active.id);
    this.appendEvent(active.id, {
      kind: "narration",
      status: "blocked",
      title: "Task interrupted by a newer task",
    });
  }

  private appendEvent(taskId: string, event: Omit<WorkspaceActivityEvent, "id" | "createdAt">): void {
    this.database.sqlite.prepare(
      `insert into codey_task_events
       (task_id, kind, status, title, path, additions, removals, duration_ms, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      taskId,
      event.kind,
      event.status,
      safeText(event.title, MAX_SUMMARY, "Workspace update"),
      event.path ? safeText(event.path, MAX_SUMMARY) : null,
      event.additions ?? null,
      event.removals ?? null,
      event.durationMs ?? null,
      new Date().toISOString(),
    );
    this.database.sqlite.prepare("update codey_tasks set version = version + 1 where id = ?").run(taskId);
    const ids = this.database.sqlite.prepare(
      `select id from codey_task_events where task_id = ? order by id desc limit -1 offset ?`,
    ).all(taskId, MAX_EVENTS) as Array<{ id: number }>;
    if (ids.length > 0) {
      this.database.sqlite.prepare(
        `delete from codey_task_events where id in (${ids.map(() => "?").join(",")})`,
      ).run(...ids.map((row) => row.id));
    }
  }

  private inflate(row: TaskRow): CodeyTask {
    const events = this.database.sqlite.prepare(
      "select * from codey_task_events where task_id = ? order by id",
    ).all(row.id) as EventRow[];
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      title: row.title,
      status: readStatus(row.status),
      summary: row.summary ?? undefined,
      startedAt: row.started_at,
      finishedAt: row.finished_at ?? undefined,
      version: row.version,
      events: events.map((event) => ({
        id: `event-${event.id}`,
        kind: event.kind as WorkspaceActivityEvent["kind"],
        status: event.status as WorkspaceActivityEvent["status"],
        title: event.title,
        path: event.path ?? undefined,
        additions: event.additions ?? undefined,
        removals: event.removals ?? undefined,
        durationMs: event.duration_ms ?? undefined,
        createdAt: event.created_at,
      })),
    };
  }

  private prune(workspaceId: string): void {
    const rows = this.database.sqlite.prepare(
      `select id from codey_tasks where workspace_id = ? order by started_at desc limit -1 offset ?`,
    ).all(workspaceId, MAX_TASKS) as Array<{ id: string }>;
    for (const row of rows) {
      this.database.sqlite.prepare("delete from codey_tasks where id = ?").run(row.id);
    }
  }
}

function safeText(value: string, max: number, fallback = ""): string {
  const compact = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  const safe = compact || fallback;
  return safe.length > max ? `${safe.slice(0, max - 3)}...` : safe;
}

function readStatus(value: string): CodeyTaskStatus {
  return value === "complete" || value === "attention" || value === "interrupted" ? value : "working";
}
