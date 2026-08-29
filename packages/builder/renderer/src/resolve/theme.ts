/**
 * The page's token vocabulary.
 *
 * Split in two on purpose. Colour roles are what a person picks in a colour
 * control; measurements are what a page is BUILT from — spacing, widths, radii,
 * the sizes of a control. Both are theme keys, and the split is what keeps a
 * measurement out of a colour picker without anyone having to remember to
 * exclude it.
 *
 * Every token here must be one a block actually consumes. The inverse also has
 * to hold, and it is the reason this list grew: a stylesheet writing
 * `var(--t-section-spacing-lg, 64px)` against a token the theme never defines
 * is not themed at all — it is a hard-coded 64px wearing a token's clothes, and
 * re-pointing the theme cannot move it.
 */
export type ColorToken =
  'surface' | 'surfaceInverse' | 'text' | 'textInverse' | 'textMuted' | 'accent' | 'accentText';

export type MeasurementToken =
  | 'radius'
  /* The rhythm between things inside a section. */
  | 'gap'
  | 'gapXs'
  | 'gapSm'
  | 'gapLg'
  /* The rhythm between sections. */
  | 'sectionSpacingSm'
  | 'sectionSpacingMd'
  | 'sectionSpacingLg'
  /* The breathing room at the page's edge — without it text meets the glass. */
  | 'gutter'
  /* How wide a column of content is allowed to get. */
  | 'contentWidthNarrow'
  | 'contentWidthStandard'
  | 'contentWidthWide'
  /* The outer document root, distinct from the columns sections place inside it. */
  | 'pageWidth'
  /* The narrowest a grid column may get before the grid drops a column. */
  | 'gridMinTrack'
  /* A hairline. Every page border reads this, so one edit restyles the site. */
  | 'borderWidth'
  /* Elevation, as two named steps rather than a shadow anyone can hand-write. */
  | 'shadowSoft'
  | 'shadowStrong'
  /* The bar heights a header offers, as a scale rather than free numbers. */
  | 'barHeightCompact'
  | 'barHeightRegular'
  | 'barHeightTall'
  /* Type steps the page needs beyond body and small. */
  | 'fontSizeLg'
  | 'fontSizeXl'
  /* The tracking an uppercase label needs to stay readable. */
  | 'letterSpacingWide'
  /* Type. */
  | 'fontSizeSm'
  /* The inside of a control, which is what makes a button feel its size. */
  | 'controlPaddingBlockSm'
  | 'controlPaddingBlockMd'
  | 'controlPaddingBlockLg'
  | 'controlPaddingInlineSm'
  | 'controlPaddingInlineMd'
  | 'controlPaddingInlineLg';

export type TokenName = ColorToken | MeasurementToken;

/** A theme is a complete token assignment; blocks consume ONLY var(--t-…) names. */
export type Theme = Record<TokenName, string>;

const kebab = (name: string): string => name.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);

export function tokenCssName(name: TokenName): string {
  return `--t-${kebab(name)}`;
}

/** Serialize a theme into one managed `:root { … }` rule for the preview frame. */
export function themeToCssVars(theme: Theme): string {
  const declarations = (Object.entries(theme) as [TokenName, string][])
    .map(([name, value]) => `${tokenCssName(name)}: ${value};`)
    .join(' ');
  return `:root { ${declarations} }`;
}
