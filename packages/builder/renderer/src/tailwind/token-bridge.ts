/**
 * The bridge between the page's token vocabulary and Tailwind v4.
 *
 * Tailwind v4 is configured in CSS: an `@theme` block declares custom
 * properties in known namespaces (`--color-*`, `--spacing-*`, `--text-*`, …)
 * and Tailwind generates the matching utilities from them. That is what makes
 * Tailwind usable here at all. Every entry below points at `var(--t-…)`, so a
 * utility never carries a value of its own — it RESOLVES to whatever the site's
 * generated design system currently says.
 *
 * The consequence is the one this product depends on: `bg-accent` is not a
 * colour, it is a reference. Re-point `--t-accent` and every page moves. A
 * document still holds no literal, so the intent-only law in
 * `schema/src/blocks/style-values.ts` keeps meaning what it says.
 *
 * The mapping is MECHANICAL and one-to-one with the token names. It would read
 * better as `--color-foreground` than `--color-text`, and that is exactly the
 * temptation being refused: a prettier name is a translation table, a
 * translation table is a second source of truth, and a second source of truth
 * drifts the first time a token is added. `TAILWIND_NAMESPACE` is checked for
 * exhaustiveness by a test, so a new token cannot be added without deciding
 * where it belongs.
 */
import type { Theme, TokenName } from '../resolve/theme';
import { tokenCssName } from '../resolve/theme';
import { lightTheme } from '../themes';

/** The Tailwind v4 theme namespaces this bridge writes into. */
export type TailwindNamespace =
  | 'color'
  | 'spacing'
  | 'radius'
  | 'shadow'
  | 'font'
  | 'text'
  | 'font-weight'
  | 'leading'
  | 'tracking'
  | 'container'
  /** Not a utility-generating namespace: emitted as a plain custom property. */
  | 'raw';

export interface TailwindBinding {
  namespace: TailwindNamespace;
  /** The suffix after the namespace, e.g. `accent` in `--color-accent`. */
  suffix: string;
}

/**
 * Every token's Tailwind home. Exhaustive over `TokenName` by construction:
 * `Record<TokenName, …>` makes a missing token a type error, and the test
 * additionally proves no EXTRA key sneaks in at runtime.
 */
