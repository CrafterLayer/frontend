// The HTTP contract between this package and a plan-proposing server. A server
// implements exactly this shape; everything else — registry lookup, args
// schemas, the scratch-kernel dry run — stays on this side of the wire, so a
// wrong server can only ever produce a rejected proposal, never a document.
import type { AiChatTurn, AiPlan, AiPlanValidationIssue, AssembledAiContext } from '../types';

export const AI_PLAN_WIRE_VERSION = 1;

const CHARACTERS_PER_TOKEN_ESTIMATE = 4;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, candidate: unknown) => {
    if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
      return candidate;
    }
    return Object.fromEntries(
      Object.entries(candidate).sort(([left], [right]) => compareText(left, right)),
    );
  });
}

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
  /** The conversation so far, oldest first, so follow-up requests resolve. */
  history?: readonly AiChatTurn[];
  attempt?: AiPlanWireAttempt;
}

/**
 * Deterministic estimate for the exact request envelope a remote provider
 * serializes. Only wire-contract fields participate, in canonical order, so
 * request text, history, and a rejected repair attempt cannot bypass the same
 * hard budget that protects the assembled context.
 */
export function estimateAiPlanWireRequestTokens(request: AiPlanWireRequest): number {
  const canonical: AiPlanWireRequest = {
    version: request.version,
    request: request.request,
    context: request.context,
    ...(request.history === undefined ? {} : { history: request.history }),
    ...(request.attempt === undefined ? {} : { attempt: request.attempt }),
  };
  return Math.max(1, Math.ceil(stableStringify(canonical).length / CHARACTERS_PER_TOKEN_ESTIMATE));
}

/** A server answers with a plan, or with an explicit refusal it can word itself. */
export type AiPlanWireResponse = AiPlan | { refusal: string };

/**
 * OPTIONAL streaming shape. The client advertises
 * `accept: text/event-stream, application/json`; a server that streams answers
 * the same POST as SSE instead of one JSON body:
 *
 *   event: status
 *   data: {"text": "Reading the catalog…"}     (any number of these)
 *
 *   event: result
 *   data: <AiPlanWireResponse>                  (exactly one, then the stream ends)
 *
 * `status` text feeds the UI's live narration; `result` is validated exactly
 * like the plain JSON body. A server that ignores the accept header and
 * answers plain JSON remains fully conformant. Aborting the request is the
 * cancellation signal — a server should stop the underlying work when the
 * connection closes.
 */
export interface AiPlanWireStatus {
  text: string;
}
