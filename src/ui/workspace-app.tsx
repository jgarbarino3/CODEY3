import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  isEditTool,
  isExpandableCard,
  isPatchTool,
  isReadTool,
  isReviewTool,
  isSearchTool,
  isShellTool,
  isToolName,
  isToolResultCard,
  isWriteTool,
  payloadText,
  summaryNumber,
  type HostContext,
  type PatchOperation,
  type ToolName,
  type ToolResultCard,
} from "./card-types.js";
import { getPatchDisplayParts } from "./patch-display.js";
import "./workspace-app.css";

interface ToolDisplay {
  icon: string;
  title: string;
  label: string;
  tone: string;
}

interface MountedPayload {
  update(options: {
    card: ToolResultCard;
    hostContext?: HostContext;
    errorMessage?: string | null;
    visibleFileCount?: number;
  }): void;
  unmount(): void;
}

let app: App | null = null;
let connected = false;
let connectionError: string | null = null;
let hostContext: HostContext | undefined;
let card: ToolResultCard | null = null;
let expanded = false;
let reviewFilesExpanded = false;
let reviewDetailsExpanded = false;
let errorMessage: string | null = null;
let currentPayload: MountedPayload | null = null;
let currentPayloadContainer: HTMLElement | null = null;
let dashboardPollTimer: number | null = null;
let dashboardPollFailures = 0;

const maybeAppRoot = document.querySelector<HTMLElement>("#app");

if (!maybeAppRoot) {
  throw new Error("Missing #app root element.");
}

const appRoot = maybeAppRoot;

void boot();

async function boot(): Promise<void> {
  render();

  app = new App(
    { name: "devspace-tool-cards", version: "0.4.0" },
    {},
  );

  app.ontoolresult = (result) => {
    const structuredContent = getStructuredContent<Partial<ToolResultCard>>(result);
    const metaCard = cardFromMeta(result);
    const structured = metaCard
      ? { ...structuredContent, ...metaCard }
      : structuredContent;
    const tool = toolNameFromMeta(result);

    if (!tool || !isToolResultCard(structured)) {
      card = null;
      expanded = false;
      reviewFilesExpanded = false;
      reviewDetailsExpanded = false;
      errorMessage = "No result card is available for this tool result.";
      render();
      return;
    }

    card = { ...structured, tool };
    expanded = false;
    reviewFilesExpanded = false;
    reviewDetailsExpanded = false;
    errorMessage = null;
    render();
  };

  app.onhostcontextchanged = (ctx) => {
    hostContext = {
      ...hostContext,
      ...ctx,
    };
    applyHostContext();
    renderPayloadIfNeeded();
    syncDashboardPolling();
  };

  app.onteardown = async () => {
    stopDashboardPolling();
    unmountPayload();
    return {};
  };

  try {
    await app.connect();
    const initialContext = app.getHostContext();
    if (initialContext) hostContext = initialContext;
    applyHostContext();
    connected = true;
  } catch (connectError) {
    connectionError = connectError instanceof Error
      ? connectError.message
      : String(connectError);
  }

  render();
}

function applyHostContext(): void {
  if (hostContext?.theme) applyDocumentTheme(hostContext.theme);
  if (hostContext?.styles?.variables) {
    applyHostStyleVariables(hostContext.styles.variables);
  }
  if (hostContext?.styles?.css?.fonts) {
    applyHostFonts(hostContext.styles.css.fonts);
  }

  const insets = hostContext?.safeAreaInsets;
  if (!insets) return;

  document.body.style.padding = `${insets.top}px ${insets.right}px ${insets.bottom}px ${insets.left}px`;
}

