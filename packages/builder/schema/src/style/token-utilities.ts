/**
 * The theme-token utility names, per Tailwind namespace.
 *
 * The renderer's token bridge (`renderer/src/tailwind/token-bridge.ts`) binds
 * every design token to a Tailwind theme variable — `--color-accent`,
 * `--radius-lg`, `--shadow-soft` — and Tailwind turns each into utilities
 * (`bg-accent`, `rounded-lg`, `shadow-soft`). The schema package cannot import
 * the renderer, so the names are restated here and held equal to the bridge by
 * `renderer/src/tailwind/token-parity.test.ts`, in both directions: a token
 * added to the bridge without a name here fails, and so does a name here the
 * bridge does not produce.
 *
 * `raw` bindings (`--spacing`, `--border-width`) generate no named utility and
 * are deliberately absent.
 */

export const TOKEN_UTILITY_NAMES = {
  color: [
    'surface',
    'surface-inverse',
    'text',
    'text-inverse',
    'text-muted',
    'accent',
    'accent-text',
    'success',
    'success-text',
  ],
  spacing: [
    'gap',
    'gap-xs',
    'gap-sm',
    'gap-lg',
    'section-sm',
    'section-md',
    'section-lg',
    'section-xl',
    'gutter',
    'control-block-sm',
    'control-block-md',
    'control-block-lg',
    'control-inline-sm',
    'control-inline-md',
    'control-inline-lg',
    'motion-distance',
    'motion-parallax',
    'bar-compact',
    'bar-regular',
    'bar-tall',
  ],
  container: ['content-narrow', 'content-standard', 'content-wide', 'page', 'grid-min-track'],
  radius: ['base', 'sm', 'lg', 'xl', 'full'],
  shadow: ['soft', 'strong', 'elevated'],
  font: ['sans', 'serif', 'mono'],
  text: ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl'],
  'font-weight': ['regular', 'medium', 'semibold', 'bold'],
  leading: ['tight', 'normal', 'relaxed'],
  tracking: ['tight', 'normal', 'wide'],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/** A Tailwind namespace the token bridge generates named utilities in. */
export type TokenUtilityNamespace = keyof typeof TOKEN_UTILITY_NAMES;

/** Colour-role tokens: `bg-accent`, `text-text-muted`, `border-surface`. */
export const COLOR_TOKENS: readonly string[] = TOKEN_UTILITY_NAMES.color;

/** Named spacing tokens: `p-gutter`, `gap-gap-lg`, `py-section-md`. */
export const SPACING_TOKENS: readonly string[] = TOKEN_UTILITY_NAMES.spacing;

/** Named container widths: `max-w-content-narrow`, `max-inline-page`. */
export const CONTAINER_TOKENS: readonly string[] = TOKEN_UTILITY_NAMES.container;
