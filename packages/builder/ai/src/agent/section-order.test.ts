import { describe, expect, it } from 'vitest';

import { nextSection, sceneSlotsLeft, type OpenSection } from './section-order';

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

describe('nextSection — scenes leave one writer to the quick sections (P2, 2026-11-01)', () => {
  it('starts a quick section once scenes hold every writer but one', () => {
    // Three writers, two scenes writing already: no scene slot is left.
    expect(nextSection([open(1), open(3, true), open(4)], 12, 0)).toBe(1);
    expect(nextSection([open(3, true), open(4)], 12, 0)).toBe(4);
  });

  it('still starts scenes first while a scene slot is left', () => {
    expect(nextSection([open(1), open(3, true)], 12, 1)).toBe(3);
  });

  it('lets a scene take the free writer when no quick section is waiting', () => {
    expect(nextSection([open(3, true), open(5, true)], 12, 0)).toBe(3);
  });

  it('keeps the task limit: a quick section never jumps a section the limit would leave unstarted', () => {
    // Room for one: the scene at 3 is the only section the limit lets start.
    expect(nextSection([open(3, true), open(4)], 1, 0)).toBe(3);
  });

  it('keeps today’s order with one writer (no limit on scenes)', () => {
    expect(nextSection([open(1), open(3, true)], 12)).toBe(3);
  });
});

describe('sceneSlotsLeft — how many more scenes may start', () => {
  it('leaves one writer of several to the quick sections', () => {
    expect(sceneSlotsLeft(3, 0)).toBe(2);
    expect(sceneSlotsLeft(3, 2)).toBe(0);
    expect(sceneSlotsLeft(2, 1)).toBe(0);
  });

  it('puts no limit on one writer', () => {
    expect(sceneSlotsLeft(1, 1)).toBe(Number.POSITIVE_INFINITY);
  });
});