function render(): void {
  unmountPayload();

  if (connectionError) {
    renderEmpty(connectionError, "error");
    return;
  }

  if (!connected) {
    renderEmpty("Connecting to host...");
    return;
  }

  if (!card) {
    renderEmpty(errorMessage ?? "Waiting for a tool result.", errorMessage ? "error" : "muted");
    return;
  }

  const display = getToolDisplay(card);
  if (isReviewTool(card.tool)) {
    renderReviewCard(card, display);
    return;
  }

  const expandable = isExpandableCard(card);
  const main = element("main", { className: "shell" });
  const section = element("section", { className: `tool-card ${display.tone}` });
  const button = element("button", {
    className: "tool-header",
    type: "button",
    ariaExpanded: String(expanded),
    disabled: !expandable,
  });

  if (expandable) {
    button.addEventListener("click", () => {
      expanded = !expanded;
      render();
    });
  }

  const icon = element("span", { className: "tool-icon", ariaHidden: "true" });
  icon.innerHTML = display.icon;

  const toolMain = element("span", { className: "tool-main" });
  const title = element("span", { className: "tool-title", text: display.title });
  const label = element("span", {
    className: "tool-label",
    text: display.label,
    title: display.label,
  });
  toolMain.append(title, label);

  button.append(
    icon,
    toolMain,
    renderSummaryBadge(card),
    renderChevron(expanded, expandable),
  );
  section.append(button);

  if (expanded) {
    const body = element("div", { className: "tool-body" });
    currentPayloadContainer = body;
    section.append(body);
  }

  main.append(section);
  appRoot.replaceChildren(main);
  renderPayloadIfNeeded();
}

function renderEmpty(message: string, tone: "muted" | "error" = "muted"): void {
  const main = element("main", { className: "shell" });
  main.append(element("section", { className: `empty ${tone}`, text: message }));
  appRoot.replaceChildren(main);
}

async function renderPayloadIfNeeded(): Promise<void> {
  if (!card || !currentPayloadContainer || (!expanded && !isReviewTool(card.tool))) return;
  if (isReviewTool(card.tool) && !reviewDetailsExpanded) return;

  const target = currentPayloadContainer;

  if (errorMessage) {
    renderStatus(target, errorMessage, "error");
    return;
  }

  if (card.tool === "open_workspace") {
    renderPrePayload(target, workspacePayloadText(card), "open_workspace");
    return;
  }

  if (shouldUseHeavyPayload(card)) {
    if (currentPayload) {
      currentPayload.update({ card, hostContext, errorMessage });
      return;
    }

    setPayloadLoading(target, true);

    try {
      const { mountHeavyPayload } = await import("./heavy-payload.js");
      if (target !== currentPayloadContainer || (!expanded && !isReviewTool(card.tool)) || !card) return;

      setPayloadLoading(target, false);
      currentPayload = mountHeavyPayload(target, {
        card,
        hostContext,
        errorMessage,
      });
    } catch (loadError) {
      if (target !== currentPayloadContainer || (!expanded && !isReviewTool(card.tool))) return;

      setPayloadLoading(target, false);
      renderStatus(
        target,
        loadError instanceof Error ? loadError.message : "Unable to load details.",
        "error",
      );
    }
    return;
  }

  if (isReviewTool(card.tool) || isPatchTool(card.tool)) {
    const visibleFileCount = isReviewTool(card.tool) && !reviewFilesExpanded
      ? Math.max(3, (card.files ?? []).slice(0, 3).length)
      : undefined;

    if (currentPayload) {
      currentPayload.update({ card, hostContext, errorMessage, visibleFileCount });
      return;
    }

    renderStatus(target, isReviewTool(card.tool) ? "Loading review..." : "Loading diff...");

    const { mountReviewPayload } = await import("./review-payload.js");
    if (target !== currentPayloadContainer || !card) return;

    currentPayload = mountReviewPayload(target, {
      card,
      hostContext,
      errorMessage,
      visibleFileCount,
    });
    return;
  }

  const text = payloadText(card.payload);
  if (!text) {
    renderStatus(target, "No details available.");
    return;
  }

  renderPrePayload(target, text, card.tool);
}

