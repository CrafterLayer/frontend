/**
 * Built-in skills the person switched off (2026-10-14): the helpers every lane shares, and the
 * edit lane (`runAiAgent`), where a switched-off skill must not wake by its words, by a
 * dependency or by a pin — while an explicit pick and the engine's required skills still win.
 */
import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';

import {
  createCraftkitAiSkillRegistry,
  type AiSkillPrepareOptions,
  type AiSkillRegistry,
} from '../skills';
import type { AiPlan } from '../types';
import {
  ENGINE_REQUIRED_SKILL_IDS,
  excludedSkillIdsOf,
  excludingRegistry,
  withoutExcluded,
} from './excluded-skills';
import { stepSkills, withHostSkills } from './host-skills';
import { runAiAgent } from './index';
import { pinningRegistry } from './pinning-registry';
import type { RunAiAgentOptions } from './types';

const DATA_VIZ = 'craftkit.data-viz';

describe('excludedSkillIdsOf', () => {
  it('keeps the person’s exclusions, without duplicates', () => {
    expect(excludedSkillIdsOf({})).toEqual([]);
    expect(excludedSkillIdsOf({ excludedSkillIds: [DATA_VIZ, DATA_VIZ, 'x.b'] })).toEqual([
      DATA_VIZ,
      'x.b',
    ]);
  });

  it('never excludes an engine-required skill', () => {
    expect(
      excludedSkillIdsOf({ excludedSkillIds: [...ENGINE_REQUIRED_SKILL_IDS, DATA_VIZ] }),
    ).toEqual([DATA_VIZ]);
  });

  it('lets an explicit pick win over a switch', () => {
    expect(
      excludedSkillIdsOf({ excludedSkillIds: [DATA_VIZ, 'x.b'], selectedSkillIds: [DATA_VIZ] }),
    ).toEqual(['x.b']);
  });

  it('withoutExcluded keeps the order and returns the same list when nothing is excluded', () => {
    const ids = ['a', 'b', 'c'];
    expect(withoutExcluded(ids, [])).toBe(ids);
    expect(withoutExcluded(ids, ['b'])).toEqual(['a', 'c']);
  });
});

describe('the host’s step helpers', () => {
  it('withHostSkills leaves out a switched-off id, host-named or optional', () => {
    expect(
      withHostSkills({ hostSkillIds: ['user.a', 'x.off'], excludedSkillIds: ['x.off', 'x.c'] }, [
        'x.c',
        'x.d',
      ]),
    ).toEqual(['user.a', 'x.d']);
    // Without host ids the optional list is still filtered.
    expect(withHostSkills({ excludedSkillIds: ['x.c'] }, ['x.c', 'x.d'])).toEqual(['x.d']);
  });

  it('withHostSkills keeps an explicit pick the person also switched off', () => {
    expect(
      withHostSkills(
        { hostSkillIds: ['x.off'], excludedSkillIds: ['x.off'], selectedSkillIds: ['x.off'] },
        ['x.d'],
      ),
    ).toEqual(['x.off', 'x.d']);
  });

  it('stepSkills hands a step the effective exclusions only when there are any', () => {
    expect(stepSkills({ excludedSkillIds: [] })).toEqual({});
    expect(
      stepSkills({
        excludedSkillIds: ['craftkit.build-fill', DATA_VIZ, 'x.b'],
        selectedSkillIds: ['x.b'],
      }),
    ).toEqual({ excludedSkillIds: [DATA_VIZ] });
  });
});

/** The craftkit registry, recording every prepare it is asked for. */
function spied(): {
  readonly registry: AiSkillRegistry;
  readonly prepared: AiSkillPrepareOptions[];
} {
  const inner = createCraftkitAiSkillRegistry();
  const prepared: AiSkillPrepareOptions[] = [];
  return {
    prepared,
    registry: {
      list: () => inner.list(),
      get: (id) => inner.get(id),
      readSkill: (id) => inner.readSkill(id),
      listReferences: (id) => inner.listReferences(id),
      readReference: (id, path) => inner.readReference(id, path),
      prepare: (options) => {
        prepared.push(options);
        return inner.prepare(options);
      },
    },
  };
}

describe('excludingRegistry and pinningRegistry', () => {
  it('adds the exclusions to every prepare, merged with the caller’s own', () => {
    const { registry, prepared } = spied();
    excludingRegistry(registry, [DATA_VIZ]).prepare({
      request: 'a chart of sales',
      excludedSkillIds: ['x.b'],
    });
    expect(prepared[0]?.excludedSkillIds).toEqual(['x.b', DATA_VIZ]);
    expect(excludingRegistry(registry, [])).toBe(registry);
  });

  it('never pins a switched-off playbook', () => {
    const registry = createCraftkitAiSkillRegistry();
    const view = pinningRegistry(
      registry,
      undefined,
      () => ['craftkit.pixi-stories', 'craftkit.pixi-v8-core'],
      ['craftkit.pixi-stories'],
    );
    const active = view.prepare({ request: '', auto: false }).active.map(({ id }) => id);
    expect(active).toContain('craftkit.pixi-v8-core');
    expect(active).not.toContain('craftkit.pixi-stories');
  });
});

const plan: AiPlan = {
  rationale: 'Update the hero.',
  commands: [{ command: 'setProp', args: { id: 'hero1', key: 'heading', value: 'Sales' } }],
};

function edit(extra: Partial<RunAiAgentOptions>) {
  return runAiAgent({
    runId: 'excluded',
    clock: fixedClock(0),
    kernel: createBuilder({
      document: landingFixture(),
      extensions: [fixtureBlocks],
      ports: { clock: fixedClock(1), ids: seededIds('excluded') },
    }),
    provider: { propose: () => Promise.resolve(plan) },
    request: 'Add a chart of our monthly sales and a table of the numbers',
    validationPorts: { clock: fixedClock(2), ids: seededIds('excluded-ports') },
    skillRegistry: createCraftkitAiSkillRegistry(),
    apply: 'never',
    ...extra,
  });
}

function activations(result: Awaited<ReturnType<typeof edit>>): string[] {
  return result.proposal.skillActivations.map(({ id, reason }) => `${id}:${reason}`);
}

describe('runAiAgent — the edit lane respects the switches', () => {
  it('matches the chart skill on its words while it is on', async () => {
    expect(activations(await edit({}))).toContain(`${DATA_VIZ}:auto`);
  });

  it('never activates a switched-off skill by its words', async () => {
    const result = await edit({ excludedSkillIds: [DATA_VIZ] });
    expect(result.proposal.skillActivations.map(({ id }) => id)).not.toContain(DATA_VIZ);
  });

  it('still honours an explicit pick of a switched-off skill', async () => {
    const result = await edit({ excludedSkillIds: [DATA_VIZ], selectedSkillIds: [DATA_VIZ] });
    expect(activations(result)).toContain(`${DATA_VIZ}:explicit`);
  });

  it('keeps the always-on craft manual whatever the host excludes', async () => {
    const result = await edit({ excludedSkillIds: ['craftkit.craft-manual'] });
    expect(activations(result)).toContain('craftkit.craft-manual:always');
  });
});
