import type { Theme } from './tokens';
import type { DesignSystem } from './design-system';

/*
  The starter theme VALUES, at layer 0.

  The token TYPES moved here first (T010/T011) and the renderer re-exports them;
  the values follow for the same reason and by the same route. A site stores its
  own design system, and `siteFromDocument` has to give a lifted page a REAL one
  — which it cannot do from a layer above it. Leaving the values in the renderer
  would mean the schema package inventing a second set, and two sets of starter
  colours is how a product ends up looking like two products.
*/

/**
 * The measurements every theme shares.
 *
 * Spelled once because a light and a dark page differ in COLOUR, not in rhythm:
 * duplicating the scale into both themes is how the two drift apart, and a
 * theme whose dark variant spaces its sections differently reads as a different
 * site rather than the same one at night.
 *
 * The values are the ones the stylesheets used to hard-code as fallbacks. That
 * is deliberate: this change gives a person the ability to move them, and moves
 * nothing today.
 */
const measurements = {
  radius: '12px',
  radiusSm: '8px',
  radiusLg: '16px',
  radiusXl: '24px',
  radiusPill: '9999px',
  gap: '16px',
  gapXs: '4px',
  gapSm: '8px',
  gapLg: '32px',
  sectionSpacingSm: '16px',
  sectionSpacingMd: '32px',
  sectionSpacingLg: '64px',
  sectionSpacingXl: '96px',
  gutter: '24px',
  contentWidthNarrow: '40rem',
  contentWidthStandard: '64rem',
  contentWidthWide: '80rem',
  pageWidth: '1152px',
  /*
    192px. Measured, not guessed: the editor canvas is ~764px, whose content
    row is 716px, and three columns only fit there when the floor is at or
    below 12rem. A taller floor made a person choose three columns and get two
    — the control appearing to disobey them in the one place they were looking.
  */
  gridMinTrack: '12rem',
  spaceUnit: '4px',
  borderWidth: '1px',
  /*
    Two steps, not a scale: a page needs "lifted" and "floating" and nothing
    between. Both are neutral rather than tinted, because a shadow that carries
    a hue fights every accent a person picks.
  */
  shadowSoft: '0 1px 2px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.1)',
  shadowStrong: '0 4px 6px -1px rgba(15, 23, 42, 0.1), 0 2px 4px -2px rgba(15, 23, 42, 0.1)',
  shadowElevated: '0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.1)',
  barHeightCompact: '48px',
  barHeightRegular: '64px',
  barHeightTall: '88px',
  fontSizeLg: '1.125rem',
  fontSizeXl: '1.375rem',
  letterSpacingWide: '0.06em',
  fontSizeXs: '0.75rem',
  fontSizeBase: '1rem',
  fontSizeXxl: '1.75rem',
  fontSize3xl: '2.25rem',
  fontSize4xl: '3rem',
  fontSize5xl: '3.75rem',
  fontSize6xl: '4.5rem',
  fontWeightRegular: '400',
  fontWeightMedium: '500',
  fontWeightSemibold: '600',
  fontWeightBold: '700',
  lineHeightTight: '1.2',
  lineHeightNormal: '1.5',
  lineHeightRelaxed: '1.75',
  letterSpacingTight: '-0.01em',
  letterSpacingNormal: '0',
  /*
    Families are STACKS, never a single face: a page that names one font and
    nothing else renders in whatever the browser falls back to the moment that
    face fails to load.
  */
  fontFamilySans:
    "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans Arabic', sans-serif",
  fontFamilySerif: "Georgia, Cambria, 'Times New Roman', 'Noto Naskh Arabic', serif",
  fontFamilyMono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSizeSm: '0.8125rem',
  motionDistance: '24px',
  motionParallax: '40px',
  controlPaddingBlockSm: '8px',
  controlPaddingBlockMd: '10px',
  controlPaddingBlockLg: '14px',
  controlPaddingInlineSm: '14px',
  controlPaddingInlineMd: '20px',
  controlPaddingInlineLg: '28px',
} as const;

/** Starter token sets — the shell milestone owns the full design system later. */
export const lightTheme: Theme = {
  surface: '#ffffff',
  surfaceInverse: '#111827',
  text: '#111827',
  textInverse: '#f9fafb',
  textMuted: '#6b7280',
  accent: '#4f46e5',
  accentText: '#ffffff',
  success: '#047857',
  successText: '#ffffff',
  ...measurements,
};

