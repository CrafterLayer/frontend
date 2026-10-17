import type { EvalDirection, EvalFixture } from '../corpus/types';

/** One command as the plan wrote it. `args` stays `unknown`: it is model output. */
export interface EvalPlanStep {
  command: string;
  args: unknown;
  title?: string;
}

export interface EvalPlanShape {
  rationale: string;
  commands: readonly EvalPlanStep[];
  followUp?: string;
}

/**
 * How the run ended.
 *
 * `refusal` is a first-class SUCCESS, not an error: half the corpus exists to
 * check that an impossible or empty request produces nothing rather than a
 * confident hallucination. `error` is everything else that stopped the run —
 * a transport failure, a rejected plan, a crash.
 */
export type EvalOutcome = 'plan' | 'refusal' | 'error';

/**
 * Everything the graders are allowed to see.
 *
 * It is deliberately self-contained — the fixture and direction travel with it
 * — so a grader can rebuild the exact starting kernel and run the REAL
 * validator against the plan, rather than trusting a boolean the runner
 * computed. A grader that trusts the runner cannot catch a runner bug.
 *
 * This object is what the promptfoo provider serialises as its output, so it
 * must stay plain JSON.
 */
export interface EvalRunOutput {
  caseId: string;
  fixture: EvalFixture;
  dir: EvalDirection;
  request: string;
  mode: 'offline' | 'live';
  outcome: EvalOutcome;
  plan: EvalPlanShape | null;
  /** Present for `refusal` and `error`: the classified run failure. */
  failure: { source: string; code: string; message: string; retryable: boolean } | null;
  /** The effective allowlist the run itself resolved. Not a guess by the grader. */
  policy: {
    allowedCommands: readonly string[];
    maxCommands: number;
    /**
     * `null` when the run resolved a policy that left the ceiling unset. It is
     * NOT flattened to a number here: substituting a default would make the
     * grader enforce a limit the run never actually had.
     */
    maxOperations: number | null;
  } | null;
  metrics: {
    commandCount: number;
    contextFragments: number;
    contextTokens: number;
    elapsedMs: number;
    /**
     * How many times the model was asked before an answer passed the door.
     *
     * 1 means the assistant got it right without help. 2 means the plan was
     * rejected and repaired. This is the numerator of the plan's two headline
     * gates — "success without repair" and "success after repair" — and neither
     * could be computed before, because the run reported only its outcome.
     */
    attempts: 1 | 2;
    /** Whether a rejected plan was sent back for correction. */
    repaired: boolean;
    /**
     * Steps kept and dropped when BOTH attempts failed and the run salvaged the
     * part the door accepts. Null when nothing was salvaged.
     *
     * Reported apart from success on purpose: a salvaged plan is a partial
     * result, and counting it as a pass would let the success rate rise while
     * the product delivered less.
     */
    salvaged: { kept: number; dropped: number } | null;
  };
  /** The starting document, so reference checks need no second run. */
  document: {
    rootId: string;
    rootType: string;
    nodeIds: readonly string[];
  };
}
