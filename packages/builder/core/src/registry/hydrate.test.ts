import { describe, expect, it } from 'vitest';

import { BuilderError, type DeclarativeSubTree } from '@craftkit/builder-schema';

import { createBuilder } from '../kernel/create-builder';
import { fixedClock, seededIds } from '../testing/fixed-ports';
import { fixtureBlocks } from '../testing/fixtures';

const subtree: DeclarativeSubTree = {
  rootId: 'r',
  nodes: { r: { id: 'r', type: 'text', props: { content: 'hi' } } },
};

const orgRow = {
  tier: 2,
  name: 'org-pack',
  version: '1.0.0',
  contributes: {
    compositions: [
      {
        id: 'hero-pack',
        name: 'Hero pack',
        version: 1,
        surfaces: ['site'],
        rootId: 'r',
        nodes: subtree.nodes,
      },
      { id: 'promo-pack', name: 'Promo pack', version: 2, rootId: 'r', nodes: subtree.nodes },
    ],
    widgetTypes: [
      {
        type: 'widget:reviews',
        contract: { items: { shape: { type: 'array' }, required: true } },
        binding: { source: 'engine', map: { items: 'engine.reviews' } },
        skins: [
          {
            id: 'cards',
            version: 1,
            states: { loading: subtree, empty: subtree, error: subtree, success: subtree },
          },
        ],
        defaultSkin: 'cards',
      },
    ],
  },
};

function testKernel() {
  return createBuilder({
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds('h2') },
  });
}

describe('US3 — organization content loads safely as declarative extensions', () => {
  it('scenario 1: a valid row hydrates and lookups are indistinguishable from built-ins', () => {
    const kernel = testKernel();
    const events: { name: string; tier: number }[] = [];
    kernel.context.events.on('extension.registered', (payload) => {
      events.push(payload);
    });

    const manifest = kernel.extensions.hydrateDeclarative(orgRow);
    expect(manifest.name).toBe('org-pack');

    const registry = kernel.context.registry;
    expect(registry.composition('hero-pack')?.name).toBe('Hero pack');
    expect(registry.compositions('site').map((entry) => entry.id)).toEqual([
      'hero-pack',
      'promo-pack',
    ]);
    expect(registry.compositions('docs').map((entry) => entry.id)).toEqual(['promo-pack']);
    expect(registry.widgetType('widget:reviews')?.defaultSkin).toBe('cards');
    // The read surface carries no tier marker — hydrated and built-in content
    // answer through the exact same catalog API.
    expect(events).toEqual([{ name: 'org-pack', tier: 2 }]);
  });

  it('scenario 2: an executable row is rejected with the offending path and registers NOTHING', () => {
    const kernel = testKernel();
    const poisoned = structuredClone(orgRow) as {
      contributes: {
        compositions: { nodes: Record<string, { props: Record<string, unknown> }> }[];
      };
    };
    const node = poisoned.contributes.compositions[0]?.nodes['r'];
    if (node === undefined) {
      throw new Error('fixture broke');
    }
    node.props['onClick'] = () => null;

    let caught: BuilderError | undefined;
    try {
      kernel.extensions.hydrateDeclarative(poisoned);
    } catch (error) {
      caught = error as BuilderError;
    }
    expect(caught?.code).toBe('ext/tier2-executable');
    expect(caught?.path?.join('.')).toContain('contributes.compositions');

    expect(kernel.extensions.has('org-pack')).toBe(false);
    expect(kernel.context.registry.composition('hero-pack')).toBeUndefined();
    expect(kernel.context.registry.widgetType('widget:reviews')).toBeUndefined();
  });

  it('scenario 3: a clash on one entry registers nothing from the new row (all-or-nothing)', () => {
    const kernel = testKernel();
    kernel.extensions.hydrateDeclarative(orgRow);

    const rival = structuredClone(orgRow) as {
      name: string;
      contributes: { compositions: { id: string }[]; widgetTypes: { type: string }[] };
    };
    rival.name = 'rival-pack';
    const rivalWidget = rival.contributes.widgetTypes[0];
    if (rivalWidget === undefined) {
      throw new Error('fixture broke');
    }
    rivalWidget.type = 'widget:other';
    // First composition id clashes with the already-registered 'hero-pack'.

    expect(() => kernel.extensions.hydrateDeclarative(rival)).toThrow(/already registered/);
    expect(kernel.extensions.has('rival-pack')).toBe(false);
    expect(kernel.context.registry.widgetType('widget:other')).toBeUndefined();
    expect(kernel.context.registry.composition('promo-pack')?.version).toBe(2);
  });

  it('disposing a hydrated extension removes its catalog entries', () => {
    const kernel = testKernel();
    kernel.extensions.hydrateDeclarative(orgRow);
    expect(kernel.extensions.dispose('org-pack')).toBe(true);
    expect(kernel.context.registry.composition('hero-pack')).toBeUndefined();
    expect(kernel.context.registry.widgetTypes()).toEqual([]);
  });

  it('a duplicate hydration of the same name is rejected', () => {
    const kernel = testKernel();
    kernel.extensions.hydrateDeclarative(orgRow);
    expect(() => kernel.extensions.hydrateDeclarative(orgRow)).toThrow(BuilderError);
  });
});
