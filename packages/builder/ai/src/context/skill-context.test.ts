import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';

import { createAiSkillRegistry } from '../skills';
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

    expect(context.skillCatalog?.map(({ id }) => id)).toEqual([
      'craftkit.metadata-only',
      'craftkit.page-design',
    ]);
    expect(context.skills?.map(({ id }) => id)).toEqual(['craftkit.page-design']);
    expect(context.fragments.at(-2)?.title).toBe('Available AI skills');
    expect(context.fragments.at(-1)?.title).toBe('Active AI skill: craftkit.page-design');
    expect(serializedFragments.match(/UNIQUE_ACTIVE_INSTRUCTION/g)).toHaveLength(1);
    expect(serializedFragments.match(/UNIQUE_ACTIVE_REFERENCE/g)).toHaveLength(1);
    expect(serializedFragments).not.toContain('SECRET_INACTIVE_BODY');
    expect(JSON.stringify(context.skillCatalog)).not.toContain('instructions');
  });

  it('preserves the previous context shape when no prepared skills are supplied', () => {
    const context = assembleAiContext(kernel().context);

    expect(Object.hasOwn(context, 'skillCatalog')).toBe(false);
    expect(Object.hasOwn(context, 'skills')).toBe(false);
  });
});
