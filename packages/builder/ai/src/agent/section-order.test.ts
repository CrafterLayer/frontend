import { describe, expect, it } from 'vitest';

import { nextSection, type OpenSection } from './section-order';

function open(index: number, scene = false, counted = false): OpenSection {
  return { index, counted, scene: () => scene };
}

describe('nextSection — scene writers start first, inside the task limit', () => {
  it('starts nothing when nothing is open', () => {
    expect(nextSection([], 4)).toBeUndefined();
  });

  it('keeps page order when no section writes a scene', () => {
    expect(nextSection([open(1), open(2), open(3)], 12)).toBe(1);
  });

  it('starts the first scene before the sections above it', () => {
    expect(nextSection([open(1), open(2), open(3, true), open(4, true)], 12)).toBe(3);
  });

  it('never lets a scene take the place of a section the task limit would then leave unstarted', () => {
    // Room for two more: the scene at 3 is the third uncounted section, so page order holds.
    expect(nextSection([open(1), open(2), open(3, true)], 2)).toBe(1);
    expect(nextSection([open(1), open(2, true), open(3)], 2)).toBe(2);
    // A section counted already (a rerun) is never outside the limit.
    expect(nextSection([open(1), open(2), open(5, true, true)], 0)).toBe(5);
    // No room at all: the first open section goes, and the limit stops it there.
    expect(nextSection([open(1), open(2, true)], 0)).toBe(1);
  });
});
