import { planBlockDetach } from '../editing/detach-block';
import { defineAgentTool, type AgentToolContext, type AgentToolRun } from '../tools/agent/types';
import { no, ok, strictRecord, type Parsed } from './address';

/**
 * block.convert — "Convert to editable" from the agent (DESIGN §A.9): a
 * registered block (a marketing hero, a pricing table) becomes a customCode
 * region whose every heading, button and card is an element the other style
 * tools can address. Expands to insertNode (the region, at the block's place)
 * + removeNode (the block). The new region's id is assigned when the plan
 * lands, so address it in a FOLLOW-UP turn, not later in the same plan.
 */

export interface BlockConvertInput {
  readonly nodeId: string;
}

function parse(input: unknown): Parsed<BlockConvertInput> {
  const record = strictRecord(input, ['nodeId'], '{"nodeId"}');
  if (!record.ok) return record;
  const nodeId = record.value['nodeId'];
  if (typeof nodeId !== 'string' || nodeId.trim() === '') return no('"nodeId" must be the id of the block to convert.');
  return ok({ nodeId });
}

function run(input: BlockConvertInput, context: AgentToolContext): AgentToolRun {
  const plan = planBlockDetach(context.kernel, input.nodeId);
  if (!plan.ok) return no(`${plan.reasons.slice(0, 3).join('; ')} · leave the block as it is, or edit it through its own props.`);
  const [first, ...rest] = plan.steps;
  /* v8 ignore next -- a plan always has its two steps. */
  if (first === undefined) return no('nothing to convert.');
  const notes = [...plan.warnings, ...(plan.dropped.length === 0 ? [] : [`${String(plan.dropped.length)} attribute(s) the region does not admit were dropped`])];
  return {
    ok: true,
    steps: [
      { command: first.command, args: first.args as Record<string, unknown>, title: plan.label },
      ...rest.map((step) => ({ command: step.command, args: step.args as Record<string, unknown> })),
    ],
    ...(notes.length === 0 ? {} : { note: notes.join('; ') }),
  };
}

export const blockConvertTool = defineAgentTool<BlockConvertInput>({
  name: 'block.convert',
  lanes: ['edit'],
  summary: 'Convert a block into an editable region',
  signature: '{nodeId}',
  parse,
  run,
});
