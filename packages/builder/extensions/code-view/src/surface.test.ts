import { describe, expect, it } from 'vitest';

import { CodeViewErrors } from './CodeViewErrors';
import ContributedCodeViewPanel, { CodeViewPanel } from './CodeViewPanel';

/**
 * The package's two entries are a boundary, not decoration: the production one
 * must NOT be able to reach the worker plumbing (containment.test.ts proves
 * that statically), and the test-only one must actually serve it. Both are
 * asserted here so a refactor cannot quietly empty either.
 */
describe('code-view package entries (011 T033 finding 8)', () => {
  it('erases the panel props at the manifest boundary while keeping the named export precise', () => {
    // The schema types a contributed panel as Record<string, unknown>; hosts
    // that import the component directly keep the real props. Same component.
    expect(ContributedCodeViewPanel).toBe(CodeViewPanel);
    expect(typeof ContributedCodeViewPanel).toBe('function');
  });

  it('exports the error list through its own barrel', () => {
    expect(typeof CodeViewErrors).toBe('function');
  });

  it('serves the worker plumbing from ./testing, never from the production entry', async () => {
    const testing = await import('./testing');
    expect(typeof testing.createLoopbackWorkerLike).toBe('function');
    expect(typeof testing.createTransformWorkerClient).toBe('function');

    const production: Record<string, unknown> = await import('./index');
    expect('createLoopbackWorkerLike' in production).toBe(false);
    expect('createTransformWorkerClient' in production).toBe(false);
  });
});
