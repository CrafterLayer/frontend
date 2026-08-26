import { describe, expect, it } from 'vitest';

import type { DeclarativeSubTree } from '../widgets/contract';
import { validateTier2Manifest } from './validate-tier2';

const subtree: DeclarativeSubTree = {
  rootId: 'r',
  nodes: { r: { id: 'r', type: 'stack', props: { gap: 'md' } } },
};

const validManifest = {
  tier: 2,
  name: 'org-content',
  version: '1.0.0',
  contributes: {
    compositions: [{ id: 'c1', name: 'Hero pack', version: 1, rootId: 'r', nodes: subtree.nodes }],
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

describe('validateTier2Manifest', () => {
  it('hydrates a valid declarative manifest', () => {
    const result = validateTier2Manifest(validManifest);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest.tier).toBe(2);
      expect(result.manifest.contributes?.widgetTypes?.[0]?.type).toBe('widget:reviews');
    }
  });

  it.each([
    ['setup', { ...validManifest, setup: () => null }],
    ['render inside a composition node', structuredCloneWithFunction()],
    ['a nested contract function', nestedFunctionManifest()],
  ])('rejects executable content in %s with ext/tier2-executable and the path', (_label, raw) => {
    const result = validateTier2Manifest(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('ext/tier2-executable');
      expect(result.errors[0]?.path?.length).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(1);
    }
  });

  it('rejects unknown keys (a non-function "render") as malformed, not executable', () => {
    const raw = { ...validManifest, render: 'not-code' };
    const result = validateTier2Manifest(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.every((error) => error.code === 'ext/tier2-invalid')).toBe(true);
    }
  });

  it('rejects tier-1 shaped manifests', () => {
    const result = validateTier2Manifest({ tier: 1, name: 'x', version: '1' });
    expect(result.ok).toBe(false);
  });

  it('surfaces a missing skin state as widget/missing-states', () => {
    const raw = structuredClone(validManifest) as Record<string, unknown>;
    const widget = (
      raw['contributes'] as { widgetTypes: { skins: { states: Record<string, unknown> }[] }[] }
    ).widgetTypes[0];
    if (widget === undefined) {
      throw new Error('fixture broke');
    }
    delete widget.skins[0]?.states['error'];
    const result = validateTier2Manifest(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((error) => error.code === 'widget/missing-states')).toBe(true);
    }
  });

  it('rejects a defaultSkin that is not among the skins', () => {
    const raw = structuredClone(validManifest) as {
      contributes: { widgetTypes: { defaultSkin: string }[] };
    };
    const widget = raw.contributes.widgetTypes[0];
    if (widget === undefined) {
      throw new Error('fixture broke');
    }
    widget.defaultSkin = 'missing';
    const result = validateTier2Manifest(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('ext/tier2-invalid');
      expect(result.errors[0]?.message).toContain('defaultSkin');
    }
  });

  it('registers nothing on failure (all-or-nothing result shape)', () => {
    const result = validateTier2Manifest({ ...validManifest, name: '' });
    expect(result.ok).toBe(false);
    expect('manifest' in result).toBe(false);
  });
});

function structuredCloneWithFunction(): unknown {
  const raw = structuredClone(validManifest) as {
    contributes: { compositions: { nodes: Record<string, { props: Record<string, unknown> }> }[] };
  };
  const composition = raw.contributes.compositions[0];
  if (composition === undefined) {
    throw new Error('fixture broke');
  }
  const node = composition.nodes['r'];
  if (node === undefined) {
    throw new Error('fixture broke');
  }
  node.props['render'] = () => null;
  return raw;
}

function nestedFunctionManifest(): unknown {
  const raw = structuredClone(validManifest) as {
    contributes: { widgetTypes: { contract: Record<string, { shape: unknown }> }[] };
  };
  const widget = raw.contributes.widgetTypes[0];
  if (widget === undefined) {
    throw new Error('fixture broke');
  }
  const items = widget.contract['items'];
  if (items === undefined) {
    throw new Error('fixture broke');
  }
  items.shape = { validate: () => true };
  return raw;
}
