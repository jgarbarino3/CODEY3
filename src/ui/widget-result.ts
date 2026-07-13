import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  isToolName,
  isToolResultCard,
  type ToolResultCard,
} from "./card-types.js";

export interface OpenAiToolGlobals {
  toolOutput?: unknown;
  toolResponseMetadata?: unknown;
}

export type HydratedToolResultCard = ToolResultCard & Record<string, unknown>;

export function cardFromToolResult(
  result: Pick<CallToolResult, "structuredContent" | "_meta">,
): HydratedToolResultCard | undefined {
  const meta = asRecord(result._meta);
  const tool = meta?.tool;
  if (!isToolName(tool)) return undefined;

  const structuredContent = asRecord(result.structuredContent) ?? {};
  const metaCard = asRecord(meta?.card);
  const combined = metaCard
    ? { ...structuredContent, ...metaCard }
    : structuredContent;
  if (!isToolResultCard(combined)) return undefined;

  return { ...combined, tool } as HydratedToolResultCard;
}

export function cardFromOpenAiGlobals(
  globals: OpenAiToolGlobals | undefined,
): HydratedToolResultCard | undefined {
  if (!globals) return undefined;

  const metadata = asRecord(globals.toolResponseMetadata);
  const canonical = firstToolResult(
    metadata?.mcp_tool_result,
    metadata?.call_tool_result,
    metadata,
  );
  if (!canonical) return undefined;

  return cardFromToolResult({
    ...canonical,
    structuredContent: (canonical.structuredContent ?? globals.toolOutput) as CallToolResult["structuredContent"],
  });
}

function firstToolResult(...candidates: unknown[]): Pick<CallToolResult, "structuredContent" | "_meta"> | undefined {
  for (const candidate of candidates) {
    const value = asRecord(candidate);
    if (!value) continue;
    if (value._meta !== undefined || value.structuredContent !== undefined) {
      return value as Pick<CallToolResult, "structuredContent" | "_meta">;
    }
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object"
    ? value as Record<string, unknown>
    : undefined;
}
