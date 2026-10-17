import type { EvalRunOutput } from '../harness/output';

import { referencedNodeIds } from './plan-inspect';
import { failed, passed, type GradeResult } from './types';

/**
 * Does every node this plan names actually exist?
 *
 * The interesting half of this rule is the half that looks missing. A plan
 * cannot address a node it CREATES in the same plan, ever: the kernel mints
 * ids from its injected id port while the plan executes, long after the model
 * finished writing it, so an id for a not-yet-inserted node is necessarily
 * invented. That is the single most common way a plausible-looking plan dies
 * at the door, and it is why this grader resolves references against the
 * STARTING document only.
 *
 * A model that wants a hero with two buttons inside it must express that as
 * one `insertNode` carrying its children, not as three steps referring to each
 * other by name.
 */
export function gradeNodeReferences(output: EvalRunOutput): GradeResult {
  if (output.plan === null) {
    return output.outcome === 'refusal'
      ? passed('No node references: the run refused.')
      : failed(`The run produced no plan: ${output.failure?.message ?? 'no message'}`);
  }

  const known = new Set(output.document.nodeIds);
  const referenced = referencedNodeIds(output.plan);
  const unknown = referenced.filter((id) => !known.has(id));
  if (unknown.length > 0) {
    return failed(
      `The plan addresses ${String(unknown.length)} node id(s) the document does not have: ${unknown.join(', ')}. The document holds: ${output.document.nodeIds.join(', ')}. An id the plan itself inserts is minted by the kernel afterwards and can never be named by a later step.`,
    );
  }
  return passed(
    referenced.length === 0
      ? 'The plan addresses no existing nodes, so there is nothing to resolve.'
      : `All ${String(referenced.length)} referenced node id(s) exist in the starting document.`,
  );
}
