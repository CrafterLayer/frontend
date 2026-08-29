/**
 * PRIMITIVES — raw values, named by what they ARE, never by where they are used.
 *
 * Nothing outside this package should read a primitive: components consume the
 * SEMANTIC tokens in `../contract.ts`, which are the only names that carry
 * meaning ("the selection colour"), and which a theme may therefore re-point
 * without touching a single component. A primitive answers "which violet"; a
 * semantic token answers "what is this violet for". Conflating the two is how a
 * design system stops being re-themable.
 *
 * The ramps are complete rather than trimmed to today's usage, so a later theme
 * has somewhere to move a token TO without inventing a colour on the spot.
 */

/** Perceptually even violet ramp; 600 is the brand step the mockup fixed. */
export const violet = {
  50: '#eeeefc',
  100: '#dedefa',
  200: '#c7c7f4',
  300: '#a9a9ec',
  400: '#8585e2',
  500: '#6d6dda',
  600: '#5b5bd6',
  700: '#4a4ac2',
  800: '#3e3ea0',
  900: '#353580',
  950: '#22224d',
} as const;

/** Cool neutral, biased very slightly toward the violet so greys never look muddy beside it. */
export const slate = {
  0: '#ffffff',
  25: '#fbfbfd',
  50: '#f6f7fa',
  100: '#eef0f5',
  200: '#e2e5ec',
  300: '#cbd0da',
  400: '#98a0b0',
  /* 450 exists because WCAG 1.4.11 asks 3:1 of a CONTROL's boundary and 400
     measures 2.55 on the panel. A hairline between panels may be quiet;
     the edge of a field a person must find may not. */
  450: '#838c9d',
  500: '#6b7488',
  600: '#4c5568',
  /* Same law, the other ground: 750 measures 1.68 on the dark panel. */
  700: '#5d6779',
  750: '#333b4a',
  800: '#242a36',
  900: '#171b24',
  950: '#0e1116',
  1000: '#080a0e',
} as const;

/** The rail's own near-black — violet-tinted, so the one dark surface belongs to the brand. */
export const ink = {
  700: '#242440',
  800: '#1c1c33',
  900: '#15152a',
  950: '#0e0e1c',
} as const;

export const red = {
  50: '#fef2f2',
  200: '#fecaca',
  500: '#ef4444',
  600: '#dc2626',
  700: '#b91c1c',
} as const;

export const amber = {
  50: '#fffbeb',
  200: '#fde68a',
  500: '#f59e0b',
  600: '#d97706',
  700: '#b45309',
} as const;

export const green = {
  50: '#f0fdf4',
  200: '#bbf7d0',
  500: '#22c55e',
  600: '#16a34a',
  700: '#15803d',
} as const;

/**
 * Alpha values, not opaque greys: chrome that sits ON an unknown surface (a
 * hover tint over a card, a hairline over a screenshot) must tint what is
 * behind it rather than paint over it.
 */
export const alpha = {
  ink6: 'rgb(15 23 42 / 6%)',
  ink10: 'rgb(15 23 42 / 10%)',
  ink14: 'rgb(15 23 42 / 14%)',
  light8: 'rgb(255 255 255 / 8%)',
  light12: 'rgb(255 255 255 / 12%)',
  light18: 'rgb(255 255 255 / 18%)',
} as const;

/**
 * The type stack. Two faces and one job each: Plex carries words, JetBrains
 * carries every value a person compares against another value. Both fall back
 * to the platform's own faces, so a blocked font host degrades to system-ui
 * rather than to Times.
 */
export const family = {
  sans: "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

/**
 * ELEVATION as two layered shadows, never one: a tight line gives the edge its
 * definition at any zoom, the soft spread gives the height. One shadow has to
 * choose between the two and always looks either flat or smudged.
 */
export const shadow = {
  raised: `0 1px 2px ${alpha.ink6}`,
  floating: `0 1px 2px ${alpha.ink6}, 0 8px 24px ${alpha.ink14}`,
  overlay: `0 1px 2px ${alpha.ink10}, 0 16px 40px rgb(15 23 42 / 18%)`,
  raisedDark: '0 1px 2px rgb(0 0 0 / 40%)',
  floatingDark: '0 1px 2px rgb(0 0 0 / 45%), 0 10px 28px rgb(0 0 0 / 55%)',
  overlayDark: '0 1px 2px rgb(0 0 0 / 50%), 0 18px 44px rgb(0 0 0 / 62%)',
} as const;
