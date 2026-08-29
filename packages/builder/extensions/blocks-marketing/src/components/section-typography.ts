import { z } from 'zod';

import type { BlockPropertyGroup } from '@craftkit/builder-schema';

/**
 * Typography steps shared by marketing sections.
 *
 * Documents store these names, never computed CSS values. The matching classes
 * resolve them through page tokens, so changing a theme can restyle every page
 * that selected the same step.
 */
export const fontFamilies = ['sans', 'serif', 'mono'] as const;
export const fontSizes = ['xs', 'sm', 'base', 'lg', 'xl', 'xxl'] as const;
export const fontWeights = ['regular', 'medium', 'semibold', 'bold'] as const;
export const lineHeights = ['tight', 'normal', 'relaxed'] as const;
export const letterSpacings = ['tight', 'normal', 'wide'] as const;
export const textAligns = ['start', 'center', 'end'] as const;
export const textCases = ['normal', 'uppercase'] as const;

/**
 * The typography fragment spread into a block's `z.object({ ... })` props.
 *
 * Every property stays optional and has no default. Undefined means "inherit";
 * adding a default here would restyle documents authored before typography
 * controls existed.
 */
export const sectionTypographyProps = {
  fontFamily: z.enum(fontFamilies).optional(),
  fontSize: z.enum(fontSizes).optional(),
  fontWeight: z.enum(fontWeights).optional(),
  lineHeight: z.enum(lineHeights).optional(),
  letterSpacing: z.enum(letterSpacings).optional(),
  textAlign: z.enum(textAligns).optional(),
  textCase: z.enum(textCases).optional(),
};

/** All typography controls share one inspector sector on the design tab. */
export const sectionTypographyGroups: Readonly<Record<string, BlockPropertyGroup>> = {
  fontFamily: { tab: 'design', section: 'Typography' },
  fontSize: { tab: 'design', section: 'Typography' },
  fontWeight: { tab: 'design', section: 'Typography' },
  lineHeight: { tab: 'design', section: 'Typography' },
  letterSpacing: { tab: 'design', section: 'Typography' },
  textAlign: { tab: 'design', section: 'Typography' },
  textCase: { tab: 'design', section: 'Typography' },
};

/*
  `| undefined` is explicit for `exactOptionalPropertyTypes`: parsed block props
  may contain an optional key whose value is undefined.
*/
export interface SectionTypographyProps {
  readonly fontFamily?: (typeof fontFamilies)[number] | undefined;
  readonly fontSize?: (typeof fontSizes)[number] | undefined;
  readonly fontWeight?: (typeof fontWeights)[number] | undefined;
  readonly lineHeight?: (typeof lineHeights)[number] | undefined;
  readonly letterSpacing?: (typeof letterSpacings)[number] | undefined;
  readonly textAlign?: (typeof textAligns)[number] | undefined;
  readonly textCase?: (typeof textCases)[number] | undefined;
}

/** Return only the token-backed classes selected by this block. */
export function sectionTypographyClasses(props: SectionTypographyProps): string {
  const classes: string[] = [];
  if (props.fontFamily !== undefined) classes.push(`mkt-type--family-${props.fontFamily}`);
  if (props.fontSize !== undefined) classes.push(`mkt-type--size-${props.fontSize}`);
  if (props.fontWeight !== undefined) classes.push(`mkt-type--weight-${props.fontWeight}`);
  if (props.lineHeight !== undefined) classes.push(`mkt-type--line-height-${props.lineHeight}`);
  if (props.letterSpacing !== undefined) {
    classes.push(`mkt-type--letter-spacing-${props.letterSpacing}`);
  }
  if (props.textAlign !== undefined) classes.push(`mkt-type--align-${props.textAlign}`);
  if (props.textCase !== undefined) classes.push(`mkt-type--case-${props.textCase}`);
  return classes.join(' ');
}