function shouldUseHeavyPayload(card: ToolResultCard): boolean {
  return isReadTool(card.tool) || isEditTool(card.tool) || isWriteTool(card.tool);
}

function unmountPayload(): void {
  unmountCurrentPayload();
  currentPayload = null;
  currentPayloadContainer = null;
}

function unmountCurrentPayload(): void {
  currentPayload?.unmount();
  currentPayload = null;
}

function renderStatus(
  container: HTMLElement,
  message: string,
  tone: "muted" | "error" = "muted",
): void {
  unmountCurrentPayload();
  container.replaceChildren(element("div", { className: `status ${tone}`, text: message }));
}

function renderPrePayload(
  container: HTMLElement,
  text: string,
  tool: string,
): void {
  unmountCurrentPayload();
  container.replaceChildren(element("pre", { className: `text-payload ${tool}`, text }));
}

function renderSummaryBadge(card: ToolResultCard): HTMLElement {
  const summary = card.summary ?? {};

  if (isReviewTool(card.tool)) {
    const stats = element("span", { className: "stats" });
    stats.setAttribute("aria-label", "Review diff statistics");
    stats.append(
      element("span", { className: "add", text: `+${String(summary.additions ?? 0)}` }),
      element("span", { className: "remove", text: `-${String(summary.removals ?? 0)}` }),
    );
    return stats;
  }

  if (isPatchTool(card.tool) || isEditTool(card.tool) || isWriteTool(card.tool)) {
    const stats = element("span", { className: "stats" });
    stats.setAttribute("aria-label", "Diff statistics");
    stats.append(
      element("span", { className: "add", text: `+${String(summary.additions ?? 0)}` }),
      element("span", { className: "remove", text: `-${String(summary.removals ?? 0)}` }),
    );
    return stats;
  }

  if (card.tool === "open_workspace") {
    const agentsFiles = summaryNumber(summary, "agentsFiles") ?? 0;
    const skills = summaryNumber(summary, "skills") ?? 0;
    const group = element("span", { className: "badge-group" });
    group.setAttribute("aria-label", "Workspace summary");

    const agentsBadge = element("span", {
      className: `badge ${agentsFiles > 0 ? "success" : "muted"}`,
      text: agentsFiles > 0 ? "AGENTS.md" : "No AGENTS.md",
    });
    if (agentsFiles > 0) {
      agentsBadge.insertAdjacentHTML("afterbegin", checkCircleIcon());
    }

    group.append(agentsBadge, element("span", { className: "badge", text: `${skills} skills` }));
    return group;
  }

  if (isShellTool(card.tool)) {
    const state = summary.running === true ? "running" : "ran";
    return element("span", {
      className: "badge",
      text: `${state} · ${String(summary.lines ?? 0)} lines`,
    });
  }

  if (isSearchTool(card.tool)) {
    return element("span", { className: "badge", text: `${String(summary.lines ?? 0)} lines` });
  }

  return element("span", { className: "badge", text: `${String(summary.lines ?? 0)} lines` });
}

