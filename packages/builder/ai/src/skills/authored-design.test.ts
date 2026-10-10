import { describe, expect, it } from 'vitest';
import { AUTHORED_DESIGN_TEACHING } from './authored-design';

describe('authored Frontend teaching', () => {
  it('covers application behavior without prescribing a marketing-page formula', () => {
    expect(AUTHORED_DESIGN_TEACHING).toContain('no mandatory hero');
    expect(AUTHORED_DESIGN_TEACHING).toContain('filters/search');
    expect(AUTHORED_DESIGN_TEACHING).toContain('field validation');
    expect(AUTHORED_DESIGN_TEACHING.length).toBeLessThan(4100);
  });
  it('preserves ownership, safe managed imports and honest quality claims', () => {
    for (const contract of [
      'allowedPaths',
      'selected-span-only',
      'dependencyLock',
      'destroy it on cleanup',
      'not visual or accessibility proof',
    ]) {
      expect(AUTHORED_DESIGN_TEACHING).toContain(contract);
    }
  });
});
