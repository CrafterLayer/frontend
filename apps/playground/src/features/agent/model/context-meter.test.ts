/**
 * The context meter and the honest scope chip (2026-10-12), read off `context.ready`. Ours
 * to prove: only a model request is measured; a direct edit takes the focus away but not
 * the size; the meter belongs to the conversation it was measured in and warns past 80%;
 * and the scope chip names the focused sections only while the box is empty.
 */
import { describe, expect, it } from 'vitest';

import type { AiAgentEvent } from '@craftkit/builder';

import {
  contextMeterView,
  noteContext,
  withScopeFocus,
  type MeasuredContext,
} from './context-meter';
import type { ContextChipView } from './view-types';

type ContextReady = Extract<AiAgentEvent, { type: 'context.ready' }>;

function ready(extra: Partial<ContextReady> = {}): AiAgentEvent {
  return {
    type: 'context.ready',
    runId: 'run-1',
    seq: 3,
    at: 10,
    fragmentCount: 4,
    totalTokens: 900,
    requestTokens: 12_345,
    maxTokens: 64_000,
    ...extra,
  };
}

const PAGE: ContextChipView = { kind: 'page', id: 'page' };
const HERO: ContextChipView = { kind: 'selection', id: 'n-hero', label: 'Hero', stale: false };

const MEASURED: MeasuredContext = {
  sessionId: 's1',
  used: 12_345,
  max: 64_000,
  trimmed: false,
  focus: { names: ['Pricing'], outlined: true },
};

describe('noteContext', () => {
  it('measures a model request: its size, its budget, and what it focused on', () => {
    const event = ready({
      historyTrimmed: { dropped: 2, capped: 0 },
      focus: {
        kind: 'edit',
        whole: [
          { id: 'pricing', type: 'customCode', name: 'Pricing' },
          { id: 'faq', type: 'faqList' },
        ],
        outlined: 6,
      },
    });
    expect(noteContext(null, event, 's1')).toEqual({
      sessionId: 's1',
      used: 12_345,
      max: 64_000,
      trimmed: true,
      // A section with no name of its own reads as its block type, as a chip names it.
      focus: { names: ['Pricing', 'Faq List'], outlined: true },
    });
  });

  it('measures an unfocused request without a focus', () => {
    expect(noteContext(MEASURED, ready(), 's1')).toEqual({
      sessionId: 's1',
      used: 12_345,
      max: 64_000,
      trimmed: false,
    });
  });

  it('keeps the size but drops the focus after a direct edit, which sent nothing', () => {
    const direct = {
      type: 'context.ready',
      runId: 'run-2',
      seq: 3,
      at: 10,
      fragmentCount: 0,
      totalTokens: 0,
      source: 'direct',
      tokens: 0,
    } as AiAgentEvent;
    expect(noteContext(MEASURED, direct, 's1')).toEqual({
      sessionId: 's1',
      used: 12_345,
      max: 64_000,
      trimmed: false,
    });
    // Another conversation's measurement is not this edit's to change.
    expect(noteContext(MEASURED, direct, 's2')).toBe(MEASURED);
  });

  it('ignores every other event, and a size that is not a count', () => {
    const proposing = { type: 'plan.proposing', runId: 'run-1', seq: 4, at: 11 } as AiAgentEvent;
    expect(noteContext(MEASURED, proposing, 's1')).toBe(MEASURED);
    expect(noteContext(MEASURED, ready({ requestTokens: Number.NaN }), 's1')).toBe(MEASURED);
    expect(noteContext(null, ready({ maxTokens: 0 }), 's1')).toBeNull();
  });
});

describe('contextMeterView', () => {
  it('shows the active conversation’s measurement, and nothing for another one', () => {
    expect(contextMeterView(MEASURED, 's1')).toEqual({
      used: 12_345,
      max: 64_000,
      level: 'normal',
      trimmed: false,
    });
    expect(contextMeterView(MEASURED, 's2')).toBeNull();
    expect(contextMeterView(null, 's1')).toBeNull();
  });

  it('warns past 80% of the budget, not at it', () => {
    expect(contextMeterView({ ...MEASURED, used: 51_200 }, 's1')?.level).toBe('normal');
    expect(contextMeterView({ ...MEASURED, used: 51_201 }, 's1')?.level).toBe('warning');
  });
});

describe('withScopeFocus', () => {
  it('names the focused sections on the page chip while the box is empty', () => {
    expect(withScopeFocus([PAGE], MEASURED, 's1', '  ')).toEqual([
      { kind: 'page', id: 'page', focus: { names: ['Pricing'], outlined: true } },
    ]);
  });

  it('is "Whole page" again once the next request is being written', () => {
    const chips = [PAGE];
    expect(withScopeFocus(chips, MEASURED, 's1', 'make it blue')).toBe(chips);
  });

  it('leaves block chips, another conversation and an unfocused request alone', () => {
    const blocks = [HERO];
    expect(withScopeFocus(blocks, MEASURED, 's1', '')).toEqual(blocks);
    const chips = [PAGE];
    expect(withScopeFocus(chips, MEASURED, 's2', '')).toBe(chips);
    const unfocused: MeasuredContext = { sessionId: 's1', used: 1, max: 64_000, trimmed: false };
    expect(withScopeFocus(chips, unfocused, 's1', '')).toBe(chips);
  });
});
