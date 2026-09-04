import { z } from 'zod';

import type { ColorToken, MeasurementToken, Theme, TokenName } from './tokens';

/**
 * The generated design system: a token map plus the provenance around it.
 *
 * ## Why the vocabulary is repeated at runtime
 *
 * `tokens.ts` states the vocabulary as TYPES, which vanish at build. A
 * validator that must reject an unknown token key needs the same list at
 * runtime, and a hand-copied second list is a second source of truth that
 * drifts the first time a token is added.
 *
 * The two maps below are therefore declared `satisfies Record<Token, true>`.
 * That is not decoration: TypeScript fails the build if a key is MISSING and
 * fails it again if an EXTRA key appears. The runtime array is derived from the
 * map rather than written out, so the list cannot disagree with the union
 * without the compiler saying so.
 */

const COLOR_TOKEN_MAP = {
  surface: true,
  surfaceInverse: true,
  text: true,
  textInverse: true,
  textMuted: true,
  accent: true,
  accentText: true,
  success: true,
  successText: true,
} as const satisfies Record<ColorToken, true>;

const MEASUREMENT_TOKEN_MAP = {
  radius: true,
  radiusSm: true,
  radiusLg: true,
  radiusXl: true,
  radiusPill: true,
  gap: true,
  gapXs: true,
  gapSm: true,
  gapLg: true,
  sectionSpacingSm: true,
  sectionSpacingMd: true,
  sectionSpacingLg: true,
  sectionSpacingXl: true,
  gutter: true,
  contentWidthNarrow: true,
  contentWidthStandard: true,
  contentWidthWide: true,
  pageWidth: true,
  gridMinTrack: true,
  spaceUnit: true,
  borderWidth: true,
  shadowSoft: true,
  shadowStrong: true,
  shadowElevated: true,
  barHeightCompact: true,
  barHeightRegular: true,
  barHeightTall: true,
  fontSizeLg: true,
  fontSizeXl: true,
  letterSpacingWide: true,
  fontSizeXs: true,
  fontSizeBase: true,
  fontSizeXxl: true,
  fontSize3xl: true,
  fontSize4xl: true,
  fontSize5xl: true,
  fontSize6xl: true,
  fontWeightRegular: true,
  fontWeightMedium: true,
  fontWeightSemibold: true,
  fontWeightBold: true,
  lineHeightTight: true,
  lineHeightNormal: true,
  lineHeightRelaxed: true,
  letterSpacingTight: true,
  letterSpacingNormal: true,
  fontFamilySans: true,
  fontFamilySerif: true,
  fontFamilyMono: true,
  fontSizeSm: true,
  motionDistance: true,
  motionParallax: true,
  controlPaddingBlockSm: true,
  controlPaddingBlockMd: true,
  controlPaddingBlockLg: true,
  controlPaddingInlineSm: true,
  controlPaddingInlineMd: true,
  controlPaddingInlineLg: true,
} as const satisfies Record<MeasurementToken, true>;

/** Every colour role, at runtime. Order is the declaration order above. */
export const COLOR_TOKENS = Object.keys(COLOR_TOKEN_MAP) as readonly ColorToken[];

/** Every measurement, at runtime. */
export const MEASUREMENT_TOKENS = Object.keys(MEASUREMENT_TOKEN_MAP) as readonly MeasurementToken[];

/** The complete vocabulary a `Theme` must assign, at runtime. */
export const TOKEN_NAMES: readonly TokenName[] = [...COLOR_TOKENS, ...MEASUREMENT_TOKENS];

export function isColorToken(value: unknown): value is ColorToken {
  return typeof value === 'string' && Object.hasOwn(COLOR_TOKEN_MAP, value);
}

export function isTokenName(value: unknown): value is TokenName {
  return (
    typeof value === 'string' &&
    (Object.hasOwn(COLOR_TOKEN_MAP, value) || Object.hasOwn(MEASUREMENT_TOKEN_MAP, value))
  );
}

/** How large the text in a pairing is, which decides the minimum it must clear. */
export type PairingSize = 'normal' | 'large';

/**
 * A text-on-background pairing the system AUTHORIZES.
 *
 * Declared rather than inferred on purpose. FR-014 requires every authorized
 * pairing to be measured, and left implicit "authorized" would mean "whatever
 * a block happened to do" — which is unmeasurable, so the rule could never
 * fail and would therefore never be a rule.
 */
export interface DesignPairing {
  readonly text: ColorToken;
  readonly background: ColorToken;
  readonly size: PairingSize;
}

/** The pairing choice, kept so it can be reviewed or regenerated. */
export interface DesignTypography {
  readonly headingFamily: string;
  readonly bodyFamily: string;
  /** The ratio the type scale was generated from, e.g. 1.25. */
  readonly scaleRatio: number;
}

export interface DesignSystem {
  /** Human name, e.g. "Warm Clinical". Shown in the panel; aids distinctiveness review. */
  readonly name: string;
  /** The resolved token map. Closed union of keys — an unknown token is a failure. */
  readonly tokens: Theme;
  readonly typography: DesignTypography;
  /** The contrast gate's input. */
  readonly pairings: readonly DesignPairing[];
  /** The seed that produced it, so the system can be reproduced. */
  readonly seed: string;
}

/**
 * The zod mirror of `DesignSystem`, for anything that has to accept one from
 * outside the program — a stored site, a wire payload, a migration.
 *
 * Keys are CLOSED against `TOKEN_NAMES` rather than left as a string record:
 * a token the renderer has no custom property for is a silent nothing at paint
 * time, which is the failure mode a `Record<string, string>` invites and this
 * schema exists to refuse. Shape only — whether the COLOURS are legible is
 * `validateDesignSystem`'s question, and duplicating it here would give two
 * answers to one thing.
 */
export const designSystemSchema: z.ZodType<DesignSystem> = z.strictObject({
  name: z.string().min(1),
  tokens: z.strictObject(
    Object.fromEntries(TOKEN_NAMES.map((token) => [token, z.string().min(1)])) as Record<
      TokenName,
      z.ZodString
    >,
  ),
  typography: z.strictObject({
    headingFamily: z.string().min(1),
    bodyFamily: z.string().min(1),
    scaleRatio: z.number().positive(),
  }),
  pairings: z.array(
    z.strictObject({
      text: z.enum(COLOR_TOKENS),
      background: z.enum(COLOR_TOKENS),
      size: z.enum(['normal', 'large']),
    }),
  ),
  seed: z.string(),
});