function renderReviewCard(card: ToolResultCard, display: ToolDisplay): void {
  unmountPayload();

  const files = card.files ?? [];
  const summary = card.summary ?? {};
  const activity = card.activity;
  const events = activity?.events ?? [];
  const visibleFiles = reviewFilesExpanded ? files : files.slice(0, 3);
  const hiddenCount = Math.max(0, files.length - visibleFiles.length);
  const main = element("main", { className: "shell" });
  const section = element("section", { className: "tool-card review codex-activity-card" });
  const header = element("div", { className: "review-header codex-activity-header" });
  const icon = element("span", { className: "tool-icon", ariaHidden: "true" });
  icon.innerHTML = display.icon;
  const titleGroup = element("div", { className: "review-title-group" });

  titleGroup.append(
    element("span", { className: "tool-title", text: "Codey activity" }),
    element("span", {
      className: "tool-label",
      text: activity?.status === "attention" ? "Review needs attention" : "Workspace activity and changes",
      title: display.label,
    }),
  );
  const completion = element("span", {
    className: `activity-status ${activity?.status === "attention" ? "attention" : "complete"}`,
    text: activity?.status === "attention" ? "Needs attention" : "Complete",
  });
  header.append(icon, titleGroup, completion, renderSummaryBadge(card));

  const activityBody = element("div", { className: "activity-body" });
  if (events.length === 0) {
    activityBody.append(element("div", {
      className: "activity-empty",
      text: "Changes are ready. This workspace did not send milestone updates for this turn.",
    }));
  } else {
    const timeline = element("ol", { className: "activity-timeline" });
    timeline.setAttribute("aria-label", "Workspace activity");
    events.forEach((event) => timeline.append(renderActivityEvent(event)));
    activityBody.append(timeline);
  }

  if (visibleFiles.length > 0) {
    const changedFiles = element("div", { className: "activity-files" });
    changedFiles.append(element("div", { className: "activity-files-title", text: "Changed files" }));
    const list = element("ul", { className: "activity-file-list" });
    visibleFiles.forEach((file) => list.append(renderActivityFile(file)));
    changedFiles.append(list);
    activityBody.append(changedFiles);
  }

  const actions = element("div", { className: "review-actions" });
  const fullscreenSupported = hostContext?.availableDisplayModes?.includes("fullscreen") ?? true;
  if (fullscreenSupported) {
    const expand = element("button", {
      className: "review-action primary",
      type: "button",
      text: hostContext?.displayMode === "fullscreen" ? "Exit fullscreen" : "Open workspace",
    });
    expand.addEventListener("click", async () => {
      if (!app) return;
      const mode = hostContext?.displayMode === "fullscreen" ? "inline" : "fullscreen";
      try {
        const result = await app.requestDisplayMode({ mode });
        hostContext = { ...hostContext, displayMode: result.mode };
        render();
        syncDashboardPolling();
      } catch (requestError) {
        errorMessage = requestError instanceof Error ? requestError.message : String(requestError);
        render();
      }
    });
    actions.append(expand);
  }
  if (card.payload?.patch || files.length > 0) {
    const details = element("button", {
      className: "review-action detail-toggle",
      type: "button",
      text: reviewDetailsExpanded ? "Hide raw diff" : "View raw diff",
      ariaExpanded: String(reviewDetailsExpanded),
    });
    details.addEventListener("click", () => {
      reviewDetailsExpanded = !reviewDetailsExpanded;
      render();
    });
    actions.append(details);
  }
  if (hiddenCount > 0) {
    const showMore = element("button", {
      className: "review-action",
      type: "button",
      text: `Show ${hiddenCount} more ${hiddenCount === 1 ? "file" : "files"}`,
    });
    showMore.addEventListener("click", () => {
      reviewFilesExpanded = true;
      render();
    });
    actions.append(showMore);
  }

  section.append(header, activityBody);
  if (hostContext?.displayMode === "fullscreen") {
    section.classList.add("fullscreen-workspace");
    activityBody.prepend(renderDashboard(card));
  }
  if (reviewDetailsExpanded) {
    const details = element("div", { className: "review-summary raw-diff-details" });
    currentPayloadContainer = details;
    section.append(details);
  }
  if (actions.childElementCount > 0) {
    section.append(actions);
  }

  main.append(section);
  appRoot.replaceChildren(main);
  renderPayloadIfNeeded();
  syncDashboardPolling();
}

