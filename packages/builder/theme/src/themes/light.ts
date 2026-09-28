import type { ChromeTheme, StageTokenName } from '../contract';
import { alpha, family, green, ink, red, amber, shadow, slate, violet } from '../tokens/primitives';

/**
 * The stage palette, owned HERE and spread into both themes, because it must
 * not differ between them: stage marks are drawn on the person's page, which
 * keeps its own light or dark ground whatever the editor wears (see
 * `STAGE_TOKENS`). One object makes a drift between the themes impossible
 * rather than merely tested.
 *
 * The values are tuned for an unknown page. The accent holds 3:1 as a stroke
 * on white, on #111827 and on black; the danger stroke does not on a dark
 * page (2.74 on #111827), which is why every stroke carries the white halo on
 * its inner side (17.74 there). The veil is slate-50 at 94%, so a placeholder
 * reads as "not yet written" rather than as missing.
 */
export const stageTokens: Readonly<Record<StageTokenName, string>> = {
  'stage-accent': violet[600],
  'stage-on-accent': slate[0],
  'stage-halo': slate[0],
  'stage-veil': alpha.paper94,
  'stage-ink': slate[600],
  'stage-danger': red[700],
};

/**
 * The default chrome theme.
 *
 * Every value here is a PRIMITIVE reference, never a literal: a literal in this
 * file is a colour that exists in exactly one place and can never be reasoned
 * about as part of a ramp. If a value you want is not in the ramp, add it to
 * the ramp — the ramp is the argument, this file is only the assignment.
 *
 * Contrast is NOT tabulated here any more. A table in a comment is a claim
 * written once, and the next person to nudge a ramp has no way to know they
 * broke it — which is exactly what happened: this file used to assert its own
 * ratios, and `contrast.stories.tsx` found three pairings that had never met
 * their floor. The numbers now live in that gate, computed from these values
 * and run in Chromium, so a drift fails a build instead of ageing in prose.
 */
export const lightChromeTheme: ChromeTheme = {
  font: family.sans,
  'font-arabic': family.arabic,
  'font-mono': family.mono,

  surface: slate[0],
  'surface-raised': slate[0],
  'surface-sunken': slate[50],
  'surface-tint': slate[125],
  'surface-hover': alpha.ink6,
  'surface-active': alpha.ink10,
  'surface-border': alpha.ink10,
  panel: slate[25],
  'panel-control': slate[0],
  'panel-item': slate[0],
  'panel-border': slate[200],
  'panel-border-strong': slate[450],
  'input-bg': slate[0],
  ground: slate[100],

  rail: ink[900],
  'rail-raised': ink[700],
  'rail-text': '#9a9ab8',
  'rail-text-strong': slate[0],
  'rail-border': alpha.light12,

  'panel-text': slate[900],
  'panel-text-soft': slate[600],
  'panel-muted': slate[500],
  'label-text': slate[0],

  accent: violet[600],
  'accent-strong': violet[700],
  'accent-text': slate[0],
  'accent-soft': violet[50],
  'accent-soft-hover': violet[100],
  'accent-ring': violet[200],

  'progress-track': slate[325],

  selection: violet[600],
  hover: violet[400],
  drop: green[600],

  'content-outline': alpha.ink18,

  ...stageTokens,

  danger: red[700],
  'danger-soft': red[50],
  'danger-border': red[200],
  warning: amber[700],
  'warning-soft': amber[50],
  'warning-border': amber[200],
  success: green[700],
  'success-soft': green[50],
  'success-border': green[200],

  'shadow-raised': shadow.raised,
  'shadow-floating': shadow.floating,
  'shadow-overlay': shadow.overlay,

  'focus-ring': violet[600],
  'focus-ring-width': '2px',
  'focus-ring-offset': '1px',
};
