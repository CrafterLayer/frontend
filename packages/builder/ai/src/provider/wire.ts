// The HTTP contract between this package and a plan-proposing server. A server
// implements exactly this shape; everything else — registry lookup, args
// schemas, the scratch-kernel dry run — stays on this side of the wire, so a
// wrong server can only ever produce a rejected proposal, never a document.
import type { AiChatTurn, AiPlan, AiPlanValidationIssue, AssembledAiContext } from '../types';
import { estimateCanonicalJsonTokens } from '../internal/canonical-json';

export const AI_PLAN_WIRE_VERSION = 1;
/** Maximum number of Unicode code points exposed from an invalid-output server message. */
export const AI_PLAN_WIRE_MAX_INVALID_OUTPUT_MESSAGE_LENGTH = 512;

/** Normalize and cap untrusted invalid-output prose before it crosses a host boundary. */
export function boundAiPlanWireInvalidOutputMessage(message: string): string {
  const normalized = message.replace(/\s+/gu, ' ').trim();
  if (normalized === '') {
    return 'The assistant server reported invalid output.';
  }
  const characters: string[] = [];
  for (const character of normalized) {
    if (characters.length === AI_PLAN_WIRE_MAX_INVALID_OUTPUT_MESSAGE_LENGTH) break;
    characters.push(character);
  }
  return characters.join('');
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
  return estimateCanonicalJsonTokens(canonical);
}

/** A server explicitly reports model output that could not be represented as a plan. */
export interface AiPlanWireInvalidOutputResponse {
  version: typeof AI_PLAN_WIRE_VERSION;
  invalidOutput: Readonly<{ message: string }>;
}

/**
 * A server answers with a plan, refusal, or versioned invalid-output outcome.
 * Direct unversioned plan/refusal shapes remain accepted for backwards compatibility.
 */
export type AiPlanWireResponse =
  | AiPlan
  | (AiPlan & { version: typeof AI_PLAN_WIRE_VERSION })
  | { refusal: string; version?: typeof AI_PLAN_WIRE_VERSION }
  | AiPlanWireInvalidOutputResponse;

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
