import { describe, expect, it } from 'vitest';

import type { DeclarativeSubTree, SkinDef } from './contract';
import { validateSkin } from './validate-skin';

const subtree: DeclarativeSubTree = {
  rootId: 'r',
  nodes: { r: { id: 'r', type: 'stack', props: {} } },
};

function skin(states: Partial<SkinDef['states']>): SkinDef {
  return { id: 'cards', version: 1, states: states as SkinDef['states'] };
}

describe('validateSkin', () => {
  it('accepts a skin with all four states', () => {
    expect(
      validateSkin(skin({ loading: subtree, empty: subtree, error: subtree, success: subtree })),
    ).toEqual([]);
  });

  it('names every missing state', () => {
    const errors = validateSkin(skin({ loading: subtree, success: subtree }));
    expect(errors).toHaveLength(1);
    expect(errors[0]?.code).toBe('widget/missing-states');
    expect(errors[0]?.meta?.['missing']).toEqual(['empty', 'error']);
  });

  it('rejects a state whose root is missing from its nodes', () => {
    const broken: DeclarativeSubTree = { rootId: 'ghost', nodes: subtree.nodes };
    const errors = validateSkin(
      skin({ loading: broken, empty: subtree, error: subtree, success: subtree }),
    );
    expect(errors.some((error) => error.code === 'doc/root-missing')).toBe(true);
  });

  it('rejects non-JSON data inside a state subtree', () => {
    const poisoned: DeclarativeSubTree = {
      rootId: 'r',
      nodes: { r: { id: 'r', type: 'stack', props: { on: (() => null) as never } } },
    };
    const errors = validateSkin(
      skin({ loading: poisoned, empty: subtree, error: subtree, success: subtree }),
    );
    expect(errors.some((error) => error.code === 'doc/non-json-value')).toBe(true);
  });
});
