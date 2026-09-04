// @craftkit/evals — the plan-quality harness.
//
// packages/builder/ai has hundreds of unit tests and not one of them calls a
// model, so nothing in this repo could answer "did that prompt change make the
// assistant better or worse". This package answers it: a golden corpus of real
// requests, a runner that produces a real plan for each, and deterministic
// graders that judge the plan against the same validator production uses.

export { corpusDirectory, findEvalCase, loadCorpus, parseEvalCase } from './corpus/load';
export type {
  EvalCase,
  EvalCaseBudget,
  EvalCaseMust,
  EvalCaseShould,
  EvalDirection,
  EvalFixture,
} from './corpus/types';

export {
  STARTER_FEATURES_ID,
  STARTER_HERO_ID,
  createEvalKernel,
  evalExtensions,
} from './harness/kernel';
export {
  DEFAULT_LIVE_ENDPOINT,
  createEvalProvider,
  resolveEvalMode,
  resolveLiveEndpoint,
  type EvalMode,
  type EvalProviderOptions,
} from './harness/provider';
export { evalValidationPorts, seededIdPort, steppedClockPort } from './harness/ports';
export { runEvalCase, type RunEvalCaseOptions } from './harness/run-case';
export type { EvalOutcome, EvalPlanShape, EvalPlanStep, EvalRunOutput } from './harness/output';

export * from './graders';

export { assertionsFor, parseRunOutput, rubricEnabled } from './promptfoo/assert';
export { evalTestCases } from './promptfoo/tests';