function renderDashboard(card: ToolResultCard): HTMLElement {
  const dashboard = card.dashboard;
  const workspace = element("div", { className: "codey-dashboard" });
  const topbar = element("div", { className: "codey-dashboard-topbar" });
  const identity = element("div", { className: "codey-dashboard-identity" });
  identity.append(
    element("strong", { text: dashboard?.currentTask?.title ?? "CODEY workspace" }),
    element("span", {
      text: [dashboard?.repository?.name, dashboard?.repository?.branch].filter(Boolean).join(" · ") || "Connected workspace",
    }),
  );
  const freshness = element("span", {
    className: `dashboard-freshness ${dashboardPollFailures > 0 ? "stale" : "live"}`,
    text: dashboardPollFailures > 0 ? "Reconnecting" : "Live",
  });
  topbar.append(identity, freshness);

  const grid = element("div", { className: "codey-dashboard-grid" });
  const tree = element("aside", { className: "codey-tree" });
  tree.append(element("div", { className: "dashboard-section-title", text: "Workspace" }));
  const treeList = element("div", { className: "codey-tree-list", text: "Loading repository metadata…" });
  tree.append(treeList);
  void loadWorkspaceTree(card.workspaceId, treeList);

  const recent = element("aside", { className: "codey-recent" });
  recent.append(element("div", { className: "dashboard-section-title", text: "Recent tasks" }));
  const recentList = element("ol", { className: "codey-recent-list" });
  const tasks = dashboard?.recentTasks ?? [];
  if (tasks.length === 0) {
    recentList.append(element("li", { className: "muted", text: "No prior task summaries" }));
  } else {
    tasks.forEach((task) => {
      const row = element("li", { className: `recent-task ${task.status ?? "working"}` });
      row.append(element("span", { text: task.title ?? "Untitled task" }), element("small", { text: task.status ?? "working" }));
      recentList.append(row);
    });
  }
  recent.append(recentList);
  grid.append(tree, recent);
  workspace.append(topbar, grid);
  return workspace;
}

async function loadWorkspaceTree(workspaceId: string | undefined, container: HTMLElement): Promise<void> {
  if (!app || !workspaceId || container.dataset.loaded === "true") return;
  container.dataset.loaded = "true";
  try {
    const result = await app.callServerTool({ name: "list_workspace_entries", arguments: { workspaceId } });
    const structured = getStructuredContent<{ listing?: { entries?: Array<{ name?: string; type?: string; changed?: boolean }> } }>(result);
    const entries = structured?.listing?.entries ?? [];
    container.replaceChildren(...entries.slice(0, 40).map((entry) => {
      const row = element("div", { className: `codey-tree-row ${entry.changed ? "changed" : ""}` });
      row.append(
        element("span", { className: "tree-kind", text: entry.type === "directory" ? "⌄" : "·", ariaHidden: "true" }),
        element("span", { text: entry.name ?? "Unnamed" }),
        entry.changed ? element("span", { className: "tree-change", text: "M" }) : element("span"),
      );
      return row;
    }));
  } catch {
    container.textContent = "Repository metadata unavailable";
  }
}

function syncDashboardPolling(): void {
  const shouldPoll = hostContext?.displayMode === "fullscreen" && document.visibilityState === "visible" && Boolean(card?.workspaceId);
  if (!shouldPoll) {
    stopDashboardPolling();
    return;
  }
  if (dashboardPollTimer !== null) return;
  dashboardPollTimer = window.setTimeout(() => void pollDashboard(), 5_000);
}

async function pollDashboard(): Promise<void> {
  dashboardPollTimer = null;
  if (!app || !card?.workspaceId || hostContext?.displayMode !== "fullscreen" || document.visibilityState !== "visible") return;
  try {
    const result = await app.callServerTool({
      name: "get_workspace_dashboard",
      arguments: { workspaceId: card.workspaceId, cursor: card.dashboard?.cursor },
    });
    const structured = getStructuredContent<{ dashboard?: ToolResultCard["dashboard"] }>(result);
    if (structured?.dashboard && !structured.dashboard.unchanged) card = { ...card, dashboard: structured.dashboard };
    dashboardPollFailures = 0;
    render();
  } catch {
    dashboardPollFailures += 1;
  }
  const delay = Math.min(30_000, 5_000 * 2 ** Math.min(dashboardPollFailures, 3));
  dashboardPollTimer = window.setTimeout(() => void pollDashboard(), delay);
}

