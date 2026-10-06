import type { AgentToolContext, AgentToolRun, AgentToolStep } from '../tools/agent/types';
import { asTreeRoot, simulateTreeSteps } from './tree-steps';

/**
 * Close a tool run: replay its tree steps against the trees as the plan
 * leaves them (the tool's own door), and title the first step so the plan's
 * one transaction carries a readable history label ("Padding · Heading …").
 */
export function finish(
  context: AgentToolContext,
  steps: readonly AgentToolStep[],
  title: string,
  note?: string,
): AgentToolRun {
  if (steps.length === 0) return { ok: false, error: 'nothing to change · the element already looks like that.' };
  const simulated = simulateTreeSteps(steps, (id) => asTreeRoot(context.readProp(id, 'tree')));
  if (!simulated.ok) return { ok: false, error: simulated.error };
  const [first, ...rest] = steps;
  /* v8 ignore next -- length checked above. */
  if (first === undefined) return { ok: false, error: 'nothing to change.' };
  return {
    ok: true,
    steps: [{ ...first, title: title.slice(0, 160) }, ...rest],
    ...(note === undefined ? {} : { note }),
  };
}

export function step(command: string, args: Record<string, unknown>): AgentToolStep {
  return { command, args };
}
