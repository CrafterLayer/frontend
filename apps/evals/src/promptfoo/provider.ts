import { findEvalCase, loadCorpus } from '../corpus/load';
import type { EvalCase } from '../corpus/types';
import { createEvalProvider, resolveEvalMode, type EvalMode } from '../harness/provider';
import { runEvalCase } from '../harness/run-case';
import type { AiPlanProvider } from '../harness/builder';

import type {
  PromptfooCallContext,
  PromptfooProviderOptions,
  PromptfooProviderResponse,
} from './contract';

/*
  The corpus and the plan provider are built once per process, not once per
  test. promptfoo calls `callApi` concurrently — four at a time by default —
  and rebuilding the block catalog on every call would make the harness's own
  cost dominate the number it is trying to measure. Each call still gets its
  OWN kernel, which is what keeps the cases independent.
*/
let corpusCache: readonly EvalCase[] | undefined;
let planProviderCache: AiPlanProvider | undefined;

function corpus(): readonly EvalCase[] {
  corpusCache ??= loadCorpus();
  return corpusCache;
}

function planProvider(mode: EvalMode): AiPlanProvider {
  planProviderCache ??= createEvalProvider({ mode });
  return planProviderCache;
}

/**
 * The promptfoo custom provider: one corpus case in, one plan out as JSON.
 *
 * It answers with the whole `EvalRunOutput` rather than with the plan alone,
 * because promptfoo hands assertions a STRING and nothing else. Everything a
 * grader needs — which fixture, which direction, which command allowlist the
 * run resolved, what it cost — has to travel inside that string or the graders
 * would each have to guess it back.
 *
 * A failed run is still an answer. Returning `{ error }` here would strike the
 * row from the report, and "the assistant crashed on the Arabic case" is
 * exactly the result someone needs to see.
 */
export default class CraftkitPlanProvider {
  private readonly providerId: string;
  private readonly mode: EvalMode;

  constructor(options: PromptfooProviderOptions = {}) {
    const configuredMode = options.config?.['mode'];
    this.mode =
      configuredMode === 'live' || configuredMode === 'offline'
        ? configuredMode
        : resolveEvalMode();
    this.providerId = options.id ?? `craftkit:plan:${this.mode}`;
  }

  id(): string {
    return this.providerId;
  }

  async callApi(
    prompt: string,
    context?: PromptfooCallContext,
  ): Promise<PromptfooProviderResponse> {
    const caseId = context?.vars?.['caseId'];
    if (typeof caseId !== 'string') {
      return {
        error:
          'Every eval test must set a "caseId" var naming a file in apps/evals/corpus. promptfooconfig.yaml generates them from the corpus, so an unset one means the tests file was bypassed.',
      };
    }

    let evalCase: EvalCase;
    try {
      evalCase = findEvalCase(caseId, corpus());
    } catch (cause) {
      return { error: cause instanceof Error ? cause.message : String(cause) };
    }

    /*
      The request is taken from the CASE, never from the rendered prompt. A
      corpus request is adversarial by design — three of these cases carry a
      prompt injection — and passing it through a template engine first risks
      the harness quietly editing the very payload it is testing for.
    */
    void prompt;

    const output = await runEvalCase(evalCase, {
      provider: planProvider(this.mode),
      mode: this.mode,
    });

    return {
      output: JSON.stringify(output),
      /*
        Context tokens are the input cost of the request; the local provider
        has no completion cost at all. Reported so promptfoo's own token
        column means something in live mode.
      */
      tokenUsage: { prompt: output.metrics.contextTokens, total: output.metrics.contextTokens },
    };
  }
}
