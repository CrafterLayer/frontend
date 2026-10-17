import type { BuilderKernel } from '@craftkit/builder-core';

/**
 * Agent tools: deterministic helpers the model names INSIDE the one plan it
 * already returns (DESIGN.md §0, §A.1 — this file is the frozen contract).
 *
 * A tool step is `{"command":"tool","args":{"name":"theme.apply","input":{…}}}`.
 * It never reaches the kernel: `expandAgentTools` (expand.ts) turns it into
 * ordinary kernel steps before the door judges the plan, so a tool can do
 * nothing a hand-written step could not. It costs the model ~30–300 output
 * tokens instead of the thousands a rewritten tree costs, and it needs no
 * server-side tool calling, so the CLI fallback (`--max-turns 1 --tools ''`)
 * and every free model can use it.
 */

export const AGENT_TOOL_COMMAND = 'tool';
export const AGENT_TOOL_LANES = ['build', 'section', 'edit', 'seo'] as const;
export type AgentToolLane = (typeof AGENT_TOOL_LANES)[number];

/** An ordinary plan step: exactly what the door validates. */
export interface AgentToolStep {
  readonly command: string;
  readonly args: Record<string, unknown>;
  readonly title?: string;
}

export interface AgentToolContext {
  readonly kernel: BuilderKernel;
  /** A node prop as the plan's EARLIER steps leave it (setProp values win over the live page). */
  readonly readProp: (nodeId: string, key: string) => unknown;
  /** The page's language and direction: from the root `lang` + document dir. */
  readonly locale: { readonly lang: string; readonly dir: 'rtl' | 'ltr' };
  /** Sample values from the plan's facts ledger; tools never write these into SEO data. */
  readonly sampleValues: readonly string[];
}

export type AgentToolParse<I> =
  | { readonly ok: true; readonly value: I }
  | { readonly ok: false; readonly error: string };

export type AgentToolRun =
  | { readonly ok: true; readonly steps: readonly AgentToolStep[]; readonly note?: string }
  | { readonly ok: false; readonly error: string };

export interface AgentTool<I = unknown> {
  /** 'kit.section', dotted, lower-case. */
  readonly name: string;
  readonly lanes: readonly AgentToolLane[];
  /** 8 words or fewer, English. */
  readonly summary: string;
  /** 120 chars or fewer, e.g. '{id,kit,slots}'. */
  readonly signature: string;
  readonly parse: (input: unknown) => AgentToolParse<I>;
  readonly run: (input: I, context: AgentToolContext) => AgentToolRun;
}

const TOOL_NAME = /^[a-z]+(\.[a-z-]+)+$/u;
const MAX_SUMMARY_WORDS = 8;
const MAX_SIGNATURE_CHARS = 120;

/** Freezes a tool, asserting its name, summary and signature fit the catalog's limits. */
export function defineAgentTool<I>(tool: AgentTool<I>): AgentTool<I> {
  if (!TOOL_NAME.test(tool.name)) {
    throw new Error(`Agent tool name "${tool.name}" must be dotted lower-case, e.g. "kit.section".`);
  }
  const words = tool.summary.trim().split(/\s+/u).filter((word) => word !== '');
  if (words.length === 0 || words.length > MAX_SUMMARY_WORDS) {
    throw new Error(
      `Agent tool "${tool.name}": summary must be 1-${String(MAX_SUMMARY_WORDS)} words (has ${String(words.length)}).`,
    );
  }
  if (tool.signature.length > MAX_SIGNATURE_CHARS) {
    throw new Error(
      `Agent tool "${tool.name}": signature must be at most ${String(MAX_SIGNATURE_CHARS)} characters.`,
    );
  }
  if (tool.lanes.length === 0) {
    throw new Error(`Agent tool "${tool.name}" must belong to at least one lane.`);
  }
  return Object.freeze({ ...tool, lanes: Object.freeze([...tool.lanes]) });
}
