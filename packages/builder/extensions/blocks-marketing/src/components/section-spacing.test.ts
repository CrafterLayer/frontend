import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { sectionSpacingGroups, sectionSpacingProps, sectionSpacingStyle } from './section-spacing';

const sectionSpacingSchema = z.object(sectionSpacingProps);

interface PairDeclaration {
  readonly id: string;
  readonly label: string;
  readonly cellLabel: string;
}

type RuntimePairedGroup = (typeof sectionSpacingGroups)[string] & {
  readonly pair: PairDeclaration;
};

describe('sectionSpacingStyle', () => {
  it('emits every step on its matching logical CSS property', () => {
    expect(
      sectionSpacingStyle({
        paddingBlockStart: 1,
        paddingBlockEnd: 2,
        paddingInlineStart: 3,
        paddingInlineEnd: 4,
        marginBlockStart: 5,
        marginBlockEnd: 6,
        marginInlineStart: 7,
        marginInlineEnd: 8,
      }),
    ).toEqual({
      paddingBlockStart: 'calc(var(--t-space-unit, 4px) * 1)',
      paddingBlockEnd: 'calc(var(--t-space-unit, 4px) * 2)',
      paddingInlineStart: 'calc(var(--t-space-unit, 4px) * 3)',
      paddingInlineEnd: 'calc(var(--t-space-unit, 4px) * 4)',
      marginBlockStart: 'calc(var(--t-space-unit, 4px) * 5)',
      marginBlockEnd: 'calc(var(--t-space-unit, 4px) * 6)',
      marginInlineStart: 'calc(var(--t-space-unit, 4px) * 7)',
      marginInlineEnd: 'calc(var(--t-space-unit, 4px) * 8)',
    });
  });

  it('emits a deliberate zero step instead of dropping it as falsy', () => {
    expect(sectionSpacingStyle({ paddingBlockStart: 0 })).toEqual({
      paddingBlockStart: 'calc(var(--t-space-unit, 4px) * 0)',
    });
  });

  it('accepts and emits a negative margin step', () => {
    const props = sectionSpacingSchema.parse({ marginInlineEnd: -32 });

    expect(sectionSpacingStyle(props)).toEqual({
      marginInlineEnd: 'calc(var(--t-space-unit, 4px) * -32)',
    });
  });

  it('rejects a negative padding step', () => {
    expect(() => sectionSpacingSchema.parse({ paddingBlockStart: -1 })).toThrow();
  });

  it('returns undefined when no spacing is set', () => {
    expect(sectionSpacingStyle({})).toBeUndefined();
  });
});

describe('sectionSpacingProps', () => {
  it('keeps every property optional without materializing absent keys', () => {
    const parsed = sectionSpacingSchema.parse({});

    expect(parsed).toEqual({});
    expect(Object.keys(parsed)).toHaveLength(0);
  });
});

describe('sectionSpacingGroups', () => {
  it('declares four complete logical pairs in the design spacing section', () => {
    const expected = {
      paddingBlockStart: { id: 'padding-block', label: 'Padding block', cellLabel: 'Start' },
      paddingBlockEnd: { id: 'padding-block', label: 'Padding block', cellLabel: 'End' },
      paddingInlineStart: { id: 'padding-inline', label: 'Padding inline', cellLabel: 'Start' },
      paddingInlineEnd: { id: 'padding-inline', label: 'Padding inline', cellLabel: 'End' },
      marginBlockStart: { id: 'margin-block', label: 'Margin block', cellLabel: 'Start' },
      marginBlockEnd: { id: 'margin-block', label: 'Margin block', cellLabel: 'End' },
      marginInlineStart: { id: 'margin-inline', label: 'Margin inline', cellLabel: 'Start' },
      marginInlineEnd: { id: 'margin-inline', label: 'Margin inline', cellLabel: 'End' },
    } as const;
    const pairCounts = new Map<string, number>();

    expect(Object.keys(sectionSpacingGroups)).toEqual(Object.keys(expected));
    for (const [property, declaration] of Object.entries(expected)) {
      const group = sectionSpacingGroups[property] as RuntimePairedGroup | undefined;
      if (group === undefined) throw new Error(`Missing spacing group for ${property}`);
      expect(group).toMatchObject({
        tab: 'design',
        section: 'Padding & margin',
        pair: declaration,
      });
      pairCounts.set(group.pair.id, (pairCounts.get(group.pair.id) ?? 0) + 1);
    }

    expect(Object.fromEntries(pairCounts)).toEqual({
      'padding-block': 2,
      'padding-inline': 2,
      'margin-block': 2,
      'margin-inline': 2,
    });
  });
});
