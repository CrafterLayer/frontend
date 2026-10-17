import type { EvalRunOutput } from '../harness/output';

import { commandNames, insertedBlockTypes } from './plan-inspect';
import { failed, passed, type GradeResult } from './types';

/**
 * Did the plan stay inside the authority it was actually granted?
 *
 * The allowlist is not invented here: it is `result.policy.allowedCommands`,
 * the set `resolveAiCommandPolicy` computed for that very run by intersecting
 * the live registry with the session and skill restrictions. Comparing against
 * a hand-written list would drift the first time a command is registered, and
 * would then pass plans the kernel refuses.
 *
 * The second rule is the root-type insert. The kernel refuses it too, but only
 * at the end of a run already paid for, and a plan that tries it is making a
 * category error worth counting separately: the page already exists, so the
 * model meant `setProp` on the root and reached for `insertNode` instead.
 */
export function gradeCommandPolicy(output: EvalRunOutput): GradeResult {
  if (output.plan === null) {
    return output.outcome === 'refusal'
      ? passed('No commands proposed: the run refused.')
      : failed(`The run produced no plan: ${output.failure?.message ?? 'no message'}`);
  }
  if (output.policy === null) {
    return failed('The run produced a plan but no effective command policy to judge it against.');
  }

  const allowed = new Set(output.policy.allowedCommands);
  const used = commandNames(output.plan);
  const forbidden = [...new Set(used.filter((name) => !allowed.has(name)))];
  if (forbidden.length > 0) {
    return failed(
      `The plan uses ${String(forbidden.length)} command(s) outside the run's allowlist: ${forbidden.join(', ')}.`,
    );
  }

  if (used.length > output.policy.maxCommands) {
    return failed(
      `The plan has ${String(used.length)} commands; this run's ceiling was ${String(output.policy.maxCommands)}.`,
    );
  }

  const rootInserts = insertedBlockTypes(output.plan).filter(
    (type) => type === output.document.rootType,
  );
  if (rootInserts.length > 0) {
    return failed(
      `The plan inserts ${String(rootInserts.length)} node(s) of the document's own root type "${output.document.rootType}". The page already exists — that edit is a setProp on "${output.document.rootId}".`,
    );
  }

  return passed(
    `All ${String(used.length)} command(s) are inside the run's allowlist and none inserts a root-type node.`,
  );
}