function stopDashboardPolling(): void {
  if (dashboardPollTimer !== null) window.clearTimeout(dashboardPollTimer);
  dashboardPollTimer = null;
}

document.addEventListener("visibilitychange", syncDashboardPolling);

function renderActivityEvent(
  event: NonNullable<NonNullable<ToolResultCard["activity"]>["events"]>[number],
): HTMLElement {
  const item = element("li", { className: `activity-event ${event.kind ?? "inspect"} ${event.status ?? "success"}` });
  const marker = element("span", { className: "activity-marker", ariaHidden: "true" });
  marker.innerHTML = activityIcon(event.kind ?? "inspect", event.status ?? "success");
  const content = element("div", { className: "activity-event-content" });
  content.append(element("div", { className: "activity-event-title", text: event.title ?? "Workspace update" }));
  const meta = element("div", { className: "activity-event-meta" });
  if (event.path) meta.append(element("span", { className: "activity-event-path", text: event.path, title: event.path }));
  if (typeof event.additions === "number" || typeof event.removals === "number") {
    const stats = element("span", { className: "activity-event-stats" });
    stats.append(
      element("span", { className: "add", text: `+${String(event.additions ?? 0)}` }),
      element("span", { className: "remove", text: `-${String(event.removals ?? 0)}` }),
    );
    meta.append(stats);
  }
  if (typeof event.durationMs === "number" && event.durationMs >= 250) {
    meta.append(element("span", { className: "activity-event-duration", text: formatDuration(event.durationMs) }));
  }
  if (meta.childElementCount > 0) content.append(meta);
  item.append(marker, content);
  return item;
}

function renderActivityFile(file: NonNullable<ToolResultCard["files"]>[number]): HTMLElement {
  const item = element("li", { className: "activity-file" });
  const path = file.previousPath ? `${file.previousPath} → ${file.path ?? "renamed file"}` : file.path ?? "Unnamed file";
  item.append(element("span", { className: "activity-file-path", text: path, title: path }));
  const stats = element("span", { className: "activity-file-stats" });
  stats.append(
    element("span", { className: "add", text: `+${String(file.additions ?? 0)}` }),
    element("span", { className: "remove", text: `-${String(file.removals ?? 0)}` }),
  );
  item.append(stats);
  return item;
}

function formatDuration(durationMs: number): string {
  return durationMs >= 1_000 ? `${(durationMs / 1_000).toFixed(durationMs >= 10_000 ? 0 : 1)}s` : `${durationMs}ms`;
}

function activityIcon(kind: string, status: string): string {
  if (status === "failure" || status === "blocked") {
    return iconSvg('<path d="M12 8v4m0 4h.01M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />');
  }
  if (kind === "change") return iconSvg('<path d="M4 20h4l10.5-10.5a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" />');
  if (kind === "validate") return iconSvg('<path d="m5 12 4 4L19 6" />');
  if (kind === "narration") return iconSvg('<path d="M4 5h16v11H8l-4 3V5Z" />');
  if (kind === "workspace") return iconSvg('<path d="M4 5h16v14H4z" /><path d="M8 3v4m8-4v4M7 11h10M7 15h6" />');
  return iconSvg('<path d="m10.5 10.5 3 3m0-3-3 3M5 4h10l4 4v12H5z" />');
}

function renderChevron(isExpanded: boolean, visible: boolean): HTMLElement {
  const chevron = element("span", {
    className: visible ? `chevron ${isExpanded ? "expanded" : ""}` : "chevron",
    ariaHidden: "true",
  });

  if (visible) {
    chevron.innerHTML = iconSvg('<path d="m6 9 6 6 6-6" />');
  }

  return chevron;
}

