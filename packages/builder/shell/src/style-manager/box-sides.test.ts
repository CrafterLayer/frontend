import { describe, expect, it } from 'vitest';

import { growthOf, sideForModifiers, sidesOf } from './box-sides';

describe('box sides', () => {
  it('Shift addresses all sides and Alt the opposite pair', () => {
    expect(sideForModifiers('inline-start', { all: true, pair: false })).toBe('all');
    expect(sideForModifiers('inline-start', { all: false, pair: true })).toBe('inline');
    expect(sideForModifiers('block-end', { all: false, pair: true })).toBe('block');
    expect(sideForModifiers('block-end', { all: false, pair: false })).toBe('block-end');
    expect(sidesOf('inline')).toEqual(['inline-start', 'inline-end']);
  });

  it('dragging away from the centre grows a side, mirrored for an RTL page', () => {
    expect(growthOf('inline-start', { dx: -10, dy: 0 }, 'ltr')).toBe(10);
    expect(growthOf('inline-start', { dx: 10, dy: 0 }, 'rtl')).toBe(10);
    expect(growthOf('block-start', { dx: 0, dy: -6 }, 'ltr')).toBe(6);
    expect(growthOf('block-end', { dx: 0, dy: -6 }, 'rtl')).toBe(-6);
  });
});
