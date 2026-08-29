/**
 * THE CHROME CONTRACT — every custom property the builder's interface may read.
 *
 * This list is the whole point of the package. Before it existed, twenty
 * stylesheets read `var(--bldr-selection, #4f46e5)` and NOTHING anywhere
 * defined `--bldr-selection`: the builder ran entirely on fallbacks, two files
 * disagreed about what `--bldr-accent` fell back to, and "theming" was not
 * possible because there was no set of names to re-point.
 *
 * Because the keys are a closed union:
 *   - a theme that forgets a token fails TYPECHECK, not a design review;
 *   - the stylesheet is generated from the themes, so it cannot drift;
 *   - `coverage.test.ts` reads every `var(--bldr-…)` in the workspace and fails
 *     if a component uses a name this contract does not carry.
 *
 * Naming is `surface / border / text / accent / state`, never a component name.
 * A token called `--bldr-inspector-label` would make the inspector unthemable
 * with everything else; `--bldr-text-muted` describes a ROLE, so one theme
 * decision moves every label at once.
 */

export const CHROME_TOKENS = [
  // ── Type ───────────────────────────────────────────────────────────────
  'font',
  'font-mono',

  // ── Surfaces: the grounds things sit on, lightest to deepest ───────────
  'surface',
  'surface-raised',
  'surface-sunken',
  'surface-hover',
  'surface-active',
  'surface-border',
  'panel',
  'panel-control',
  'panel-item',
  'panel-border',
  'panel-border-strong',
  'input-bg',
  'ground',

  // ── The one dark surface: the rail ─────────────────────────────────────
  'rail',
  'rail-raised',
  'rail-text',
  'rail-text-strong',
  'rail-border',

  // ── Text, in descending emphasis ───────────────────────────────────────
  'panel-text',
  'panel-text-soft',
  'panel-muted',
  'label-text',

  // ── Brand ──────────────────────────────────────────────────────────────
  'accent',
  'accent-strong',
  'accent-text',
  'accent-soft',
  'accent-soft-hover',
  'accent-ring',

  // ── Canvas chrome: selection, hover, drop ──────────────────────────────
  'selection',
  'hover',
  'drop',

  // ── Semantic state — kept apart from the brand on purpose ──────────────
  'danger',
  'danger-soft',
  'danger-border',
  'warning',
  'warning-soft',
  'warning-border',
  'success',
  'success-soft',
  'success-border',

  // ── Elevation ──────────────────────────────────────────────────────────
  'shadow-raised',
  'shadow-floating',
  'shadow-overlay',

  // ── Focus: one ring for the whole product ──────────────────────────────
  'focus-ring',
  'focus-ring-width',
  'focus-ring-offset',
] as const;

export type ChromeTokenName = (typeof CHROME_TOKENS)[number];

/** A complete theme: every token, no exceptions — the type enforces it. */
export type ChromeTheme = Readonly<Record<ChromeTokenName, string>>;

/**
 * A partial override, which is what a host applies at runtime. `| undefined` is
 * explicit because `exactOptionalPropertyTypes` is on: a host assembling an
 * override from its own optional config would otherwise be unable to pass it
 * without stripping the undefined keys first, and `themeStyle` already drops
 * them rather than writing "undefined" into the DOM.
 */
export type ChromeThemeOverride = Partial<Readonly<Record<ChromeTokenName, string | undefined>>>;

/** `accent` → `--bldr-accent`. The single place the prefix is spelled. */
export const TOKEN_PREFIX = '--bldr-';

export function cssVarName(token: ChromeTokenName): string {
  return `${TOKEN_PREFIX}${token}`;
}

/**
 * Names that are CHANNELS, not design decisions: a component writes them for
 * itself and nobody themes them, so the contract deliberately excludes them
 * and the coverage gate skips them. Each one has to earn its place here.
 *
 *  - `arrow-x` — the floating host measures the bubble arrow's offset per frame
 *    and writes it as a physical pixel value.
 *  - `shell-panel-track` / `shell-aside-track` — `BuilderShell` collapses an
 *    absent region's grid track to zero by writing these on itself. They are
 *    the mechanism BEHIND `--bldr-panel-width`, which IS themeable; a host
 *    re-points the width, never the track.
 */
export const RUNTIME_WRITTEN_TOKENS: readonly string[] = [
  'arrow-x',
  'outline-canvas-x',
  'shell-panel-track',
  'shell-aside-track',
];
