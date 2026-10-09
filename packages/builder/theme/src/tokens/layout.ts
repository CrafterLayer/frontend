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
  /* A small mark a person aims at or reads a colour from: a crop handle, a palette swatch. */
  handle: '20px',
  /* A token's preview shape. */
  swatch: '24px',
  /* The narrowest cell an icon grid gives one glyph. */
  'icon-cell': '40px',
  /* The trailing value column of a token row (a preview, a short figure). */
  'value-column': '48px',
  /* A colour picker's saturation field. */
  'picker-field': '144px',
  /* A text field floating over the canvas: the text bubble's prompt. */
  'bubble-input': '224px',
  /* Scrolling lists inside a panel or a popover, shortest to tallest. */
  'list-sm': '256px',
  'list-md': '288px',
  'list-lg': '352px',
  /* A floating group popover (the quick bar's): narrowest, widest, tallest. */
  'popover-min': '220px',
  'popover-max': '320px',
  'popover-block': '420px',
} as const;

/**
 * Lengths inside an EFFECT rather than a layout: the blur and the 3D depth a
 * motion preview tile animates through. They are tokens for the same reason
 * every other length is — a host re-points them — and they are their own group
 * because spending a spacing step on a blur radius breaks the day the spacing
 * scale moves.
 */
export const effect = {
  'blur-sm': '3px',
  'blur-md': '4px',
  perspective: '60px',
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
 * THE READING SCALE — the agent panel's type, one size and one line box per
 * role (design SPEC §2.2).
 *
 * Separate from `fontSize` on purpose. The chrome's micro…display steps are
 * what the rail, inspector and top bar were laid out against, and Arabic
 * needs a larger, looser setting than Latin. Bumping the chrome scale for
 * Arabic would have moved every label in the editor; a scale of its own lets
 * `:lang(ar)` re-point these and nothing else.
 *
 * Line boxes are in px, not unitless ratios, so every role sits on a 2px grid
 * and a row's height is a sum a reviewer can check. A record uses exactly
 * three roles (read, meta, figure): hierarchy comes from weight and ink, never
 * from a fourth size.
 */
export const READING_ROLES = ['figure', 'meta', 'read', 'name', 'input', 'lead'] as const;

export type ReadingRole = (typeof READING_ROLES)[number];

export interface ReadingStep {
  readonly size: string;
  readonly line: string;
}

export type ReadingScale = Readonly<Record<ReadingRole, ReadingStep>>;

/** Latin, and the root default. */
export const readingScale: ReadingScale = {
  // Counts, clocks, position numbers, `kbd` — set in tabular figures.
  figure: { size: '11px', line: '16px' },
  // Captions, state words, times, the RunBar's status.
  meta: { size: '12px', line: '16px' },
  // Rows, bubbles, change lines, menu items, prose; record titles at 600.
  read: { size: '13px', line: '20px' },
  // The panel's name in its header.
  name: { size: '14px', line: '20px' },
  // The composer and inline rename.
  input: { size: '14px', line: '20px' },
  // The empty-state greeting.
  lead: { size: '16px', line: '24px' },
};

/**
 * Arabic: one step larger and much looser. Its x-height reads smaller at the
 * same size, and its marks need room above and below the letters, so the line
 * boxes open by 2 to 6px where the sizes grow by 1 or 2.
 */
export const arabicReadingScale: ReadingScale = {
  figure: { size: '12px', line: '18px' },
  meta: { size: '13px', line: '20px' },
  read: { size: '14px', line: '22px' },
  name: { size: '15px', line: '22px' },
  input: { size: '15px', line: '24px' },
  lead: { size: '18px', line: '30px' },
};

/**
 * THE AGENT PANEL'S BANDS — the same at both densities (design SPEC §2.7).
 *
 * Not part of `ShellMetrics`, because the density block restates every shell
 * metric on the element `BuilderTheme` stamps, and that element sits BELOW the
 * root. A band declared there would out-inherit the coarse-pointer values the
 * stylesheet sets on the root, and a phone in compact density would get 32px
 * rows under a thumb. These vary by POINTER, not by density, so they live
 * outside the density block entirely.
 */
export interface AgentPanelMetrics {
  /** The narrowest the panel may be dragged (the separator's `aria-valuemin`); also the compact default. */
  readonly 'assistant-width-min': string;
  /** The widest the panel may be dragged (the separator's `aria-valuemax`). */
  readonly 'assistant-width-max': string;
  /** One line: face, name, two actions. The status line lives in the RunBar. */
  readonly 'agent-header-height': string;
  /** The live status, clock and Stop, above the composer while a run is going. */
  readonly 'agent-runbar-height': string;
  /** Spine rows, plan rows, suggestions and menu items. */
  readonly 'agent-row-height': string;
}

export const agentPanelMetrics: AgentPanelMetrics = {
  'assistant-width-min': '288px',
  'assistant-width-max': '480px',
  'agent-header-height': '44px',
  'agent-runbar-height': '40px',
  'agent-row-height': '32px',
};

/**
 * What a COARSE pointer changes, and nothing else.
 *
 *  - Rows and the RunBar grow to hold a 44px target (WCAG 2.5.5); the header
 *    is 44 already.
 *  - The input grows to 16px, the size below which iOS Safari zooms the whole
 *    page when a field takes focus. Arabic stays at 16 as well (its fine-pointer
 *    15 would zoom), with a looser 26px line for its marks.
 */
export interface CoarsePointerOverrides {
  readonly metrics: Readonly<Partial<AgentPanelMetrics>>;
  readonly reading: Readonly<Partial<Record<ReadingRole, ReadingStep>>>;
  readonly arabicReading: Readonly<Partial<Record<ReadingRole, ReadingStep>>>;
}

export const coarsePointer: CoarsePointerOverrides = {
  metrics: { 'agent-runbar-height': '52px', 'agent-row-height': '44px' },
  reading: { input: { size: '16px', line: '24px' } },
  arabicReading: { input: { size: '16px', line: '26px' } },
};

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
  /**
   * The narrowest a picture may be in a grid of them.
   *
   * A thumbnail has two jobs at once: be big enough that two photographs are
   * tellable apart, and small enough that a panel fits more than one across.
   * Half a panel band, so the second job holds at BOTH densities rather than
   * only the one it was measured at.
   */
  readonly 'thumb-width': string;
  /** The accessibility floor for a pointer target, regardless of the glyph inside it. */
  readonly 'hit-target-min': string;
}

