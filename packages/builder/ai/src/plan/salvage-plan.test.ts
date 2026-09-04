import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import {
  fakeExtension,
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';

import type { AiPlan } from '../types';
import { salvageAiPlan } from './salvage-plan';
import { validateAiPlan } from './validate-plan';

function planKernel() {
  return createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks, fakeExtension],
    ports: { clock: fixedClock(10), ids: seededIds('live') },
  });
}

function ports(seed = 'salvage') {
  return { clock: fixedClock(20), ids: seededIds(seed) };
}

/**
 * A node the landing fixture already contains, with a prop it really declares.
 * `hero1` carries `heading`; asking for a prop the type does not declare is
 * itself a door rejection, which would make these tests pass for the wrong
 * reason.
 */
function firstEditableId(kernel: ReturnType<typeof planKernel>): string {
  const root = kernel.getDocument().nodes['root'];
  const id = root?.slots?.['default']?.[0];
  if (id === undefined) throw new Error('The landing fixture has no first section to edit.');
  return id;
}

function plan(commands: AiPlan['commands']): AiPlan {
  return { rationale: 'Salvage fixture.', commands };
}

describe('salvageAiPlan', () => {
  it('keeps the good steps of a plan the door refused as a whole', () => {
    const kernel = planKernel();
    const target = firstEditableId(kernel);
    const candidate = plan([
      { command: 'setProp', args: { id: target, key: 'heading', value: 'Kept one' } },
      { command: 'setProp', args: { id: 'no-such-node', key: 'heading', value: 'Doomed' } },
      { command: 'setProp', args: { id: target, key: 'heading', value: 'Kept two' } },
    ]);

    // The premise: today this plan is a total loss.
    expect(validateAiPlan(candidate, kernel, ports()).ok).toBe(false);

    const salvaged = salvageAiPlan(candidate, kernel, ports());

    expect(salvaged?.kept).toBe(2);
    expect(salvaged?.plan.commands).toHaveLength(2);
    // `expect.stringContaining` is typed `any`; parking it in an `unknown`
    // keeps the matcher while satisfying no-unsafe-assignment.
    const mentionsTheGhost: unknown = expect.stringContaining('no-such-node');
    expect(salvaged?.dropped).toEqual([
      { step: 2, command: 'setProp', reason: mentionsTheGhost },
    ]);
  });

  it('returns a plan the real validator accepts, not one that merely looks right', () => {
    const kernel = planKernel();
    const target = firstEditableId(kernel);
    const salvaged = salvageAiPlan(
      plan([
        { command: 'setProp', args: { id: 'ghost', key: 'heading', value: 'no' } },
        { command: 'setProp', args: { id: target, key: 'heading', value: 'yes' } },
      ]),
      kernel,
      ports(),
    );

    expect(salvaged).toBeDefined();
    if (salvaged === undefined) return;
    /*
      Re-validating the RESULT is the whole safety argument: a salvage that
      returned an unchecked subsequence would be a second, weaker door into a
      person's document.
    */
    expect(validateAiPlan(salvaged.plan, kernel, ports()).ok).toBe(true);
  });

  it('drops a step that depended on one already dropped, rather than orphaning it', () => {
    const kernel = planKernel();
    /*
      The causal case, and the reason this is a search rather than a filter. The
      insert is refused (`page` is not insertable into a page's default slot),
      so the setProp naming the node it would have created cannot stand either —
      and nothing here had to KNOW that: the second step simply fails its own
      check once the first is gone.
    */
    const candidate = plan([
      { command: 'insertNode', args: { type: 'page', parentId: 'root', slot: 'default' } },
      { command: 'setProp', args: { id: 'nd-0001', key: 'heading', value: 'orphan' } },
    ]);

    expect(salvageAiPlan(candidate, kernel, ports())).toBeUndefined();
  });

  it('reports nothing salvageable rather than an empty plan', () => {
    const kernel = planKernel();
    const salvaged = salvageAiPlan(
      plan([{ command: 'setProp', args: { id: 'ghost', key: 'heading', value: 'no' } }]),
      kernel,
      ports(),
    );
    // An empty plan applied as a "recovery" would report success for doing nothing.
    expect(salvaged).toBeUndefined();
  });

  it('leaves an already valid plan exactly as it is', () => {
    const kernel = planKernel();
    const target = firstEditableId(kernel);
    const candidate = plan([
      { command: 'setProp', args: { id: target, key: 'heading', value: 'One' } },
      { command: 'setProp', args: { id: target, key: 'heading', value: 'Two' } },
    ]);

    const salvaged = salvageAiPlan(candidate, kernel, ports());

    expect(salvaged?.kept).toBe(2);
    expect(salvaged?.dropped).toEqual([]);
    expect(salvaged?.plan.commands).toEqual(candidate.commands);
  });

  it('carries the rationale and follow-up of the plan it rescued', () => {
    const kernel = planKernel();
    const target = firstEditableId(kernel);
    const candidate: AiPlan = {
      rationale: 'Rename the first section.',
      followUp: 'Want the rest recoloured?',
      commands: [
        { command: 'setProp', args: { id: target, key: 'heading', value: 'Renamed' } },
        { command: 'setProp', args: { id: 'ghost', key: 'heading', value: 'no' } },
      ],
    };

    const salvaged = salvageAiPlan(candidate, kernel, ports());

    // The words belong to the answer, not to the steps that survived it.
    expect(salvaged?.plan.rationale).toBe('Rename the first section.');
    expect(salvaged?.plan.followUp).toBe('Want the rest recoloured?');
  });

  it('does not touch the live document while it searches', () => {
    const kernel = planKernel();
    const target = firstEditableId(kernel);
    const before = JSON.stringify(kernel.getDocument());

    salvageAiPlan(
      plan([
        { command: 'setProp', args: { id: target, key: 'heading', value: 'Changed' } },
        { command: 'setProp', args: { id: 'ghost', key: 'heading', value: 'no' } },
      ]),
      kernel,
      ports(),
    );

    expect(JSON.stringify(kernel.getDocument())).toBe(before);
    expect(kernel.transactions()).toHaveLength(0);
  });
});
