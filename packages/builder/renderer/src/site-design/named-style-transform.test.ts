import { describe, expect, it } from 'vitest';

import type { SiteLibrary } from '@craftkit/builder-schema';

import { createNamedStyleTransform, namedStyleMap } from './named-style-transform';

const library: SiteLibrary = {
  styles: {
    card: { id: 'card', name: 'Card', className: 'rounded-lg p-6 bg-accent' },
    featured: { id: 'featured', name: 'Featured', className: 'bg-surface-inverse shadow-soft' },
  },
};

describe('createNamedStyleTransform', () => {
  it('expands a marker under the element’s own utilities, keeping the marker', () => {
    const expand = createNamedStyleTransform(library);
    const out = expand('ck-s-card p-2').split(' ');
    expect(out).toContain('ck-s-card');
    expect(out).toContain('rounded-lg');
    expect(out).toContain('p-2');
    expect(out).not.toContain('p-6');
  });

  it('applies combo styles in marker order', () => {
    const out = createNamedStyleTransform(library)('ck-s-card ck-s-featured').split(' ');
    expect(out).toContain('bg-surface-inverse');
    expect(out).not.toContain('bg-accent');
    expect(out).toContain('shadow-soft');
  });

  it('returns a class list without markers untouched, and tolerates no library', () => {
    expect(createNamedStyleTransform(library)('p-2  text-start')).toBe('p-2  text-start');
    expect(createNamedStyleTransform(undefined)('ck-s-card p-2').split(' ')).toEqual([
      'ck-s-card',
      'p-2',
    ]);
    expect(namedStyleMap(undefined)).toEqual({});
    expect(namedStyleMap(library)).toEqual({
      card: 'rounded-lg p-6 bg-accent',
      featured: 'bg-surface-inverse shadow-soft',
    });
  });

  it('memoises: the same input gives the same string', () => {
    const expand = createNamedStyleTransform(library);
    expect(expand('ck-s-card')).toBe(expand('ck-s-card'));
  });
});
