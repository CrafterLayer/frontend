import { estimateAiPlanWireRequestTokens, type AiPlanWireRequest } from '../provider/wire';
import type { AiChatTurn } from '../types';

/**
 * Fitting a request's conversation to the context budget, instead of failing the run.
 *
 * The budget (64,000 estimated tokens by default) holds the whole wire request. The page,
 * the selection, the skills and the request itself are what the run is FOR, so none of
 * them is ever cut here; the history is what grows without bound across a long session,
 * and is the one part a follow-up can lose some of and still be understood:
 *
 * 1. the oldest exchanges go first, a whole exchange at a time, so what is sent still
 *    opens on a person's turn (the Messages API refuses an assistant turn first), down to
 *    the newest exchange;
 * 2. still over, every entry left is cut to `AI_HISTORY_ENTRY_MAX_CHARS`, ellipsis marked;
 * 3. still over, `AiContextBudgetError`, as before: the request does not fit by itself.
 */

/** The longest a history entry stays once only the newest exchange is left and it is still over. */
export const AI_HISTORY_ENTRY_MAX_CHARS = 2_000;

const ELLIPSIS = '…';

export class AiContextBudgetError extends Error {
  override readonly name = 'AiContextBudgetError';

  constructor(
    readonly estimatedTokens: number,
    readonly maxTokens: number,
  ) {
    super(
      `AI context budget exceeded: estimated ${String(estimatedTokens)} tokens, maximum ${String(maxTokens)}.`,
    );
  }
}

/** What fitting a request's history did. */
export interface AiHistoryFit {
  /** The history to send: the given array itself when it already fit. */
  readonly history: readonly AiChatTurn[] | undefined;
  /** The wire request's estimate with that history. */
  readonly estimatedTokens: number;
  /** Entries left out, oldest first. */
  readonly dropped: number;
  /** Entries kept but cut to `AI_HISTORY_ENTRY_MAX_CHARS`. */
  readonly capped: number;
}

function withHistory(
  request: AiPlanWireRequest,
  history: readonly AiChatTurn[] | undefined,
): AiPlanWireRequest {
  if (history !== undefined) return { ...request, history };
  const rest = { ...request };
  delete rest.history;
  return rest;
}

function capped(turn: AiChatTurn): AiChatTurn {
  if (turn.text.length <= AI_HISTORY_ENTRY_MAX_CHARS) return turn;
  const kept = turn.text.slice(0, AI_HISTORY_ENTRY_MAX_CHARS - ELLIPSIS.length).trimEnd();
  return { role: turn.role, text: `${kept}${ELLIPSIS}` };
}

/**
 * The history `request` fits `maxTokens` with (see the module comment for the order).
 * Throws `AiContextBudgetError`, with the smallest estimate it reached, when nothing
 * the history may give up is enough.
 */
export function fitAiPlanWireHistory(request: AiPlanWireRequest, maxTokens: number): AiHistoryFit {
  const whole = estimateAiPlanWireRequestTokens(request);
  if (whole <= maxTokens) {
    return { history: request.history, estimatedTokens: whole, dropped: 0, capped: 0 };
  }
  const given = request.history ?? [];
  // Where each window may start: a person's turn after the first entry.
  const starts = given.flatMap((turn, index) => (index > 0 && turn.role === 'user' ? [index] : []));
  for (const start of starts) {
    const window = given.slice(start);
    const estimatedTokens = estimateAiPlanWireRequestTokens(withHistory(request, window));
    if (estimatedTokens <= maxTokens) {
      return { history: window, estimatedTokens, dropped: start, capped: 0 };
    }
  }
  // The newest exchange, or nothing when no turn of the person's opens one.
  const newest = starts.at(-1) ?? (given[0]?.role === 'user' ? 0 : given.length);
  const left = given.slice(newest);
  const cut = left.map(capped);
  const history = cut.length === 0 ? undefined : cut;
  const estimatedTokens = estimateAiPlanWireRequestTokens(withHistory(request, history));
  if (estimatedTokens > maxTokens) throw new AiContextBudgetError(estimatedTokens, maxTokens);
  return {
    history,
    estimatedTokens,
    dropped: newest,
    capped: cut.filter((turn, index) => turn !== left[index]).length,
  };
}

/**
 * `options` carrying the history its wire `request` fits the budget with: the same object
 * when nothing had to go, so a caller can tell (and a cache keyed on it still hits).
 */
export function withHistoryInBudget<T extends { readonly history?: readonly AiChatTurn[] }>(
  options: T,
  request: AiPlanWireRequest,
  maxTokens: number,
): T {
  const { history } = fitAiPlanWireHistory(request, maxTokens);
  if (history === request.history) return options;
  if (history !== undefined) return { ...options, history };
  const rest = { ...options };
  delete (rest as { history?: unknown }).history;
  return rest;
}