export const TAILWIND_NAMESPACE: Record<TokenName, TailwindBinding> = {
  // Colour roles.
  surface: { namespace: 'color', suffix: 'surface' },
  surfaceInverse: { namespace: 'color', suffix: 'surface-inverse' },
  text: { namespace: 'color', suffix: 'text' },
  textInverse: { namespace: 'color', suffix: 'text-inverse' },
  textMuted: { namespace: 'color', suffix: 'text-muted' },
  accent: { namespace: 'color', suffix: 'accent' },
  accentText: { namespace: 'color', suffix: 'accent-text' },
  success: { namespace: 'color', suffix: 'success' },
  successText: { namespace: 'color', suffix: 'success-text' },

  // Rhythm inside a section.
  gap: { namespace: 'spacing', suffix: 'gap' },
  gapXs: { namespace: 'spacing', suffix: 'gap-xs' },
  gapSm: { namespace: 'spacing', suffix: 'gap-sm' },
  gapLg: { namespace: 'spacing', suffix: 'gap-lg' },

  // Rhythm between sections.
  sectionSpacingSm: { namespace: 'spacing', suffix: 'section-sm' },
  sectionSpacingMd: { namespace: 'spacing', suffix: 'section-md' },
  sectionSpacingLg: { namespace: 'spacing', suffix: 'section-lg' },
  gutter: { namespace: 'spacing', suffix: 'gutter' },

  /*
    One step of spacing. Padding props are typed as NUMBERS of steps, never
    lengths, so this token is what `calc(var(--t-space-unit) * n)` multiplies.
  */
  /*
    The base of Tailwind's OWN numeric scale, not just a named step.

    `--spacing` is what `p-4`, `gap-6`, and `mt-2` multiply: Tailwind v4 emits
    `calc(var(--spacing) * 4)`. Binding it here makes the entire default scale
    token-derived, which changes what `p-4` MEANS in this codebase — it is four
    steps of the site's own rhythm, not sixteen pixels.

    That matters because the intent-only law already types padding as a NUMBER
    of steps rather than a length; `style-values.ts` refuses `'16px'` and
    accepts `4`. So Tailwind's numeric scale was never the enemy. An earlier
    version of this project banned it outright, which was wrong: it would have
    forced a named token for every internal gap a block needs, including the
    ones that are not design-system decisions at all.

    The default PALETTE stays banned. `bg-blue-500` is a real literal with no
    token behind it, and no binding here can make it one.
  */
  spaceUnit: { namespace: 'raw', suffix: 'spacing' },

  // The inside of a control.
  controlPaddingBlockSm: { namespace: 'spacing', suffix: 'control-block-sm' },
  controlPaddingBlockMd: { namespace: 'spacing', suffix: 'control-block-md' },
  controlPaddingBlockLg: { namespace: 'spacing', suffix: 'control-block-lg' },
  controlPaddingInlineSm: { namespace: 'spacing', suffix: 'control-inline-sm' },
  controlPaddingInlineMd: { namespace: 'spacing', suffix: 'control-inline-md' },
  controlPaddingInlineLg: { namespace: 'spacing', suffix: 'control-inline-lg' },

  // Motion travel.
  motionDistance: { namespace: 'spacing', suffix: 'motion-distance' },
  motionParallax: { namespace: 'spacing', suffix: 'motion-parallax' },

  // Bar heights, as a scale rather than free numbers.
  barHeightCompact: { namespace: 'spacing', suffix: 'bar-compact' },
  barHeightRegular: { namespace: 'spacing', suffix: 'bar-regular' },
  barHeightTall: { namespace: 'spacing', suffix: 'bar-tall' },

  // Widths a column of content may reach.
  contentWidthNarrow: { namespace: 'container', suffix: 'content-narrow' },
  contentWidthStandard: { namespace: 'container', suffix: 'content-standard' },
  contentWidthWide: { namespace: 'container', suffix: 'content-wide' },
  pageWidth: { namespace: 'container', suffix: 'page' },
  gridMinTrack: { namespace: 'container', suffix: 'grid-min-track' },

  // Shape and elevation.
  radius: { namespace: 'radius', suffix: 'base' },
  shadowSoft: { namespace: 'shadow', suffix: 'soft' },
  shadowStrong: { namespace: 'shadow', suffix: 'strong' },

  // Type.
  fontFamilySans: { namespace: 'font', suffix: 'sans' },
  fontFamilySerif: { namespace: 'font', suffix: 'serif' },
  fontFamilyMono: { namespace: 'font', suffix: 'mono' },
  fontSizeXs: { namespace: 'text', suffix: 'xs' },
  fontSizeSm: { namespace: 'text', suffix: 'sm' },
  fontSizeBase: { namespace: 'text', suffix: 'base' },
  fontSizeLg: { namespace: 'text', suffix: 'lg' },
  fontSizeXl: { namespace: 'text', suffix: 'xl' },
  fontSizeXxl: { namespace: 'text', suffix: '2xl' },
  fontWeightRegular: { namespace: 'font-weight', suffix: 'regular' },
  fontWeightMedium: { namespace: 'font-weight', suffix: 'medium' },
  fontWeightSemibold: { namespace: 'font-weight', suffix: 'semibold' },
  fontWeightBold: { namespace: 'font-weight', suffix: 'bold' },
  lineHeightTight: { namespace: 'leading', suffix: 'tight' },
  lineHeightNormal: { namespace: 'leading', suffix: 'normal' },
  lineHeightRelaxed: { namespace: 'leading', suffix: 'relaxed' },
  letterSpacingTight: { namespace: 'tracking', suffix: 'tight' },
  letterSpacingNormal: { namespace: 'tracking', suffix: 'normal' },
  letterSpacingWide: { namespace: 'tracking', suffix: 'wide' },

  /*
    A hairline. Tailwind v4 has no `--border-width-*` theme namespace, so this
    stays a plain custom property rather than pretending to generate a utility
    that would not exist.
  */
  borderWidth: { namespace: 'raw', suffix: 'border-width' },
};

/** The Tailwind-side custom property a token binds to, e.g. `--color-accent`. */
export function tailwindVarName(token: TokenName): string {
  const binding = TAILWIND_NAMESPACE[token];
  return binding.namespace === 'raw'
    ? `--${binding.suffix}`
    : `--${binding.namespace}-${binding.suffix}`;
}

const HEADER = `/*
  GENERATED FILE — do not edit by hand.

  Produced by packages/builder/renderer/src/tailwind/token-bridge.ts and held
  equal to its generator by token-bridge.test.ts. Edit the generator.

  Every declaration points at a --t-* custom property rather than a value, so
  Tailwind utilities resolve through the site's generated design system. A
  document therefore still holds no literal: bg-accent is a reference, not a
  colour.
*/`;

/**
 * The `@theme` block binding every token to its Tailwind namespace.
 *
 * `@theme inline` is deliberate. Without `inline`, Tailwind copies the declared
 * value into its own generated variable ONCE; with it, the utility keeps
 * referring through to `var(--t-…)`, which is what lets a design-system change
 * at runtime move an already-rendered page. A non-inline theme would bake the
 * starting palette in and quietly break FR-012.
 */
export function buildTailwindThemeCss(theme: Theme = lightTheme): string {
  const tokens = Object.keys(theme) as TokenName[];
  const declarations = tokens
    .slice()
    .sort()
    .map((token) => `  ${tailwindVarName(token)}: var(${tokenCssName(token)});`)
    .join('\n');

  return `${HEADER}\n\n@theme inline {\n${declarations}\n}\n`;
}
