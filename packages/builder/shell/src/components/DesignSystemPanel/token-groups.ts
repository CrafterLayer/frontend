import type { TokenName } from '@craftkit/builder-schema';

/** How a token row previews its value. */
export type TokenPreviewKind =
  | 'font-size'
  | 'font-weight'
  | 'line-height'
  | 'letter-spacing'
  | 'radius'
  | 'border-width'
  | 'shadow'
  | 'length'
  | 'width';

export interface TokenRowSpec {
  readonly token: TokenName;
  readonly preview: TokenPreviewKind;
}

const rows = (preview: TokenPreviewKind, tokens: readonly TokenName[]): TokenRowSpec[] =>
  tokens.map((token) => ({ token, preview }));

/** The type scale, small to large, then weights, line heights and tracking. */
export const TYPE_SCALE_ROWS: readonly TokenRowSpec[] = [
  ...rows('font-size', [
    'fontSizeXs',
    'fontSizeSm',
    'fontSizeBase',
    'fontSizeLg',
    'fontSizeXl',
    'fontSizeXxl',
    'fontSize3xl',
    'fontSize4xl',
    'fontSize5xl',
    'fontSize6xl',
  ]),
  ...rows('font-weight', ['fontWeightRegular', 'fontWeightMedium', 'fontWeightSemibold', 'fontWeightBold']),
  ...rows('line-height', ['lineHeightTight', 'lineHeightNormal', 'lineHeightRelaxed']),
  ...rows('letter-spacing', ['letterSpacingTight', 'letterSpacingNormal', 'letterSpacingWide']),
];

export const RADIUS_ROWS: readonly TokenRowSpec[] = [
  ...rows('radius', ['radiusSm', 'radius', 'radiusLg', 'radiusXl', 'radiusPill']),
  ...rows('border-width', ['borderWidth']),
];

export const SHADOW_ROWS: readonly TokenRowSpec[] = rows('shadow', [
  'shadowSoft',
  'shadowStrong',
  'shadowElevated',
]);

export const SPACING_ROWS: readonly TokenRowSpec[] = rows('length', [
  'spaceUnit',
  'gapXs',
  'gapSm',
  'gap',
  'gapLg',
  'gutter',
  'sectionSpacingSm',
  'sectionSpacingMd',
  'sectionSpacingLg',
  'sectionSpacingXl',
]);

export const WIDTH_ROWS: readonly TokenRowSpec[] = rows('width', [
  'contentWidthNarrow',
  'contentWidthStandard',
  'contentWidthWide',
  'pageWidth',
  'gridMinTrack',
]);

/** The token each font role writes. */
export const FONT_ROLE_TOKENS = {
  sans: 'fontFamilySans',
  serif: 'fontFamilySerif',
  mono: 'fontFamilyMono',
} as const satisfies Record<'sans' | 'serif' | 'mono', TokenName>;
