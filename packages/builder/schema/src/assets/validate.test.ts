import { describe, expect, it } from 'vitest';

import type { Node } from '../document/types';
import { assetRefSchema, imagePropSchema } from './types';
import {
  collectAssetRefs,
  isAssetRef,
  validateAssetEntry,
  validateAssetReferences,
} from './validate';

const entry = {
  id: 'studio',
  url: 'https://images.example/studio.jpg',
  description: 'A warmly lit creative studio.',
  mood: ['warm'],
  palette: ['#c78b5b'],
  alt: 'Sunlight in a creative studio.',
  width: 1600,
  height: 900,
};

function nodesWith(node: Partial<Node>): Record<string, Node> {
  return {
    hero: {
      id: 'hero',
      type: 'hero',
      props: {},
      ...node,
    },
  };
}

describe('asset contract validation', () => {
  it('accepts a valid entry and asset reference', () => {
    expect(validateAssetEntry(entry)).toEqual({ ok: true, entry });
    expect(assetRefSchema.safeParse({ assetId: 'studio' }).success).toBe(true);
    expect(isAssetRef({ assetId: 'studio' })).toBe(true);
  });

  it('reports an unresolvable reference with its node and prop path', () => {
    const issues = validateAssetReferences(
      nodesWith({ props: { image: { assetId: 'missing' } } }),
      {},
    );

    expect(issues).toEqual([
      {
        code: 'unresolved-asset-reference',
        message: 'Node "hero" references unknown asset "missing" at image.',
        nodeId: 'hero',
        propPath: ['image'],
        assetId: 'missing',
      },
    ]);
  });

  it('finds and validates a reference inside a responsive mobile override', () => {
    const nodes = nodesWith({
      responsive: { mobile: { image: { assetId: 'mobile-only' } } },
    });

    expect(collectAssetRefs(nodes)).toEqual([
      {
        nodeId: 'hero',
        propPath: ['responsive', 'mobile', 'image'],
        ref: { assetId: 'mobile-only' },
      },
    ]);
    expect(validateAssetReferences(nodes, {})).toHaveLength(1);
  });

  it('accepts a deliberate absence without producing a reference issue', () => {
    const absent = { absent: true, reason: 'No suitable asset is available.' };
    const nodes = nodesWith({ props: { image: absent } });

    expect(imagePropSchema.safeParse(absent).success).toBe(true);
    expect(validateAssetReferences(nodes, {})).toEqual([]);
  });

  it('rejects an entry missing required alt text', () => {
    // Built explicitly rather than destructured: an unused `_alt` binding is a
    // lint error here, and the omission is the point of the test.
    const withoutAlt = {
      id: entry.id,
      url: entry.url,
      description: entry.description,
      mood: entry.mood,
      palette: entry.palette,
      width: entry.width,
      height: entry.height,
    };
    const result = validateAssetEntry(withoutAlt);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.path.includes('alt'))).toBe(true);
    }
  });

  it('resolves identity by id, never by URL', () => {
    const nodes = nodesWith({ props: { image: { assetId: 'different-id' } } });

    expect(validateAssetReferences(nodes, { [entry.id]: entry })).toHaveLength(1);
  });
});