export const comfortable: ShellMetrics = {
  /*
    The rail is pure navigation, so every pixel it takes is a pixel the page
    being edited does not get. 76px was drawn for a tab whose height was pinned
    at 36px and therefore had to buy its presence with width; now that a tab is
    a tile that sizes to its own content, the band can give the canvas 8px back
    and still hold a 17px glyph over its label.
  */
  'rail-width': '68px',
  'panel-width': '288px',
  'inspector-width': '312px',
  /*
    The agent panel (design SPEC §2.7): 40 columns of 8px, and the container
    width at which its thread gutter opens from 12 to 16 (SPEC §3.0). It is
    only where the panel OPENS: a person drags it between
    `assistant-width-min` and `-max`, and rows gain their state words at 400.
  */
  'assistant-width': '320px',
  'topbar-height': '56px',
  'statusbar-height': '36px',
  'dock-min-height': '240px',
  'canvas-gutter': space['5xl'],
  'panel-padding': space['2xl'],
  'control-height': '32px',
  'control-height-sm': '28px',
  'thumb-width': '144px',
  'hit-target-min': '44px',
};

export const compact: ShellMetrics = {
  'rail-width': '56px',
  'panel-width': '248px',
  'inspector-width': '272px',
  // The resize floor: compact opens the panel as narrow as it may go.
  'assistant-width': '288px',
  'topbar-height': '48px',
  'statusbar-height': '30px',
  'dock-min-height': '200px',
  'canvas-gutter': space['3xl'],
  'panel-padding': space.lg,
  'control-height': '28px',
  'control-height-sm': '24px',
  'thumb-width': '124px',
  'hit-target-min': '44px',
};

export type DensityName = 'comfortable' | 'compact';

export const densities: Readonly<Record<DensityName, ShellMetrics>> = {
  comfortable,
  compact,
};
