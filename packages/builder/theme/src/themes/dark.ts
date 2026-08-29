import type { ChromeTheme } from '../contract';
import { alpha, family, green, red, amber, shadow, slate, violet } from '../tokens/primitives';

/**
 * The dark chrome theme — Direction B, "Console".
 *
 * Not an inversion. Three things change character rather than value:
 *
 *  - The ACCENT lightens (600 → 400). A 600 violet that reads confidently on
 *    white drops to roughly 3:1 on a near-black ground, which fails for text.
 *  - HOVER and ACTIVE become light alphas rather than dark ones. A dark tint on
 *    a dark surface is invisible; light tints keep the same "slightly nearer
 *    the viewer" meaning.
 *  - SHADOWS get heavier and the borders do more of the work. Elevation reads
 *    by contrast on a light ground and by edge on a dark one.
 *
 * Contrast is NOT tabulated here any more. A table in a comment is a claim
 * written once, and the next person to nudge a ramp has no way to know they
 * broke it — which is exactly what happened: this file used to assert its own
 * ratios, and `contrast.stories.tsx` found three pairings that had never met
 * their floor. The numbers now live in that gate, computed from these values
 * and run in Chromium, so a drift fails a build instead of ageing in prose.
 */
export const darkChromeTheme: ChromeTheme = {
  font: family.sans,
  'font-mono': family.mono,

  surface: slate[900],
  'surface-raised': slate[800],
  'surface-sunken': slate[950],
  'surface-hover': alpha.light8,
  'surface-active': alpha.light12,
  'surface-border': alpha.light12,
  panel: slate[950],
  'panel-control': slate[800],
  'panel-item': slate[800],
  'panel-border': slate[800],
  'panel-border-strong': slate[700],
  'input-bg': slate[800],
  ground: slate[1000],

  rail: slate[1000],
  'rail-raised': slate[800],
  'rail-text': slate[400],
  'rail-text-strong': slate[100],
  'rail-border': alpha.light8,

  'panel-text': slate[100],
  'panel-text-soft': slate[300],
  'panel-muted': slate[400],
  'label-text': slate[950],

  accent: violet[400],
  'accent-strong': violet[300],
  'accent-text': slate[950],
  'accent-soft': violet[950],
  'accent-soft-hover': violet[900],
  'accent-ring': violet[800],

  selection: violet[400],
  hover: violet[500],
  drop: green[500],

  danger: red[500],
  'danger-soft': '#2a1416',
  'danger-border': '#5b2226',
  warning: amber[500],
  'warning-soft': '#2a2010',
  'warning-border': '#5e451a',
  success: green[500],
  'success-soft': '#0f2418',
  'success-border': '#1d5334',

  'shadow-raised': shadow.raisedDark,
  'shadow-floating': shadow.floatingDark,
  'shadow-overlay': shadow.overlayDark,

  'focus-ring': violet[400],
  'focus-ring-width': '2px',
  'focus-ring-offset': '1px',
};