function setPayloadLoading(container: HTMLElement, loading: boolean): void {
  const header = container.previousElementSibling;
  const chevron = header?.querySelector<HTMLElement>(".chevron");
  if (!chevron) return;

  chevron.classList.toggle("loading", loading);
  chevron.innerHTML = loading
    ? iconSvg('<circle cx="12" cy="12" r="8" />')
    : iconSvg('<path d="m6 9 6 6 6-6" />');

  const button = header instanceof HTMLButtonElement ? header : null;
  if (button) button.setAttribute("aria-busy", String(loading));
}

function workspacePayloadText(card: ToolResultCard): string {
  const agentsFiles = card.agentsFiles ?? [];
  const availableAgentsFiles = card.availableAgentsFiles ?? [];
  const skills = card.skills ?? [];
  const lines = [
    card.workspaceId ? `Workspace: ${card.workspaceId}` : undefined,
    card.root ? `Root: ${card.root}` : undefined,
    skills.length > 0
      ? `Skills: ${skills.map((skill) => skill.name ?? skill.path ?? "unnamed").join(", ")}`
      : "Skills: none",
    availableAgentsFiles.length > 0
      ? `Nested instructions: ${availableAgentsFiles.map((file) => file.path ?? "unknown").join(", ")}`
      : undefined,
    agentsFiles.length > 0
      ? `\n${formatAgentsFilesForPayload(agentsFiles)}`
      : "\nAGENTS.md: none loaded",
  ].filter((line): line is string => typeof line === "string");

  return lines.join("\n");
}

function formatAgentsFilesForPayload(
  agentsFiles: NonNullable<ToolResultCard["agentsFiles"]>,
): string {
  return agentsFiles
    .map((file) => {
      const path = file.path ?? "AGENTS.md";
      const content = file.content?.trim();
      return content ? `${path}\n\n${content}` : `${path}\n\nNo content loaded.`;
    })
    .join("\n\n");
}

function getPatchToolDisplay(card: ToolResultCard, label: string): ToolDisplay {
  const display = getPatchDisplayParts(card);

  return {
    icon: patchIcon(display.iconOperation),
    title: display.title,
    label,
    tone: display.tone,
  };
}

function patchIcon(operation: PatchOperation | undefined): string {
  if (operation === "add") return filePlusIcon();
  if (operation === "delete") return fileIcon();
  if (operation === "move") return filesIcon();
  return editIcon();
}

function getToolDisplay(card: ToolResultCard): ToolDisplay {
  const label = getToolLabel(card);

  switch (card.tool) {
    case "open_workspace":
      return { icon: folderIcon(), title: "Workspace", label, tone: "workspace" };
    case "read":
      return { icon: fileIcon(), title: "Read File", label, tone: "read" };
    case "write":
      return { icon: filePlusIcon(), title: "Write File", label, tone: "write" };
    case "edit":
      return { icon: editIcon(), title: "Edit File", label, tone: "edit" };
    case "apply_patch":
      return getPatchToolDisplay(card, label);
    case "grep":
      return { icon: searchIcon(), title: "Grep", label, tone: "search" };
    case "glob":
      return { icon: filesIcon(), title: "Glob", label, tone: "search" };
    case "ls":
      return { icon: listIcon(), title: "List Directory", label, tone: "directory" };
    case "bash":
      return { icon: terminalIcon(), title: "Bash", label, tone: "shell" };
    case "exec_command":
      return { icon: terminalIcon(), title: "Exec Command", label, tone: "shell" };
    case "write_stdin":
      return { icon: terminalIcon(), title: "Process Session", label, tone: "shell" };
    case "show_changes":
      return { icon: reviewIcon(), title: "Show Changes", label, tone: "review" };
  }
}