export const darkTheme: Theme = {
  surface: '#0b1120',
  surfaceInverse: '#f9fafb',
  text: '#e5e7eb',
  textInverse: '#111827',
  textMuted: '#9ca3af',
  accent: '#818cf8',
  accentText: '#0b1120',
  success: '#34d399',
  successText: '#0b1120',
  ...measurements,
};

/**
 * The design system a site gets when nobody has chosen one — the starter light
 * theme, expressed as the validated shape.
 *
 * Its `pairings` are the load-bearing part, and they are MEASURED rather than
 * assumed. Every pairing below clears 4.5:1 for normal text at the real hex
 * values:
 *
 * | pairing                       | ratio |
 * | ----------------------------- | ----- |
 * | `text` on `surface`           | 17.74 |
 * | `textInverse` on `surfaceInverse` | 16.98 |
 * | `accentText` on `accent`      |  6.29 |
 * | `accent` on `surface`         |  6.29 |
 * | `successText` on `success`    |  5.48 |
 * | `textMuted` on `surface`      |  4.83 |
 *
 * Three combinations are deliberately NOT declared, and the reason is not that
 * they fail — it is that they are not what the theme means. `text` on
 * `surfaceInverse` measures 1.00 because they are the SAME hex: the dark panel
 * is the dark ink. Putting body ink on it is what `textInverse` is for, and
 * declaring the pair would be declaring a mistake in order to then forbid it.
 * `textMuted` (3.67) and `accent` (2.82) on the inverse surface are the same
 * kind of non-choice.
 *
 * The rule this follows: a pairing is a PROMISE that a combination will be
 * used and must stay legible. Declaring one that nothing renders would make the
 * gate louder without making the product safer, and omitting one that IS
 * rendered would be the reverse. Anything the design system later adds must be
 * measured the same way before it is listed.
 */
export function defaultDesignSystem(): DesignSystem {
  /*
    A COPY, not the shared `lightTheme` object. `DesignSystem.tokens` is the
    per-site palette the design deliverable will mutate; handing every caller
    the same object would make one site's colour edit change every other site
    that was ever built from the default — a defect no test on a single site
    could see. The spread costs one 67-key allocation per site.
  */
  const tokens: Theme = { ...lightTheme };

  return {
    /*
      The name the migration has always produced. Renaming it to something
      prettier would be an observable change nobody asked for: T007 is about
      the tokens being real, not about what the starter is called.
    */
    name: 'Default',
    tokens,
    typography: {
      /*
        Read from the tokens rather than retyped. An earlier draft duplicated a
        similar-looking stack and silently dropped `Noto Sans Arabic` — in a
        product whose whole panel is bilingual, that is the fallback that
        matters most. Reading the token makes the drift impossible.
      */
      headingFamily: tokens.fontFamilySans,
      bodyFamily: tokens.fontFamilySans,
      /* A major third. Conservative on purpose: a starter scale should be the
         one nobody notices, not the one that dates the page. */
      scaleRatio: 1.25,
    },
    /*
      Every pairing here was MEASURED against `contrastRatio`, and every one is
      declared `normal` so the strict 4.5 threshold applies:

        text        on surface         17.740
        textMuted   on surface          4.834
        accent      on surface          6.288
        textInverse on surfaceInverse   16.975
        accentText  on surfaceInverse   17.740
        accentText  on accent           6.288
        successText on success          5.484

      `pairings` is an authorization list, not the cartesian product: the seven
      here are the combinations the marketing blocks actually render (Hero and
      PageHeader render `accentText` on `surfaceInverse`), and the unsafe
      remainder — `text` on `accent` at 2.82, `textMuted` on `surfaceInverse`
      at 3.67 — is left out precisely so a document that uses one fails.
    */
    pairings: [
      { text: 'text', background: 'surface', size: 'normal' },
      { text: 'textMuted', background: 'surface', size: 'normal' },
      { text: 'accent', background: 'surface', size: 'normal' },
      { text: 'textInverse', background: 'surfaceInverse', size: 'normal' },
      { text: 'accentText', background: 'surfaceInverse', size: 'normal' },
      { text: 'accentText', background: 'accent', size: 'normal' },
      { text: 'successText', background: 'success', size: 'normal' },
    ],
    /*
      A name, not an empty string. The first draft of this left the seed blank
      and argued that a system nobody generated has no history to record — and
      `validateDesignSystem` refused it, correctly. A seed's job is to make a
      system REPRODUCIBLE, and a fixed starter is the most reproducible kind
      there is: this constant produces it every time. Blank would have meant
      "unknown origin" for something whose origin is exactly known.
    */
    seed: 'starter-light',
  };
}
