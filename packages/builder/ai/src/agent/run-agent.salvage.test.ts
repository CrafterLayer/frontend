import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, fixtureBlocks, landingFixture, seededIds } from '@craftkit/builder-core/testing';

import { AiPlanRejectedError } from '../plan';
import type { AiPlan, AiPlanProvider } from '../types';
import { runAiAgent, type AiAgentEvent } from './index';

function kernel() {
  return createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(10), ids: seededIds('salvage-live') },
  });
}

function validationPorts(seed: string) {
  return { clock: fixedClock(20), ids: seededIds(seed) };
}

/**
 * Two good edits around one that names a node the document does not have.
 *
 * Before the salvage rung this whole answer was thrown away, and the person got
 * nothing at all for a request that cost a full generation.
 */
const mostlyGood: AiPlan = {
  rationale: 'Retitle the hero and tidy the section.',
  commands: [
    { command: 'setProp', args: { id: 'hero1', key: 'heading', value: 'First' } },
    { command: 'setProp', args: { id: 'no-such-node', key: 'heading', value: 'Doomed' } },
    { command: 'setProp', args: { id: 'hero1', key: 'tone', value: 'light' } },
  ],
};

/** A provider that makes the same mistake twice, which is the case that used to be fatal. */
function stubbornProvider(plan: AiPlan): AiPlanProvider {
  return {
    propose: () => Promise.resolve(plan),
    repair: () => Promise.resolve(plan),
  };
}

describe('runAiAgent, when the door refuses the answer twice', () => {
  it('applies the part that passes and says exactly what it dropped', async () => {
    const events: AiAgentEvent[] = [];
    const live = kernel();

    const result = await runAiAgent({
      runId: 'run-salvage',
      clock: fixedClock(100, 5),
      kernel: live,
      provider: stubbornProvider(mostlyGood),
      request: 'Retitle the hero',
      validationPorts: validationPorts('salvage'),
      apply: 'auto',
      onEvent: (event) => events.push(event),
    });

    expect(result.status).toBe('applied');
    expect(result.plan.commands).toHaveLength(2);

    const salvaged = events.find((event) => event.type === 'plan.salvaged');
    // `expect.stringContaining` is typed `any`; parking it in an `unknown`
    // keeps the matcher while satisfying no-unsafe-assignment.
    const mentionsTheGhost: unknown = expect.stringContaining('no-such-node');
    expect(salvaged).toMatchObject({
      kept: 2,
      dropped: [{ step: 2, command: 'setProp', reason: mentionsTheGhost }],
    });

    // The rescue is announced BEFORE the result, so nobody is shown a smaller
    // plan without being told it is smaller.
    const order = events.map(({ type }) => type);
    expect(order.indexOf('plan.salvaged')).toBeLessThan(order.indexOf('plan.applying'));

    // One transaction, and the document really changed.
    expect(live.transactions()).toHaveLength(1);
    expect(live.getDocument().nodes['hero1']?.props).toMatchObject({
      heading: 'First',
      tone: 'light',
    });
  });

  it('still fails when nothing in the answer survives', async () => {
    const events: AiAgentEvent[] = [];
    const live = kernel();

    /*
      The salvage is a rescue, not a way of always succeeding. An answer with no
      valid step must still fail loudly, because an empty plan reported as a
      result would be the agent claiming to have done something it did not do.
    */
    await expect(
      runAiAgent({
        runId: 'run-doomed',
        clock: fixedClock(100, 5),
        kernel: live,
        provider: stubbornProvider({
          rationale: 'All of it is wrong.',
          commands: [
            { command: 'setProp', args: { id: 'ghost-a', key: 'heading', value: 'no' } },
            { command: 'setProp', args: { id: 'ghost-b', key: 'heading', value: 'no' } },
          ],
        }),
        request: 'Retitle the hero',
        validationPorts: validationPorts('doomed'),
        apply: 'auto',
        onEvent: (event) => events.push(event),
      }),
    ).rejects.toBeInstanceOf(AiPlanRejectedError);

    expect(events.map(({ type }) => type)).not.toContain('plan.salvaged');
    expect(live.transactions()).toHaveLength(0);
  });

  it('says nothing about salvage when the answer was good all along', async () => {
    const events: AiAgentEvent[] = [];
    const live = kernel();

    await runAiAgent({
      runId: 'run-clean',
      clock: fixedClock(100, 5),
      kernel: live,
      provider: {
        propose: () =>
          Promise.resolve({
            rationale: 'A clean edit.',
            commands: [
              { command: 'setProp', args: { id: 'hero1', key: 'heading', value: 'Clean' } },
            ],
          }),
      },
      request: 'Retitle the hero',
      validationPorts: validationPorts('clean'),
      apply: 'auto',
      onEvent: (event) => events.push(event),
    });

    expect(events.map(({ type }) => type)).not.toContain('plan.salvaged');
  });
});
