import { describe, expect, it } from 'vitest';

import { joinLayers, moveItem, splitLayers } from './layers';

describe('stack layers', () => {
  it('splits only top-level commas', () => {
    expect(splitLayers('0 1px 2px rgb(0 0 0 / .08), 0 8px 24px rgba(0,0,0,.12)')).toEqual([
      '0 1px 2px rgb(0 0 0 / .08)',
      '0 8px 24px rgba(0,0,0,.12)',
    ]);
    expect(splitLayers('')).toEqual([]);
  });

  it('joins and moves layers', () => {
    expect(joinLayers(['a', ' ', 'b '])).toBe('a, b');
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a'], 0, 3)).toEqual(['a']);
  });
});
