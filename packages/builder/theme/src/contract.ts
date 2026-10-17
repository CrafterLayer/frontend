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

/**
 * STAGE tokens: the marks the builder draws ON the person's page (a writer's
 * edge, a landing ring, a veil over an unwritten placeholder).
 *
 * They are the one group that must NOT follow the editor's theme. Chrome sits
 * on the editor's own grounds, but a stage mark sits on the page, and a light
 * page stays light inside a dark editor — so a mark tuned to the chrome's theme
 * would be tuned to the wrong ground. Each theme therefore carries the same
 * value, and every stroke has a white halo on its inner side so it holds on a
 * dark page as well as a light one.
 *
 * They are still ordinary contract tokens, declared in every theme block: a
 * host that re-brands the stage re-points them like any other name.
 */
export const STAGE_TOKENS = [
  'stage-accent',
  'stage-on-accent',
  'stage-halo',
  'stage-veil',
  'stage-ink',
  'stage-danger',
  // The box-model and layout aids drawn over a selected element: its padding
  // and margin bands, a snap guide, and the columns of a grid container.
  'stage-box-padding',
  'stage-box-margin',
  'stage-guide',
  'stage-grid-track',
] as const;

export type StageTokenName = (typeof STAGE_TOKENS)[number];

export const CHROME_TOKENS = [
  // ── Type ───────────────────────────────────────────────────────────────
  'font',
  // Arabic text's own stack; `:lang(ar)` re-points `font` to it.
  'font-arabic',
  'font-mono',

  // ── Surfaces: the grounds things sit on, lightest to deepest ───────────
  'surface',
  'surface-raised',
  'surface-sunken',
  // A shape on the panel that is not a card: a message bubble, a chip.
  'surface-tint',
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

  // ── Progress: the line a plan is drawn in before it is real ────────────
  'progress-track',

  // ── Canvas chrome: selection, hover, drop ──────────────────────────────
  'selection',
  'hover',
  'drop',

  // ── Content shown inside chrome ────────────────────────────────────────
  // A colour from the person's page (a swatch) is content, not chrome: this
  // ring keeps a white swatch visible on a white panel without tinting it.
  'content-outline',

  // ── Stage: marks drawn on the page itself, one value in every theme ────
  ...STAGE_TOKENS,

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
 *  - `shell-rail-size` — the same mechanism for the rail: `BuilderShell` writes
 *    the rail band it reserves (zero when there is no rail) so an overlaid
 *    panel opens beside the rail instead of over it.
 *  - `inspector-head-size` — `InspectorHeader` measures its sticky head and
 *    writes the height on the panel, so a section header sticks just below it.
 *  - `canvas-zoom` — `EditorCanvas` writes the canvas zoom (canvas-zoom.ts) so the
 *    overlay and the quick bar counter-scale; a theme cannot know the zoom.
 *  - `shell-rail-measure` — the host's rail measure (a captioned rail is wider);
 *    `BuilderShell` reads it with a 48px fallback to place the panel beside it.
 */
export const RUNTIME_WRITTEN_TOKENS: readonly string[] = [
  'arrow-x',
  'inspector-head-size',
  'outline-canvas-x',
  'shell-panel-track',
  'shell-aside-track',
  'shell-rail-size',
  'canvas-zoom',
  'shell-rail-measure',
];
