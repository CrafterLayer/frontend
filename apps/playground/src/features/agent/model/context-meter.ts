/**
 * The context meter and the honest scope chip (2026-10-12), read off the engine's
 * `context.ready`: how big the latest request was against its budget, and which sections
 * the model saw whole when the engine focused an edit on them (fast-edits). Before this
 * the composer's chip said "Whole page" for a run that saw one section, and a request
 * over the budget was only ever a failure.
 *
 * Pure data and pure functions: no React, no kernel, no clock.
 */
import type { AiAgentEvent } from '@craftkit/builder';

import { blockTypeName } from './block-name';
import type { ContextChipView } from './view-types';

type ContextReady = Extract<AiAgentEvent, { type: 'context.ready' }>;

/** Past this share of the budget the meter turns to the warning token. */
export const CONTEXT_WARNING_SHARE = 0.8;

/** The sections a focused run showed whole, by name; the rest of the page was outlined. */
export interface ScopeFocusView {
  readonly names: readonly string[];
  /** Other sections were sent as one outline line each. */
  readonly outlined: boolean;
}

/** What the composer's meter draws (SPEC §4.17 addendum, 2026-10-12). */
export interface ContextMeterView {
  /** Estimated tokens of the latest request (`requestTokens`). */
  readonly used: number;
  /** The budget it was held to (`maxTokens`). */
  readonly max: number;
  /** `warning` past `CONTEXT_WARNING_SHARE` of the budget. */
  readonly level: 'normal' | 'warning';
  /** Older messages gave way so the request would fit. */
  readonly trimmed: boolean;
}

/*
  Both views are read by the composer, so they ride on the panel's view contracts. Declared
  by interface merging, every field optional, beside the code that fills them: view-types.ts
  is at its size baseline (packages/workspace-tools/file-size-baseline.json).
*/
declare module './view-types' {
  interface ScopeChipView {
    /** The sections the latest run saw whole: the chip reads "Focused: Pricing (+ outline)". */
    readonly focus?: ScopeFocusView | undefined;
  }
  interface AgentViewState {
    /** The latest measured request in this conversation; absent or null before one. */
    readonly contextMeter?: ContextMeterView | null | undefined;
  }
}

/** The latest request the engine measured in a conversation. Kept in the controller's UI state. */
export interface MeasuredContext {
  readonly sessionId: string;
  readonly used: number;
  readonly max: number;
  readonly trimmed: boolean;
  readonly focus?: ScopeFocusView | undefined;
}

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

function focusOf(event: ContextReady): ScopeFocusView | undefined {
  const focus = event.focus;
  if (focus === undefined || focus.whole.length === 0) return undefined;
  return {
    names: focus.whole.map(({ name, type }) =>
      name === undefined || name.trim() === '' ? blockTypeName(type) : name.trim(),
    ),
    outlined: focus.outlined > 0,
  };
}

/**
 * The measurement after `event`, for a run in `sessionId`. A model request replaces it; a
 * direct edit (no model, no request) keeps the size but drops the focus, which described a
 * request that is no longer the latest; anything else leaves it as it was.
 */
export function noteContext(
  previous: MeasuredContext | null,
  event: AiAgentEvent,
  sessionId: string,
): MeasuredContext | null {
  if (event.type !== 'context.ready') return previous;
  const { requestTokens, maxTokens } = event;
  if (isCount(requestTokens) && isCount(maxTokens) && maxTokens > 0) {
    const focus = focusOf(event);
    return {
      sessionId,
      used: requestTokens,
      max: maxTokens,
      trimmed: event.historyTrimmed !== undefined,
      ...(focus === undefined ? {} : { focus }),
    };
  }
  if (event.source !== 'direct' || previous?.sessionId !== sessionId) return previous;
  if (previous.focus === undefined) return previous;
  const { used, max, trimmed } = previous;
  return { sessionId, used, max, trimmed };
}

/** The meter for the active conversation, or null when nothing was measured in it. */
export function contextMeterView(
  measured: MeasuredContext | null,
  activeSessionId: string,
): ContextMeterView | null {
  if (measured?.sessionId !== activeSessionId) return null;
  return {
    used: measured.used,
    max: measured.max,
    level: measured.used > measured.max * CONTEXT_WARNING_SHARE ? 'warning' : 'normal',
    trimmed: measured.trimmed,
  };
}

/**
 * The composer's chips with the scope chip made honest: while the box is empty it speaks
 * of the latest request, so it names the sections that request was focused on. Once the
 * person writes the next one it is "Whole page" again: the engine reads each request's own
 * words, and a focus is only known once it has.
 */
export function withScopeFocus(
  chips: readonly ContextChipView[],
  measured: MeasuredContext | null,
  activeSessionId: string,
  draft: string,
): readonly ContextChipView[] {
  const focus = measured?.sessionId === activeSessionId ? measured.focus : undefined;
  if (focus === undefined || draft.trim() !== '') return chips;
  return chips.map((chip) => (chip.kind === 'page' ? { ...chip, focus } : chip));
}
