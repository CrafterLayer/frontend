import { validateAiPlan, type AiEffectiveCommandPolicy } from '../harness/builder';
import { createEvalKernel } from '../harness/kernel';
import { evalValidationPorts } from '../harness/ports';
import type { EvalRunOutput } from '../harness/output';

import { failed, passed, type GradeResult } from './types';

/**
 * The one grader that is not an opinion.
 *
 * It rebuilds the exact kernel the case started from and hands the plan to
 * `validateAiPlan` — the real door, the same function the assistant panel and
 * `apps/ai-server` go through. Every rule the product actually enforces lives
 * behind it: command schemas, the utility-class vocabulary, custom-CSS
 * refusals, root-type inserts, the operation ceiling, and a full dry run that
 * leaves the document valid.
 *
 * Re-running it here rather than trusting the runner's own success is the
 * point. If the harness ever stops calling the validator, or calls it with a
 * looser policy, this grader is what notices; a boolean copied out of the run
 * result would agree with the bug.
 */
export function gradePlanValidates(output: EvalRunOutput): GradeResult {
  if (output.plan === null) {
    /*
      A refusal has no plan to validate and is not a failure of validity — the
      corpus checks refusals with the expectation grader instead. An `error`
      outcome IS a failure here, because it means the run produced neither a
      plan nor a considered decline.
    */
    return output.outcome === 'refusal'
      ? passed('No plan to validate: the run refused, which is a valid outcome.')
      : failed(
          `The run produced no plan and did not refuse: ${output.failure?.code ?? 'unknown'} — ${output.failure?.message ?? 'no message'}`,
        );
  }

  const kernel = createEvalKernel(output.fixture, output.dir);
  const policy: AiEffectiveCommandPolicy | undefined =
    output.policy === null
      ? undefined
      : {
          allowedCommands: output.policy.allowedCommands,
          maxCommands: output.policy.maxCommands,
          ...(output.policy.maxOperations === null
            ? {}
            : { maxOperations: output.policy.maxOperations }),
        };

  const result = validateAiPlan(output.plan, kernel, evalValidationPorts(), policy);
  if (result.ok) {
    return passed(
      `The plan passes validateAiPlan against a real ${output.fixture} kernel (${String(output.plan.commands.length)} command(s)).`,
    );
  }
  return failed(
    `validateAiPlan rejected the plan: ${result.issues
      .map((issue) => `[${issue.code}] ${issue.message}`)
      .join(' | ')}`,
  );
}
