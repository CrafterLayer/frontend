import { describe, expect, it } from 'vitest';

import { visibleGroupCount } from './measure-groups';

describe('visibleGroupCount (quick bar folding)', () => {
  it('keeps every group when they all fit', () => {
    expect(visibleGroupCount({ widths: [32, 32, 32], available: 300, reserved: 80, overflow: 32 })).toBe(3);
  });

  it('folds from the end, leaving room for the overflow button', () => {
    // 80 reserved + 32 overflow leaves 88: two 32px groups fit, the third folds.
    expect(visibleGroupCount({ widths: [32, 32, 32, 32], available: 200, reserved: 80, overflow: 32 })).toBe(2);
  });

  it('counts the gap between buttons', () => {
    // Without gaps 80 + 96 = 176 fits in 185; with 4px gaps it does not.
    expect(visibleGroupCount({ widths: [32, 32, 32], available: 185, reserved: 80, overflow: 32 })).toBe(3);
    expect(
      visibleGroupCount({ widths: [32, 32, 32], available: 185, reserved: 80, overflow: 32, gap: 4 }),
    ).toBe(1);
  });

  it('never hides groups when geometry is unknown', () => {
    expect(visibleGroupCount({ widths: [32, 32], available: 0, reserved: 80, overflow: 32 })).toBe(2);
    expect(visibleGroupCount({ widths: [0, 32], available: 100, reserved: 80, overflow: 32 })).toBe(2);
  });

  it('can fold everything on a very narrow canvas', () => {
    expect(visibleGroupCount({ widths: [32, 32], available: 100, reserved: 80, overflow: 32 })).toBe(0);
  });
});
