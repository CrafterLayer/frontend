import type { EvalCase } from '../corpus/types';
import type { EvalRunOutput } from '../harness/output';
import {
  gradeCommandPolicy,
  gradeCost,
  gradeCoverage,
  gradeDesignTokens,
  gradeMustExpectations,
  gradeNodeReferences,
  gradePlanValidates,
} from '../graders';

import type { PromptfooAssertion, PromptfooGradingResult } from './contract';

/**
 * Turn the provider's answer back into the object the graders read.
 *
 * promptfoo hands an assertion a string, so this is the seam where a harness
 * bug would otherwise become a grader crash with an unreadable stack. It
 * checks the two fields every grader dereferences and says which one was
 * missing, because "cannot read properties of undefined" in a promptfoo row
 * tells nobody anything.
 */
export function parseRunOutput(text: string): EvalRunOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new Error(
      `The provider did not return JSON (${cause instanceof Error ? cause.message : String(cause)}). First 200 characters: ${text.slice(0, 200)}`,
    );
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('The provider returned JSON that is not an object.');
  }
  const record = parsed as Record<string, unknown>;
  for (const key of ['caseId', 'outcome', 'metrics', 'document'] as const) {
    if (record[key] === undefined) {
      throw new Error(`The provider's output is missing "${key}". This is a harness bug, not a model failure.`);
    }
  }
  return parsed as EvalRunOutput;
}

function grader(
  run: (output: EvalRunOutput) => PromptfooGradingResult,
): (output: string) => PromptfooGradingResult {
  return (output) => run(parseRunOutput(output));
}

/**
 * Whether a model judge is part of the suite.
 *
 * Off by default, and that is the load-bearing half of the design. The rubric
 * needs a grading model and therefore a key, a network and a bill; everything
 * else here is deterministic and free. The suite has to be worth running with
 * this switch off, so the rubric adds ONE metric on top of six that already
 * stand on their own.
 */
export function rubricEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env['CRAFTKIT_EVAL_RUBRIC'] === '1';
}

/** Every assertion one corpus case contributes, in report order. */
export function assertionsFor(
  evalCase: EvalCase,
  options: { rubric?: boolean } = {},
): PromptfooAssertion[] {
  const assertions: PromptfooAssertion[] = [
    { type: 'javascript', metric: 'valid', value: grader(gradePlanValidates) },
    { type: 'javascript', metric: 'command-policy', value: grader(gradeCommandPolicy) },
    { type: 'javascript', metric: 'node-references', value: grader(gradeNodeReferences) },
    { type: 'javascript', metric: 'design-tokens', value: grader(gradeDesignTokens) },
    {
      type: 'javascript',
      metric: 'expectations',
      value: grader((output) => gradeMustExpectations(output, evalCase)),
    },
    {
      type: 'javascript',
      metric: 'cost',
      value: grader((output) => gradeCost(output, evalCase)),
    },
    /*
      Coverage is last and weightless. It never fails a row — see
      `grade-coverage.ts` — so giving it weight in the pass/fail score would
      only dilute the graders that DO fail. It is read as a metric average.
    */
    {
      type: 'javascript',
      metric: 'coverage',
      weight: 0,
      value: grader((output) => gradeCoverage(output, evalCase)),
    },
  ];

  if (options.rubric ?? rubricEnabled()) {
    assertions.push({
      type: 'llm-rubric',
      metric: 'taste',
      weight: 0,
      value: `The output is a JSON eval record whose "plan.commands" array holds the editor commands an AI assistant proposed for this request: "${evalCase.request}". Read the props inside those commands as the page copy a visitor would see. ${evalCase.rubric} Answer only about the writing and the shape of the page, never about JSON syntax.`,
    });
  }
  return assertions;
}
