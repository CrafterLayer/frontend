import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  fontFamilies,
  fontSizes,
  fontWeights,
  letterSpacings,
  lineHeights,
  sectionTypographyClasses,
  sectionTypographyProps,
  textAligns,
  textCases,
} from './section-typography';

describe('sectionTypographyClasses', () => {
  it('maps every typography scale member to its class', () => {
    for (const value of fontFamilies) {
      expect(sectionTypographyClasses({ fontFamily: value })).toBe(`mkt-type--family-${value}`);
    }
    for (const value of fontSizes) {
      expect(sectionTypographyClasses({ fontSize: value })).toBe(`mkt-type--size-${value}`);
    }
    for (const value of fontWeights) {
      expect(sectionTypographyClasses({ fontWeight: value })).toBe(`mkt-type--weight-${value}`);
    }
    for (const value of lineHeights) {
      expect(sectionTypographyClasses({ lineHeight: value })).toBe(
        `mkt-type--line-height-${value}`,
      );
    }
    for (const value of letterSpacings) {
      expect(sectionTypographyClasses({ letterSpacing: value })).toBe(
        `mkt-type--letter-spacing-${value}`,
      );
    }
    for (const value of textAligns) {
      expect(sectionTypographyClasses({ textAlign: value })).toBe(`mkt-type--align-${value}`);
    }
    for (const value of textCases) {
      expect(sectionTypographyClasses({ textCase: value })).toBe(`mkt-type--case-${value}`);
    }
  });

  it('does not emit a class for an unset property', () => {
    expect(sectionTypographyClasses({ fontSize: undefined })).toBe('');
  });

  it('returns only classes for properties that are set', () => {
    expect(
      sectionTypographyClasses({
        fontFamily: 'serif',
        fontWeight: 'semibold',
        textAlign: 'end',
      }),
    ).toBe('mkt-type--family-serif mkt-type--weight-semibold mkt-type--align-end');
  });
});

describe('sectionTypographyProps', () => {
  it('parses an empty props object without adding defaults', () => {
    expect(z.object(sectionTypographyProps).parse({})).toEqual({});
  });
});
