import type { BuilderKernel } from '@craftkit/builder-core';

import type { AiPlanValidationIssue } from '../../types';
import { agentTool, AGENT_TOOLS } from './registry';
import { isRecord, type JsonRecord } from './shared';
import { AGENT_TOOL_COMMAND, type AgentToolContext, type AgentToolLane } from './types';

/**
 * Tool steps expanded into the kernel steps they stand for, BEFORE the door.
 *
 * Same place and same rule as `editTree` (plan/tree-edits.ts): a tool step is
 * not a kernel command and never reaches the kernel. Each one is replaced,
 * in order, by the ordinary steps its tool returns — so the door judges them
 * like any step the model wrote. A tool reads the page AS THE PLAN'S EARLIER
 * STEPS LEAVE IT (`readProp`): tools emit whole-tree setProps, and two of
 * them on one region must compose, not overwrite each other.
 *
 * A step that cannot expand stays in the plan unexpanded and yields an
 * `invalid-args` issue whose message is the repair round's instruction.
 */

export interface AgentToolExpansionOptions {
  readonly sampleValues?: readonly string[];
  /** Only these lanes' tools may be named; absent = every tool. */
  readonly lanes?: readonly AgentToolLane[];
}

export interface AgentToolExpansion {
  /** The plan with every tool step expanded, or the same value when it has none. */
  readonly plan: unknown;
  readonly issues: AiPlanValidationIssue[];
}

function issue(step: number, name: string, message: string): AiPlanValidationIssue {
  return { code: 'invalid-args', message: `Step ${String(step)} (tool ${name}): ${message}`, step };
}

function allowed(lanes: readonly AgentToolLane[] | undefined): readonly string[] {
  return AGENT_TOOLS.filter((tool) => lanes === undefined || tool.lanes.some((lane) => lanes.includes(lane))).map(
    ({ name }) => name,
  );
}

function isToolStep(step: unknown): step is JsonRecord {
  return isRecord(step) && step['command'] === AGENT_TOOL_COMMAND;
}

/** Expand every `{"command":"tool"}` step of a candidate plan, in order. */
export function expandAgentTools(
  candidate: unknown,
  kernel: BuilderKernel,
  options: AgentToolExpansionOptions = {},
): AgentToolExpansion {
  if (!isRecord(candidate) || !Array.isArray(candidate['commands'])) return { plan: candidate, issues: [] };
  const commands = candidate['commands'] as unknown[];
  if (!commands.some(isToolStep)) return { plan: candidate, issues: [] };

  const document = kernel.getDocument();
  const written = new Map<string, unknown>();
  let dir: 'rtl' | 'ltr' = document.dir === 'rtl' ? 'rtl' : 'ltr';
  const slot = (id: string, key: string) => `${id}\u0000${key}`;
  const readProp = (id: string, key: string): unknown => {
    const at = slot(id, key);
    if (written.has(at)) return written.get(at);
    const nodes = kernel.getDocument().nodes;
    // Own keys only: `nodes` is a plain object, and "constructor" is not a node.
    if (!Object.hasOwn(nodes, id)) return undefined;
    const props = nodes[id]?.props;
    return props !== undefined && Object.hasOwn(props, key) ? props[key] : undefined;
  };
  const remember = (step: unknown): void => {
    if (!isRecord(step) || !isRecord(step['args'])) return;
    const args = step['args'];
    if (step['command'] === 'setProp' && typeof args['id'] === 'string' && typeof args['key'] === 'string') {
      written.set(slot(args['id'], args['key']), args['value']);
    }
    if (step['command'] === 'setDocMeta' && (args['dir'] === 'rtl' || args['dir'] === 'ltr')) dir = args['dir'];
  };
  const context = (): AgentToolContext => {
    const lang = readProp(document.rootId, 'lang');
    return {
      kernel,
      readProp,
      locale: {
        lang: typeof lang === 'string' && lang.trim() !== '' ? lang.trim().toLowerCase() : dir === 'rtl' ? 'ar' : 'en',
        dir,
      },
      sampleValues: options.sampleValues ?? [],
    };
  };

  const issues: AiPlanValidationIssue[] = [];
  const expanded: unknown[] = [];
  for (const [index, step] of commands.entries()) {
    if (!isToolStep(step)) {
      remember(step);
      expanded.push(step);
      continue;
    }
    const args = isRecord(step['args']) ? step['args'] : {};
    const name = typeof args['name'] === 'string' ? args['name'] : '?';
    const valid = allowed(options.lanes);
    const tool = valid.includes(name) ? agentTool(name) : undefined;
    if (tool === undefined) {
      issues.push(issue(index, name, `unknown tool "${name}"; valid tools: ${valid.join(', ')}.`));
      expanded.push(step);
      continue;
    }
    const parsed = tool.parse(args['input']);
    if (!parsed.ok) {
      issues.push(issue(index, name, parsed.error));
      expanded.push(step);
      continue;
    }
    let result: ReturnType<typeof tool.run>;
    try {
      result = tool.run(parsed.value, context());
    } catch (cause) {
      result = { ok: false, error: cause instanceof Error ? cause.message : String(cause) };
    }
    if (!result.ok) {
      issues.push(issue(index, name, result.error));
      expanded.push(step);
      continue;
    }
    const title = typeof step['title'] === 'string' ? step['title'] : undefined;
    for (const [at, produced] of result.steps.entries()) {
      const out: JsonRecord = {
        command: produced.command,
        args: produced.args,
        ...(at === 0 && title !== undefined ? { title } : produced.title === undefined ? {} : { title: produced.title }),
      };
      remember(out);
      expanded.push(out);
    }
  }
  return { plan: { ...candidate, commands: expanded }, issues };
}
