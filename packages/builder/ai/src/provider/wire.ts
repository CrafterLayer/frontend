// The HTTP contract between this package and a plan-proposing server. A server
// implements exactly this shape; everything else — registry lookup, args
// schemas, the scratch-kernel dry run — stays on this side of the wire, so a
// wrong server can only ever produce a rejected proposal, never a document.
import type {
  AiPlan,
  AiPlanValidationIssue,
  AssembledAiContext,
} from '../types';

export const AI_PLAN_WIRE_VERSION = 1;

/** A prior proposal that failed validation, echoed back so the server can repair it. */
export interface AiPlanWireAttempt {
  plan: AiPlan;
  issues: readonly AiPlanValidationIssue[];
}

/** POST body sent to the plan endpoint. */
export interface AiPlanWireRequest {
  version: typeof AI_PLAN_WIRE_VERSION;
  request: string;
  context: AssembledAiContext;
  attempt?: AiPlanWireAttempt;
}

/** A server answers with a plan, or with an explicit refusal it can word itself. */
export type AiPlanWireResponse = AiPlan | { refusal: string };
