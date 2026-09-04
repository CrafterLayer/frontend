import type { EvalCase } from '../corpus/types';
import type { EvalRunOutput } from '../harness/output';

import type { GradeResult } from './types';

/**
 * What did the answer cost — commands, context tokens, wall time?
 *
 * Two of the three block and one does not, and the split is about determinism
 * rather than importance. Command count and context tokens are properties of
 * the run: the same case, the same provider and the same catalog produce the
 * same numbers on any machine, so a ceiling on them is a real gate. Elapsed
 * time is a property of the MACHINE — a loaded CI box, a cold cache, a live
 * model having a slow minute — and a gate on it would go red for reasons that
 * have nothing to do with plan quality, which is how eval suites get muted.
 *
 * So latency is measured, scored and reported, and never fails a run.
 */
export function gradeCost(output: EvalRunOutput, evalCase: EvalCase): GradeResult {
  const { budget } = evalCase;
  const { commandCount, contextTokens, elapsedMs } = output.metrics;

  const withinCommands = commandCount <= budget.maxCommands;
  const withinTokens = contextTokens <= budget.maxContextTokens;
  const withinTime = elapsedMs <= budget.maxElapsedMs;
  const met = [withinCommands, withinTokens, withinTime].filter(Boolean).length;

  const summary = `${String(commandCount)}/${String(budget.maxCommands)} commands, ${String(contextTokens)}/${String(budget.maxContextTokens)} context tokens, ${String(elapsedMs)}ms/${String(budget.maxElapsedMs)}ms`;

  if (!withinCommands || !withinTokens) {
    const over = [
      withinCommands ? '' : 'command count',
      withinTokens ? '' : 'context tokens',
    ].filter((label) => label !== '');
    return {
      pass: false,
      score: met / 3,
      reason: `Over budget on ${over.join(' and ')}: ${summary}.`,
    };
  }
  return {
    pass: true,
    score: met / 3,
    reason: withinTime
      ? `Within budget: ${summary}.`
      : `Within the deterministic budgets but slow (latency does not fail a run): ${summary}.`,
  };
}
