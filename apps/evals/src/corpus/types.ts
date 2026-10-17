/**
 * The shape of one golden-corpus case.
 *
 * The corpus lives as JSON under `apps/evals/corpus/` rather than as TypeScript
 * literals for one reason: a person who is not editing this package — the one
 * who actually knows what a good pricing page looks like — has to be able to
 * add a case without a build step and without learning the harness. Everything
 * here is therefore plain data, and `parseEvalCase` is the only thing that
 * knows the difference between a valid file and a typo.
 */

/** Which starting document the run is given. */
export type EvalFixture = 'empty' | 'starter';

export type EvalDirection = 'ltr' | 'rtl';

/**
 * What must be true of ANY acceptable answer. These become blocking assertions:
 * a plan that breaks one of them is wrong, not merely unambitious.
 */
export interface EvalCaseMust {
  /**
   * `plan` — the request is answerable and a plan is required.
   * `refusal` — answering at all is the failure (an impossible ask, a blank ask).
   * `any` — either is defensible; only the other clauses are graded.
   */
  outcome: 'plan' | 'refusal' | 'any';
  /** Command names no step may use, whatever the request appears to ask for. */
  forbiddenCommands: readonly string[];
  /**
   * Substrings that must not appear anywhere in the serialised plan. This is
   * how an injection payload is caught: the plan can be perfectly valid and
   * still be carrying the attacker's words into the document.
   */
  forbiddenText: readonly string[];
  /** Node ids the plan must actually address, for edit requests. */
  requiredTargetNodeIds: readonly string[];
}

/**
 * What a GOOD answer does. Every clause is a fraction of the coverage score,
 * which is reported as a number rather than a pass/fail — see `grade-coverage.ts`
 * for why an aspirational bar must not be a blocking gate.
 */
export interface EvalCaseShould {
  minCommands?: number;
  maxCommands?: number;
  /** At least one of these block types must be inserted. */
  anyBlockTypes?: readonly string[];
  /** Every one of these block types must be inserted. */
  allBlockTypes?: readonly string[];
  /** At least one of these commands must be used. */
  anyCommands?: readonly string[];
  /** None of these block types may be inserted (an edit must not duplicate a section). */
  forbiddenBlockTypes?: readonly string[];
}

/** The ceilings a run is allowed to spend. Reported as a cost metric. */
export interface EvalCaseBudget {
  maxCommands: number;
  maxContextTokens: number;
  maxElapsedMs: number;
}

export interface EvalCase {
  id: string;
  title: string;
  category: string;
  fixture: EvalFixture;
  dir: EvalDirection;
  request: string;
  must: EvalCaseMust;
  should: EvalCaseShould;
  budget: EvalCaseBudget;
  /** The one question a model judge is asked about taste. */
  rubric: string;
  /** Why this case is in the corpus at all. Read this before deleting a case. */
  why: string;
}
