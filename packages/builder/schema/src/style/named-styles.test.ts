import { describe, expect, it } from 'vitest';

import {
  expandNamedStyles,
  extractStyleClasses,
  namedStyleIds,
  pasteStyleClasses,
} from './named-styles';

describe('expandNamedStyles', () => {
  const styles = {
    card: 'p-6 bg-surface rounded-xl',
    btn: 'bg-surface px-4 py-2',
    'btn-primary': 'bg-accent',
    spaced: 'pbs-4',
  };

  it('keeps the markers and adds the style utilities, own classes winning', () => {
    expect(expandNamedStyles('ck-s-card p-2', styles)).toBe('ck-s-card bg-surface rounded-xl p-2');
  });

  it('applies combo styles in marker order', () => {
    expect(expandNamedStyles('ck-s-btn ck-s-btn-primary', styles)).toBe(
      'ck-s-btn ck-s-btn-primary px-4 py-2 bg-accent',
    );
  });

  it('lets an own logical shorthand override a style side (the tailwind-merge miss)', () => {
    expect(expandNamedStyles('ck-s-spaced py-2', styles)).toBe('ck-s-spaced py-2');
  });

  it('adds nothing for an unknown style and leaves a list without markers alone', () => {
    expect(expandNamedStyles('ck-s-missing flex', styles)).toBe('ck-s-missing flex');
    expect(expandNamedStyles('flex  p-2', styles)).toBe('flex p-2');
  });

  it('lists the referenced ids in order', () => {
    expect(namedStyleIds('flex ck-s-btn ck-s-btn-primary ck-hero')).toEqual(['btn', 'btn-primary']);
  });
});

describe('copy and paste style', () => {
  it('copies style classes and markers, not structural classes', () => {
    expect(
      extractStyleClasses('group flex p-4 hover:bg-accent ck-hero-glow ck-s-card dark:text-white'),
    ).toBe('flex p-4 hover:bg-accent ck-s-card dark:text-white');
  });

  it('copies only the families asked for', () => {
    expect(extractStyleClasses('flex p-4 max-md:p-2 bg-accent', ['padding'])).toBe(
      'p-4 max-md:p-2',
    );
    expect(extractStyleClasses('flex ck-s-card', ['named-styles'])).toBe('ck-s-card');
  });

  it('replaces the target style and keeps its structure', () => {
    expect(pasteStyleClasses('group p-2 text-sm ck-hero', 'p-6 bg-accent')).toBe(
      'group ck-hero p-6 bg-accent',
    );
  });

  it('replaces only the families asked for', () => {
    expect(pasteStyleClasses('group p-2 text-sm', 'p-6 bg-accent', { families: ['padding'] })).toBe(
      'group text-sm p-6',
    );
  });
});