function getToolLabel(card: ToolResultCard): string {
  if (isShellTool(card.tool)) {
    return String(card.summary?.command ?? card.summary?.sessionId ?? card.path ?? card.tool);
  }
  if (isReviewTool(card.tool)) {
    const count = Number(card.summary?.files ?? card.files?.length ?? 0);
    return count === 0 ? "No changes since last review" : `${count} changed ${count === 1 ? "file" : "files"}`;
  }
  if (card.path) return card.path;
  if (card.root) return card.root;
  if (isSearchTool(card.tool)) {
    return String(card.summary?.pattern ?? card.tool);
  }

  return card.tool;
}

function toolNameFromMeta(result: CallToolResult): ToolName | undefined {
  const meta = result._meta as Record<string, unknown> | undefined;
  const tool = meta?.tool;
  return isToolName(tool) ? tool : undefined;
}

function cardFromMeta(result: CallToolResult): Partial<ToolResultCard> | undefined {
  const meta = result._meta as Record<string, unknown> | undefined;
  const metaCard = meta?.card;
  return metaCard && typeof metaCard === "object" ? metaCard : undefined;
}

function getStructuredContent<T>(result: CallToolResult): T | undefined {
  return result.structuredContent as T | undefined;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: {
    className?: string;
    text?: string;
    type?: string;
    title?: string;
    ariaHidden?: string;
    ariaExpanded?: string;
    disabled?: boolean;
  } = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.type !== undefined && "type" in node) node.setAttribute("type", options.type);
  if (options.title !== undefined) node.title = options.title;
  if (options.ariaHidden !== undefined) node.setAttribute("aria-hidden", options.ariaHidden);
  if (options.ariaExpanded !== undefined) node.setAttribute("aria-expanded", options.ariaExpanded);
  if (options.disabled !== undefined && "disabled" in node) {
    (node as HTMLButtonElement).disabled = options.disabled;
  }
  return node;
}

function iconSvg(children: string): string {
  return `<svg aria-hidden="true" class="icon-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8">${children}</svg>`;
}

function folderIcon(): string {
  return iconSvg('<path d="M3 7.5h6l2 2h10" /><path d="M3 7.5v10A2.5 2.5 0 0 0 5.5 20h13a2.5 2.5 0 0 0 2.5-2.5v-8H3" />');
}

function fileIcon(): string {
  return iconSvg('<path d="M14 3v5h5" /><path d="M6 3h8l5 5v13H6z" /><path d="M9 13h6" /><path d="M9 17h4" />');
}

function filePlusIcon(): string {
  return iconSvg('<path d="M14 3v5h5" /><path d="M6 3h8l5 5v13H6z" /><path d="M12 12v6" /><path d="M9 15h6" />');
}

function editIcon(): string {
  return iconSvg('<path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4" />');
}

function searchIcon(): string {
  return iconSvg('<circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" />');
}

function filesIcon(): string {
  return iconSvg('<path d="M8 7V4h9l4 4v10h-3" /><path d="M12 4v5h5" /><path d="M4 7h9l4 4v10H4z" /><path d="M13 7v5h4" />');
}

function checkCircleIcon(): string {
  return '<svg aria-hidden="true" class="badge-icon" fill="none" viewBox="0 0 16 16" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="8" cy="8" r="6" /><path d="m5.5 8 1.7 1.7 3.4-3.5" /></svg>';
}

function listIcon(): string {
  return iconSvg('<path d="M8 6h12" /><path d="M8 12h12" /><path d="M8 18h12" /><path d="M4 6h.01" /><path d="M4 12h.01" /><path d="M4 18h.01" />');
}

function terminalIcon(): string {
  return iconSvg('<path d="m5 7 5 5-5 5" /><path d="M12 17h7" />');
}

function reviewIcon(): string {
  return iconSvg('<path d="M5 4h14v16H5z" /><path d="M8 8h8" /><path d="M8 12h5" /><path d="M8 16h7" />');
}
