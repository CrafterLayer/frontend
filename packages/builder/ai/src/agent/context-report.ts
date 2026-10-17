import type { BuilderDocument, NodeId } from '@craftkit/builder-schema';

import { outlinePageSections, type AiDocumentFocus } from '../context/document-tree-mode';
import { DEFAULT_AI_CONTEXT_TOKEN_BUDGET } from '../plan/generate-plan';
import {
  AI_PLAN_WIRE_VERSION,
  estimateAiPlanWireRequestTokens,
  type AiPlanWireAttempt,
} from '../provider/wire';
import type { AiChatTurn, AiProposeOptions, AssembledAiContext } from '../types';
import type { RunAiAgentOptions } from './types';

/**
 * What `context.ready` says about the request a run is about to send (context meter,
 * 2026-10-12): its size against the budget, what of the conversation gave way to fit, and
 * which sections of the page the model sees whole. A host shows it beside its context chip,
 * so "Whole page" is never claimed for a run that saw one section.
 */

/** One top-level section a focused run shows whole, by the name a person knows it by. */
export interface AiContextFocusSection {
  readonly id: NodeId;
  readonly type: string;
  /** Its label, else its first heading, else its anchor; absent when it has none. */
  readonly name?: string;
}

/** The page as a focused run shows it: these sections whole, every other one outlined. */
export interface AiContextFocusReport {
  readonly kind: AiDocumentFocus['kind'];
  readonly whole: readonly AiContextFocusSection[];
  /** How many other top-level sections it sees as one outline line each. */
  readonly outlined: number;
}

/** The fields of a `context.ready` event. Direct edits send nothing, and carry only the counts. */
export interface AiContextReadyDetails {
  fragmentCount: number;
  totalTokens: number;
  /** The model path's estimated wire request (request, context, history): what the budget holds. */
  requestTokens?: number;
  /** The budget that request is held to (`policy.maxContextTokens`, 64,000 by default). */
  maxTokens?: number;
  /** The conversation gave way to fit: entries left out (the oldest) and entries cut short. */
  historyTrimmed?: { readonly dropped: number; readonly capped: number };
  /** Present when the run focused its document (fast-edits) rather than showing it all. */
  focus?: AiContextFocusReport;
}

/** The estimated wire request one provider call sends, as the budget measures it. */
export function wireRequestTokens(
  request: string,
  context: AssembledAiContext,
  live: AiProposeOptions | undefined,
  attempt?: AiPlanWireAttempt,
): number {
  return estimateAiPlanWireRequestTokens({
    version: AI_PLAN_WIRE_VERSION,
    request,
    context,
    ...(live?.history === undefined ? {} : { history: live.history }),
    ...(attempt === undefined ? {} : { attempt }),
  });
}

/** The focus as a person reads it: the sections shown whole, by name, and how many outlined. */
export function focusReport(
  document: BuilderDocument,
  focus: AiDocumentFocus,
): AiContextFocusReport {
  const sections = outlinePageSections(document);
  const shown = new Set(focus.nodeIds);
  const whole = sections
    .filter(({ id }) => shown.has(id))
    .map(({ id, type, label, heading, anchor }) => {
      const name = label ?? heading ?? anchor;
      return name === undefined ? { id, type } : { id, type, name };
    });
  return { kind: focus.kind, whole, outlined: sections.length - whole.length };
}

/** What fitting left of `given` in `sent` (generate-plan's history-budget.ts), when anything. */
function historyTrimmed(
  given: readonly AiChatTurn[] | undefined,
  sent: readonly AiChatTurn[] | undefined,
): AiContextReadyDetails['historyTrimmed'] {
  if (given === undefined || sent === given) return undefined;
  const kept = sent ?? [];
  const dropped = Math.max(0, given.length - kept.length);
  const capped = kept.filter(({ text }, index) => text !== given[dropped + index]?.text).length;
  return dropped === 0 && capped === 0 ? undefined : { dropped, capped };
}

/** The fields only the model path's `context.ready` carries. */
export type AiContextReadyReport = Omit<AiContextReadyDetails, 'fragmentCount' | 'totalTokens'>;

/**
 * Called once per run, with the first context a provider is asked with: what the run
 * learned from it (`run-agent.ts` keeps the context), and the report to send with it.
 */
export type OnContextReady = (
  context: AssembledAiContext,
  sent: readonly AiChatTurn[] | undefined,
  requestTokens: number,
) => AiContextReadyReport;

/**
 * The model path's `context.ready` report for `run`: `sent` is the history the provider
 * was handed (fitted to the budget), compared with the run's own to say what gave way.
 */
export function contextReadyReport(
  run: Pick<RunAiAgentOptions, 'kernel' | 'history' | 'policy'>,
  focus: AiDocumentFocus | undefined,
  requestTokens: number,
  sent: readonly AiChatTurn[] | undefined,
): AiContextReadyReport {
  const trimmed = historyTrimmed(run.history, sent);
  return {
    requestTokens,
    maxTokens: run.policy?.maxContextTokens ?? DEFAULT_AI_CONTEXT_TOKEN_BUDGET,
    ...(trimmed === undefined ? {} : { historyTrimmed: trimmed }),
    ...(focus === undefined ? {} : { focus: focusReport(run.kernel.getDocument(), focus) }),
  };
}
