import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';

import { createAiSkillRegistry, createCraftkitAiSkillRegistry } from '../skills';
import { assembleAiContext } from './assemble-context';

function kernel() {
  return createBuilder({
    document: landingFixture(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(100), ids: seededIds('skill-context') },
  });
}

describe('AI skill context assembly', () => {
  it('keeps the catalog metadata-only and includes active bodies exactly once', () => {
    const registry = createAiSkillRegistry([
      {
        schemaVersion: 1,
        id: 'craftkit.page-design',
        name: 'Page design',
        description: 'Design complete page hierarchy.',
        version: '1.0.0',
        instructions: 'UNIQUE_ACTIVE_INSTRUCTION',
        references: { 'guide.md': 'UNIQUE_ACTIVE_REFERENCE' },
        activation: { mode: 'explicit' },
      },
      {
        schemaVersion: 1,
        id: 'craftkit.metadata-only',
        name: 'Metadata only',
        description: 'Remain discoverable but inactive.',
        version: '1.0.0',
        instructions: 'SECRET_INACTIVE_BODY',
        activation: { mode: 'explicit' },
      },
    ]);
    const skillContext = registry.prepare({
      request: 'Build a page',
      selectedSkillIds: ['craftkit.page-design'],
    });

    const context = assembleAiContext(kernel().context, { skillContext });
    const serializedFragments = context.fragments.map(({ body }) => body).join('\n');

    // Only the pinned skills' manifests travel: the server reads nothing else from it.
    expect(context.skillCatalog?.map(({ id }) => id)).toEqual(['craftkit.page-design']);
    expect(context.skillCatalog?.[0]?.activation).toEqual({ mode: 'explicit' });
    expect(context.skills?.map(({ id }) => id)).toEqual(['craftkit.page-design']);
    expect(context.fragments).toHaveLength(1);
    expect(context.fragments[0]?.title).toBe('Active AI skill: craftkit.page-design');
    expect(context.fragments[0]).toMatchObject({
      source: 'craftkit.page-design',
      kind: 'instruction',
      trust: 'reviewed',
    });
    expect(serializedFragments.match(/UNIQUE_ACTIVE_INSTRUCTION/g)).toHaveLength(1);
    expect(serializedFragments.match(/UNIQUE_ACTIVE_REFERENCE/g)).toHaveLength(1);
    expect(serializedFragments).not.toContain('SECRET_INACTIVE_BODY');
    expect(serializedFragments).not.toContain('Design complete page hierarchy.');
    expect(JSON.stringify(context.skillCatalog)).not.toContain('instructions');
  });

  it('keeps the shipped catalog within a wire budget: the pins only, never all of it', () => {
    const registry = createCraftkitAiSkillRegistry();
    const skillContext = registry.prepare({ request: 'Build a landing page for a dental clinic' });
    const context = assembleAiContext(kernel().context, { skillContext });

    const pinned = new Set(skillContext.activations.map(({ id }) => id));
    expect(context.skillCatalog?.every(({ id }) => pinned.has(id))).toBe(true);
    expect(context.skillCatalog).toHaveLength(pinned.size);
    const shipped = JSON.stringify(context.skillCatalog).length;
    const whole = JSON.stringify(skillContext.catalog).length;
    expect(shipped).toBeLessThan(whole);
    expect(shipped).toBeLessThanOrEqual(Math.max(1500 * pinned.size, 1500));
  });

  it('preserves the previous context shape when no prepared skills are supplied', () => {
    const context = assembleAiContext(kernel().context);

    expect(Object.hasOwn(context, 'skillCatalog')).toBe(false);
    expect(Object.hasOwn(context, 'skills')).toBe(false);
  });
});
