import type { Theme } from './resolve/theme';

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
