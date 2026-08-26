import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { resolveResponsiveProps } from './responsive';

const node: Node = {
  id: 'n1',
  type: 'hero',
  props: { tone: 'light', heading: 'Base', body: 'Copy' },
  responsive: { tablet: { tone: 'dark' }, mobile: { heading: 'Small' } },
};

describe('resolveResponsiveProps', () => {
  it('desktop returns the untouched base reference', () => {
    expect(resolveResponsiveProps(node, 'desktop')).toBe(node.props);
  });

  it('tablet applies only tablet overrides', () => {
    expect(resolveResponsiveProps(node, 'tablet')).toEqual({
      tone: 'dark',
      heading: 'Base',
      body: 'Copy',
    });
  });

  it('mobile cascades base ← tablet ← mobile (003 law)', () => {
    expect(resolveResponsiveProps(node, 'mobile')).toEqual({
      tone: 'dark',
      heading: 'Small',
      body: 'Copy',
    });
  });

  it('a breakpoint with no overrides returns the base reference (no clone churn)', () => {
    const plain: Node = { id: 'p', type: 'text', props: { content: 'x' } };
    expect(resolveResponsiveProps(plain, 'mobile')).toBe(plain.props);
  });

  it('rejects unknown breakpoints loudly', () => {
    expect(() => resolveResponsiveProps(node, 'watch' as never)).toThrow(/Unknown breakpoint/);
  });
});
