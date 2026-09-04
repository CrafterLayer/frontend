import type { EvalCase } from '../corpus/types';

import { classifyAiRunFailure, runAiAgent, type AiPlan, type AiPlanProvider } from './builder';
import { createEvalKernel } from './kernel';
import { evalValidationPorts, steppedClockPort } from './ports';
import type { EvalMode } from './provider';
import type { EvalPlanShape, EvalRunOutput } from './output';

export interface RunEvalCaseOptions {
  provider: AiPlanProvider;
  mode: EvalMode;
  signal?: AbortSignal;
  /** Wall clock, injected so a test can make elapsed time deterministic. */
  now?: () => number;
}

function planShape(plan: AiPlan): EvalPlanShape {
  return {
    rationale: plan.rationale,
    commands: plan.commands.map((step) => ({
      command: step.command,
      args: step.args,
      ...(step.title === undefined ? {} : { title: step.title }),
    })),
    ...(plan.followUp === undefined ? {} : { followUp: plan.followUp }),
  };
}

/**
 * Run one corpus case through the real agent and return everything a grader
 * needs, as plain JSON.
 *
 * `apply: 'never'` is the whole design. An eval that applied its plans would
 * be measuring the SECOND state of the document — every later case would start
 * from wherever the previous one left it — and a single bad plan would poison
 * the rest of the suite. Proposing only means every case is independent and
 * the graders judge the plan itself, which is the artefact a prompt change
 * actually moves.
 *
 * Nothing here throws for a refused or failed run: a refusal is a legitimate
 * answer that half the corpus is checking for, so it must arrive as data.
 */
export async function runEvalCase(
  evalCase: EvalCase,
  options: RunEvalCaseOptions,
): Promise<EvalRunOutput> {
  const kernel = createEvalKernel(evalCase.fixture, evalCase.dir);
  const document = kernel.getDocument();
  const startedAt = (options.now ?? Date.now)();

  /*
    Context size is read off the run's own event stream rather than off the
    result, because a run that FAILS never produces a result — and the token
    cost of a request that then blew up is exactly the number someone chasing a
    budget regression wants to see.
  */
  let contextFragments = 0;
  let contextTokens = 0;
  /*
    The run's own account of how hard it had to work, read off the events it
    already emits. Before this the harness recorded only the outcome, so
    "succeeded first time" and "succeeded after a repair" were the same number —
    and the plan's two headline gates could not be computed at all.
  */
  let attempts: 1 | 2 = 1;
  let repaired = false;
  let salvaged: { kept: number; dropped: number } | null = null;

  const base = {
    caseId: evalCase.id,
    fixture: evalCase.fixture,
    dir: evalCase.dir,
    request: evalCase.request,
    mode: options.mode,
    document: {
      rootId: document.rootId,
      rootType: document.nodes[document.rootId]?.type ?? 'page',
      nodeIds: Object.keys(document.nodes),
    },
  } as const;

  try {
    const result = await runAiAgent({
      runId: `eval-${evalCase.id}`,
      clock: steppedClockPort(),
      kernel,
      provider: options.provider,
      request: evalCase.request,
      validationPorts: evalValidationPorts(),
      apply: 'never',
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      onEvent: (event) => {
        if (event.type === 'context.ready') {
          contextFragments = event.fragmentCount;
          contextTokens = event.totalTokens;
        }
        if (event.type === 'plan.validating') attempts = event.attempt;
        if (event.type === 'plan.repairing') repaired = true;
        if (event.type === 'plan.salvaged') {
          salvaged = { kept: event.kept, dropped: event.dropped.length };
        }
      },
    });
    return {
      ...base,
      outcome: 'plan',
      plan: planShape(result.plan),
      failure: null,
      policy: {
        allowedCommands: [...result.policy.allowedCommands],
        maxCommands: result.policy.maxCommands,
        maxOperations: result.policy.maxOperations ?? null,
      },
      metrics: {
        commandCount: result.plan.commands.length,
        contextFragments,
        contextTokens,
        attempts,
        repaired,
        salvaged,
        elapsedMs: (options.now ?? Date.now)() - startedAt,
      },
    };
  } catch (cause) {
    const failure = classifyAiRunFailure(cause);
    /*
      A provider REFUSAL and a broken provider are the same exception type to
      JavaScript and opposite events to an eval: one is the assistant correctly
      declining an impossible request, the other is the harness failing to
      measure anything. The classified code is the only place that distinction
      survives, so it is the only thing this branch trusts.
    */
    return {
      ...base,
      outcome: failure.code === 'refusal' ? 'refusal' : 'error',
      plan: null,
      failure: {
        source: failure.source,
        code: failure.code,
        message: failure.message,
        retryable: failure.retryable,
      },
      policy: null,
      metrics: {
        commandCount: 0,
        contextFragments,
        contextTokens,
        attempts,
        repaired,
        salvaged,
        elapsedMs: (options.now ?? Date.now)() - startedAt,
      },
    };
  }
}
