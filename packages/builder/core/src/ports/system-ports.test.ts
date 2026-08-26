import { describe, expect, it } from 'vitest';

import { systemClock } from './system-clock';
import { systemIds } from './system-ids';

describe('system ports (the only ambient-capability call sites)', () => {
  it('systemClock yields finite, non-decreasing timestamps', () => {
    const first = systemClock.now();
    const second = systemClock.now();
    expect(Number.isFinite(first)).toBe(true);
    expect(second).toBeGreaterThanOrEqual(first);
  });

  it('systemIds yields unique non-empty ids', () => {
    const ids = new Set([systemIds.newId(), systemIds.newId(), systemIds.newId()]);
    expect(ids.size).toBe(3);
    for (const id of ids) {
      expect(id.length).toBeGreaterThan(0);
    }
  });
});
