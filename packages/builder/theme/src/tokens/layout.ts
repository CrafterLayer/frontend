/**
 * LAYOUT — the builder's chrome measured in one place.
 *
 * A workspace tool is judged on how little of the screen it wastes, and waste
 * creeps in when each panel picks its own padding. Here every band of the shell
 * declares its size once, so density is a single decision: turn `comfortable`
 * into `compact` and the whole editor tightens without touching a component.
 *
 * These become custom properties like the colours do, which is what makes a
 * host able to say "my rail is 64px" without forking a stylesheet.
 */

/**
 * A 4px rhythm. Deliberately NOT an 8px grid: a dense tool needs the odd 4, 12
 * and 20 to keep a 28px control from carrying 16px of air on each side, and
 * every value below is a real measurement from the boards, not a filled-in row.
 */
export const space = {
  0: '0',
  '2xs': '2px',
  xs: '4px',
  sm: '6px',
  md: '8px',
  lg: '10px',
  xl: '12px',
  '2xl': '14px',
  '3xl': '16px',
  '4xl': '20px',
  '5xl': '24px',
  '6xl': '32px',
} as const;

/**
 * Stroke widths. A hairline had no name, so every stylesheet wrote `1px` — or,
 * worse, `calc(var(--bldr-space-2xs) / 2)`, which spends a spacing token on a
 * border and breaks the moment the spacing scale is re-pointed. A border is its
 * own decision and now says so.
 */
export const borderWidth = {
  hairline: '1px',
  thick: '2px',
  focus: '3px',
} as const;

/**
 * Content measures — the two lengths that are neither spacing nor a control.
 *
 * Both were `rem` before, which resolves against the ROOT font size of a
 * document the editor does not control: a host at 14px root silently narrowed
 * the page and shortened the dock. In px they are the editor's own decision,
 * and being tokens they are still a host's to re-point.
 */
export const measure = {
  page: '1152px',
  dock: '288px',
  /*
    The colour popover. Deliberately small: it floats over a canvas someone is
    looking at, so it has to be big enough to aim inside and no bigger.
  */
  picker: '208px',
} as const;

/**
 * Control heights — because one number cannot govern every control.
 *
 * `hit-target-min` is 44px, which is the TOUCH target (WCAG 2.2 AAA, SC 2.5.5).
 * Applying it to every control made a 312px inspector feel like a phone: three
 * alignment buttons at 44x44 and a section header at 44 tall, in a column where
 * a professional builder puts 28. The AA floor (SC 2.5.8) is 24, so a dense
 * panel control has real room below 44 without failing anyone.
 *
 * The rule this encodes: `sm` for controls inside a dense panel, `md` for a
 * panel's text inputs, and `hit-target-min` for anything a finger reaches —
 * the top bar's actions and the floating canvas chrome.
 */
export const control = {
  sm: '28px',
  md: '32px',
  lg: '36px',
} as const;

export const radius = {
  none: '0',
  xs: '4px',
  sm: '6px',
  md: '7px',
  lg: '9px',
  xl: '12px',
  full: '999px',
} as const;

/**
 * The type scale, in the roles the chrome actually has. Six steps, because a
 * seventh would be a step nobody could tell from its neighbour.
 */
export const fontSize = {
  micro: '10.5px',
  caption: '11.5px',
  body: '12.5px',
  control: '13px',
  title: '14px',
  display: '15px',
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const lineHeight = {
  tight: '1.2',
  snug: '1.4',
  normal: '1.55',
} as const;

/**
 * Motion. One duration for state, one for movement, and a single easing — a
 * product with five easings reads as five products.
 */
export const motion = {
  'duration-state': '120ms',
  'duration-move': '180ms',
  easing: 'cubic-bezier(0.2, 0, 0.13, 1)',
} as const;

/**
 * THE SHELL BANDS — the actual pixels the editor spends its screen on.
 *
 * `comfortable` is the default the boards were drawn at. `compact` is the same
 * layout with every band tightened; it exists so a 13-inch screen gets more
 * canvas rather than a smaller version of everything, which is what a zoom-out
 * would give.
 */
export interface ShellMetrics {
  readonly 'rail-width': string;
  readonly 'panel-width': string;
  readonly 'inspector-width': string;
  readonly 'assistant-width': string;
  readonly 'topbar-height': string;
  readonly 'statusbar-height': string;
  readonly 'dock-min-height': string;
  readonly 'canvas-gutter': string;
  readonly 'panel-padding': string;
  readonly 'control-height': string;
  readonly 'control-height-sm': string;
  /** The accessibility floor for a pointer target, regardless of the glyph inside it. */
  readonly 'hit-target-min': string;
}

export const comfortable: ShellMetrics = {
  'rail-width': '76px',
  'panel-width': '288px',
  'inspector-width': '312px',
  'assistant-width': '376px',
  'topbar-height': '56px',
  'statusbar-height': '36px',
  'dock-min-height': '240px',
  'canvas-gutter': space['5xl'],
  'panel-padding': space['2xl'],
  'control-height': '32px',
  'control-height-sm': '28px',
  'hit-target-min': '44px',
};

export const compact: ShellMetrics = {
  'rail-width': '60px',
  'panel-width': '248px',
  'inspector-width': '272px',
  'assistant-width': '332px',
  'topbar-height': '48px',
  'statusbar-height': '30px',
  'dock-min-height': '200px',
  'canvas-gutter': space['3xl'],
  'panel-padding': space.lg,
  'control-height': '28px',
  'control-height-sm': '24px',
  'hit-target-min': '44px',
};

export type DensityName = 'comfortable' | 'compact';

export const densities: Readonly<Record<DensityName, ShellMetrics>> = {
  comfortable,
  compact,
};
