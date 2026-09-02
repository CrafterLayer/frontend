import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { partitionProperties, sectionEntries, usablePair } from './partition-properties';
import type { ErasedPropertyGroups, InspectorProperty } from './types';

const prop = (key: string): InspectorProperty => [key, z.string()];

const pair = (id: string, label: string, cellLabel: string) => ({
  tab: 'design' as const,
  section: 'Spacing',
  pair: { id, label, cellLabel },
});

describe('usablePair', () => {
  it('accepts a complete declaration and rejects blanks', () => {
    expect(usablePair(pair('m', 'Margin', 'Top'))).toEqual({
      id: 'm',
      label: 'Margin',
      cellLabel: 'Top',
    });
    expect(usablePair(undefined)).toBeUndefined();
    expect(usablePair({ tab: 'design' })).toBeUndefined();
    expect(usablePair(pair(' ', 'Margin', 'Top'))).toBeUndefined();
    expect(usablePair(pair('m', '', 'Top'))).toBeUndefined();
    expect(usablePair(pair('m', 'Margin', '  '))).toBeUndefined();
  });
});

describe('sectionEntries', () => {
  it('emits a pair of exactly two members at the first member’s position and drops the second', () => {
    const declarations: ErasedPropertyGroups = {
      marginTop: pair('margin', 'Margin', 'Top'),
      marginBottom: pair('margin', 'Margin', 'Bottom'),
    };
    const entries = sectionEntries(
      [prop('gap'), prop('marginTop'), prop('width'), prop('marginBottom')],
      declarations,
    );
    expect(
      entries.map((entry) => (entry.kind === 'pair' ? `pair:${entry.id}` : entry.property[0])),
    ).toEqual(['gap', 'pair:margin', 'width']);
    const grouped = entries[1];
    expect(grouped?.kind).toBe('pair');
    if (grouped?.kind !== 'pair') {
      throw new Error('expected a pair');
    }
    expect(grouped.label).toBe('Margin');
    expect(grouped.properties.map((entry) => entry.pair.cellLabel)).toEqual(['Top', 'Bottom']);
  });

  it('falls back to ordinary rows for a singleton, a third member, mismatched labels or equal cells', () => {
    const singleton = sectionEntries([prop('marginTop')], {
      marginTop: pair('margin', 'Margin', 'Top'),
    });
    expect(singleton.map((entry) => entry.kind)).toEqual(['property']);

    const triple = sectionEntries([prop('a'), prop('b'), prop('c')], {
      a: pair('m', 'Margin', 'Top'),
      b: pair('m', 'Margin', 'Bottom'),
      c: pair('m', 'Margin', 'Start'),
    });
    expect(triple.map((entry) => entry.kind)).toEqual(['property', 'property', 'property']);

    const labels = sectionEntries([prop('a'), prop('b')], {
      a: pair('m', 'Margin', 'Top'),
      b: pair('m', 'Padding', 'Bottom'),
    });
    expect(labels.map((entry) => entry.kind)).toEqual(['property', 'property']);

    const cells = sectionEntries([prop('a'), prop('b')], {
      a: pair('m', 'Margin', 'Top'),
      b: pair('m', 'Margin', 'Top'),
    });
    expect(cells.map((entry) => entry.kind)).toEqual(['property', 'property']);
  });

  it('treats a blank declaration as no pair at all', () => {
    const entries = sectionEntries([prop('a'), prop('b')], {
      a: pair('', 'Margin', 'Top'),
      b: pair('', 'Margin', 'Bottom'),
    });
    expect(entries.map((entry) => entry.kind)).toEqual(['property', 'property']);
  });
});

describe('partitionProperties', () => {
  it('orders Content → Design → Advanced and emits only populated tabs', () => {
    const tabs = partitionProperties([prop('slug'), prop('title'), prop('font')], {
      slug: { tab: 'advanced', section: 'Identity' },
      font: { tab: 'design', section: 'Typography' },
    });
    expect(tabs.map((tab) => tab.id)).toEqual(['content', 'design', 'advanced']);
    expect(tabs.map((tab) => tab.label)).toEqual(['Content', 'Design', 'Advanced']);
    expect(tabs[0]?.sections.map((section) => section.name)).toEqual(['Content']);
    expect(tabs[1]?.sections[0]?.name).toBe('Typography');
    expect(tabs[2]?.sections[0]?.name).toBe('Identity');

    const contentOnly = partitionProperties([prop('title')], undefined);
    expect(contentOnly.map((tab) => tab.id)).toEqual(['content']);
  });

  it('labels a blank or missing section after its tab and keeps first-occurrence section order', () => {
    const tabs = partitionProperties([prop('a'), prop('b'), prop('c'), prop('d')], {
      a: { tab: 'design', section: 'Colour' },
      b: { tab: 'design', section: '   ' },
      c: { tab: 'design' },
      d: { tab: 'design', section: 'Colour' },
    });
    expect(tabs).toHaveLength(1);
    expect(tabs[0]?.sections.map((section) => section.name)).toEqual(['Colour', 'Design']);
    expect(
      tabs[0]?.sections[0]?.entries.map((entry) =>
        entry.kind === 'property' ? entry.property[0] : entry.id,
      ),
    ).toEqual(['a', 'd']);
  });

  it('keeps every entry’s schema reference', () => {
    const schema = z.number();
    const tabs = partitionProperties([['count', schema]], undefined);
    const entry = tabs[0]?.sections[0]?.entries[0];
    expect(entry?.kind === 'property' ? entry.property[1] : undefined).toBe(schema);
  });
});
