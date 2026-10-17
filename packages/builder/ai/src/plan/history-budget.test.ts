import { describe, expect, it } from 'vitest';

import {
  AI_PLAN_WIRE_VERSION,
  estimateAiPlanWireRequestTokens,
  type AiPlanWireRequest,
} from '../provider/wire';
import type { AiChatTurn, AssembledAiContext } from '../types';
import {
  AI_HISTORY_ENTRY_MAX_CHARS,
  AiContextBudgetError,
  fitAiPlanWireHistory,
  withHistoryInBudget,
} from './history-budget';

/** The estimator reads only the serialized shape, so a small stand-in context is enough. */
const CONTEXT = {
  fragments: [],
  totalTokens: 0,
  blocks: [],
  document: { schemaVersion: 1, surface: 'page', dir: 'ltr', rootId: 'root', nodes: [] },
  selection: { ids: [] },
} as unknown as AssembledAiContext;

function wire(history?: readonly AiChatTurn[], request = 'make the pricing title bigger') {
  const base: AiPlanWireRequest = { version: AI_PLAN_WIRE_VERSION, request, context: CONTEXT };
  return history === undefined ? base : { ...base, history };
}

const user = (text: string): AiChatTurn => ({ role: 'user', text });
const assistant = (text: string): AiChatTurn => ({ role: 'assistant', text });

/** Three exchanges, each about `size` characters a side, oldest first. */
function conversation(size: number): readonly AiChatTurn[] {
  return [
    user(`first ${'a'.repeat(size)}`),
    assistant(`first answer ${'b'.repeat(size)}`),
    user(`second ${'c'.repeat(size)}`),
    assistant(`second answer ${'d'.repeat(size)}`),
    user(`third ${'e'.repeat(size)}`),
    assistant(`third answer ${'f'.repeat(size)}`),
  ];
}

describe('fitAiPlanWireHistory', () => {
  it('sends a request that fits exactly as it was given', () => {
    const history = conversation(10);
    const request = wire(history);
    const fit = fitAiPlanWireHistory(request, 10_000);

    expect(fit.history).toBe(history);
    expect(fit).toMatchObject({ dropped: 0, capped: 0 });
    expect(fit.estimatedTokens).toBe(estimateAiPlanWireRequestTokens(request));
  });

  it('drops the oldest exchange first, and what is left still opens on a person', () => {
    const history = conversation(1_000);
    const withoutFirst = estimateAiPlanWireRequestTokens(wire(history.slice(2)));
    const fit = fitAiPlanWireHistory(wire(history), withoutFirst);

    expect(fit.history).toEqual(history.slice(2));
    expect(fit.history?.[0]?.role).toBe('user');
    expect(fit).toMatchObject({ dropped: 2, capped: 0, estimatedTokens: withoutFirst });
  });

  it('never opens on an assistant turn, even when one assistant line would have fit', () => {
    // Room for everything but the first user turn: the answer to it goes too.
    const history = conversation(1_000);
    const room = estimateAiPlanWireRequestTokens(wire(history.slice(1)));
    const fit = fitAiPlanWireHistory(wire(history), room);

    expect(fit.history?.[0]).toEqual(history[2]);
    expect(fit.dropped).toBe(2);
  });

  it('keeps dropping down to the newest exchange, then cuts each entry left with an ellipsis', () => {
    const history = conversation(5_000);
    const newest = history.slice(4);
    const room = estimateAiPlanWireRequestTokens(wire(newest)) - 1;
    const fit = fitAiPlanWireHistory(wire(history), room);

    expect(fit.dropped).toBe(4);
    expect(fit.capped).toBe(2);
    expect(fit.history).toHaveLength(2);
    for (const [index, turn] of (fit.history ?? []).entries()) {
      expect(turn.role).toBe(newest[index]?.role);
      expect(turn.text.length).toBeLessThanOrEqual(AI_HISTORY_ENTRY_MAX_CHARS);
      expect(turn.text.endsWith('…')).toBe(true);
      expect(newest[index]?.text.startsWith(turn.text.slice(0, -1))).toBe(true);
    }
    expect(fit.estimatedTokens).toBeLessThanOrEqual(room);
  });

  it('leaves a short entry of the newest exchange whole while it cuts a long one', () => {
    const history = [user('short question'), assistant('x'.repeat(10_000))];
    const room = estimateAiPlanWireRequestTokens(wire(history)) - 100;
    const fit = fitAiPlanWireHistory(wire(history), room);

    expect(fit.history?.[0]).toBe(history[0]);
    expect(fit.history?.[1]?.text).toHaveLength(AI_HISTORY_ENTRY_MAX_CHARS);
    expect(fit).toMatchObject({ dropped: 0, capped: 1 });
  });

  it('sends no history at all when none of it opens on a person and it does not fit', () => {
    const history = [assistant('y'.repeat(10_000))];
    const room = estimateAiPlanWireRequestTokens(wire()) + 5;
    const fit = fitAiPlanWireHistory(wire(history), room);

    expect(fit.history).toBeUndefined();
    expect(fit).toMatchObject({ dropped: 1, capped: 0 });
  });

  it('throws only when the request does not fit with the history cut to its newest exchange', () => {
    const history = conversation(5_000);
    const request = wire(history, 'z'.repeat(40_000));

    const thrown = ((): unknown => {
      try {
        return fitAiPlanWireHistory(request, 10_000);
      } catch (error: unknown) {
        return error;
      }
    })();

    expect(thrown).toBeInstanceOf(AiContextBudgetError);
    // The smallest request it could reach, not the one it was given.
    expect(thrown).toMatchObject({ maxTokens: 10_000 });
    expect((thrown as AiContextBudgetError).estimatedTokens).toBeLessThan(
      estimateAiPlanWireRequestTokens(request),
    );
  });

  it('throws for a request too large by itself, with no history to give up', () => {
    expect(() => fitAiPlanWireHistory(wire(undefined, 'z'.repeat(100_000)), 10_000)).toThrow(
      /context budget/i,
    );
  });
});

describe('withHistoryInBudget', () => {
  it('returns the same options object when nothing had to go', () => {
    const history = conversation(10);
    const options = { history, signal: undefined };

    expect(withHistoryInBudget(options, wire(history), 10_000)).toBe(options);
  });

  it('carries the fitted history and keeps every other option', () => {
    const history = conversation(1_000);
    const room = estimateAiPlanWireRequestTokens(wire(history.slice(4)));
    const options = { history, label: 'kept' };
    const fitted = withHistoryInBudget(options, wire(history), room);

    expect(fitted).toEqual({ history: history.slice(4), label: 'kept' });
    expect(options.history).toBe(history);
  });

  it('removes the history key when nothing of it is left', () => {
    const history = [assistant('y'.repeat(10_000))];
    const room = estimateAiPlanWireRequestTokens(wire()) + 5;
    const fitted = withHistoryInBudget({ history, label: 'kept' }, wire(history), room);

    expect(fitted).toEqual({ label: 'kept' });
    expect('history' in fitted).toBe(false);
  });
});
