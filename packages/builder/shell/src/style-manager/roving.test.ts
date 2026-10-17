import { describe, expect, it } from 'vitest';

import { rovingIndex } from './roving';

describe('rovingIndex', () => {
  it('moves forward with the inline arrow that points forward in the layout direction', () => {
    expect(rovingIndex('ArrowRight', 0, 3, 'ltr')).toBe(1);
    expect(rovingIndex('ArrowLeft', 0, 3, 'rtl')).toBe(1);
    expect(rovingIndex('ArrowRight', 0, 3, 'rtl')).toBe(2);
  });

  it('wraps, jumps with Home/End and ignores other keys', () => {
    expect(rovingIndex('ArrowDown', 2, 3, 'ltr')).toBe(0);
    expect(rovingIndex('ArrowUp', 0, 3, 'ltr')).toBe(2);
    expect(rovingIndex('End', 0, 3, 'ltr')).toBe(2);
    expect(rovingIndex('Home', 2, 3, 'ltr')).toBe(0);
    expect(rovingIndex('a', 0, 3, 'ltr')).toBeUndefined();
    expect(rovingIndex('ArrowDown', 0, 0, 'ltr')).toBeUndefined();
  });
});
