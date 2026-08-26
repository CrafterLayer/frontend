import { describe, expect, it } from 'vitest';

import { findRawStyleLiterals } from './style-values';

describe('findRawStyleLiterals', () => {
  it.each([
    ['#fff', 'hex-color'],
    ['#ffff', 'hex-color'],
    ['#a1b2c3', 'hex-color'],
    ['#a1b2c3d4', 'hex-color'],
    ['color: #ff0000;', 'hex-color'],
    ['16px', 'px-length'],
    ['margin: 12.5px', 'px-length'],
    ['-4px', 'px-length'],
  ] as const)('flags %s as %s', (value, kind) => {
    const hits = findRawStyleLiterals({ style: value });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.kind).toBe(kind);
    expect(hits[0]?.path).toEqual(['style']);
  });

  it.each([
    'primary',
    'spacing-4',
    'large',
    'pixel-perfect', // "px" inside a word
    'expx1', // no digit before px
    'issue #12 is fixed', // too-short hex-ish token
    '#12ز', // non-hex continuation
  ])('accepts intent value %s', (value) => {
    expect(findRawStyleLiterals({ style: value })).toHaveLength(0);
  });

  it('walks nested structures with paths', () => {
    const hits = findRawStyleLiterals({ a: [{ b: 'gap: 8px' }], c: '#00ff00' });
    expect(hits.map((hit) => hit.path)).toEqual([['a', 0, 'b'], ['c']]);
  });
});
