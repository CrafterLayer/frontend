import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';

import type { AiPlan } from '../types';
import { runAiAgent, type AiAgentEvent } from './index';

const RUNS = 1_000;
const SEED = 0x0a6e17;

const plan: AiPlan = {
  rationale: 'Update one existing property.',
  commands: [
    { command: 'setProp', args: { id: 'hero1', key: 'heading', value: 'Property checked' } },
  ],
};

describe('bounded agent cancellation properties', () => {
  it(`never applies or emits after terminal cancellation across ${String(RUNS)} cut points`, async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 7 }), async (abortAt) => {
        const controller = new AbortController();
        const events: AiAgentEvent[] = [];
        const kernel = createBuilder({
          document: landingFixture(),
          extensions: [fixtureBlocks],
          ports: { clock: fixedClock(10), ids: seededIds(`cancel-live-${String(abortAt)}`) },
        });
        const before = kernel.getDocument();

        try {
          await runAiAgent({
            runId: `cancel-${String(abortAt)}`,
            clock: fixedClock(100),
            kernel,
            provider: { propose: () => Promise.resolve(plan) },
            request: 'Update the hero',
            validationPorts: {
              clock: fixedClock(20),
              ids: seededIds(`cancel-validation-${String(abortAt)}`),
            },
            apply: 'auto',
            signal: controller.signal,
            onEvent: (event) => {
              events.push(event);
              if (event.seq === abortAt) controller.abort();
            },
          });
          expect.unreachable('A cancellation cut point must reject the run.');
        } catch (cause) {
          expect(cause).toMatchObject({ name: 'AbortError' });
        }

        expect(kernel.getDocument()).toBe(before);
        expect(kernel.transactions()).toEqual([]);
        expect(events.at(-1)?.type).toBe('run.cancelled');
        expect(events.map(({ seq }) => seq)).toEqual(events.map((_event, index) => index));
        expect(
          events.filter(({ type }) =>
            ['run.completed', 'run.cancelled', 'run.failed'].includes(type),
          ),
        ).toHaveLength(1);
      }),
      { numRuns: RUNS, seed: SEED },
    );
  }, 120_000);
});
