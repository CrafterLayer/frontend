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
  /* 125 and 850 are a TINT: a fill that reads as a shape on the panel
     without becoming a card (1.12 on the light panel, 1.23 for 850 on the
     dark one). Graphite text holds 6.45 on 125; 200 would drop it to 5.93. */
  125: '#eceef3',
  200: '#e2e5ec',
  300: '#cbd0da',
  /* 325 and 725 are the PENCIL line a plan is drawn in. Deliberately faint
     (1.53 and 1.87 on the panel): the line is decoration, and the state it
     draws lives in the node glyph beside it, which holds 3:1 on its own. */
  325: '#c9ced9',
  400: '#98a0b0',
  /* 450 exists because WCAG 1.4.11 asks 3:1 of a CONTROL's boundary and 400
     measures 2.55 on the panel. A hairline between panels may be quiet;
     the edge of a field a person must find may not. */
  450: '#838c9d',
  500: '#6b7488',
  600: '#4c5568',
  /* Same law, the other ground: 750 measures 1.68 on the dark panel. */
  700: '#5d6779',
  725: '#3a4250',
  750: '#333b4a',
  800: '#242a36',
  850: '#1f2530',
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
  ink18: 'rgb(15 23 42 / 18%)',
  light8: 'rgb(255 255 255 / 8%)',
  light12: 'rgb(255 255 255 / 12%)',
  light18: 'rgb(255 255 255 / 18%)',
  light20: 'rgb(255 255 255 / 20%)',
  /* slate-50 held at 94%: a veil that hides what is under it without erasing
     it, so a person still sees that SOMETHING is there. */
  paper94: 'rgb(246 247 250 / 94%)',
} as const;

/**
 * The type stack. Plex carries words in both scripts, JetBrains carries every
 * value a person compares against another value. All fall back to the
 * platform's own faces, so a blocked font host degrades to system-ui rather
 * than to Times.
 *
 * Plex Sans and Plex Sans Arabic are one design drawn for two scripts, so
 * each stack names its partner second: an Arabic word inside Latin chrome
 * takes the Arabic face, and a Latin word inside Arabic text takes the Latin
 * one, instead of either falling to a system face that matches neither. The
 * ORDER is what differs, because the first family sets the line's strut and
 * baseline — Arabic set on a Latin strut sits high in a 32px control.
 */
export const family = {
  sans: "'IBM Plex Sans', 'IBM Plex Sans Arabic', system-ui, -apple-system, 'Segoe UI', sans-serif",
  arabic:
    "'IBM Plex Sans Arabic', 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

/**
 * MOTION — the product's tempo, shared by every theme.
 *
 * Kept with the primitives because no theme re-points it: like the typeface,
 * how long a thing takes to arrive is a product decision, not a colour one.
 *
 * The durations form one ladder, shortest first. Three rules hold it together:
 *  - EXIT is about 0.64 of ENTER. Something leaving is no longer the subject,
 *    so it gets out of the way faster than it arrived.
 *  - ENTER decelerates and EXIT accelerates; an in-place change (hover, a
 *    colour, a count) uses the neutral `easing`.
 *  - LOOPS (glint, shimmer) are slow on purpose and run `linear`, which is a
 *    keyword and needs no token: a loop that eases pulses, and a pulse reads
 *    as an alarm.
 */
export const motion = {
  'duration-press': '80ms',
  'duration-state': '120ms',
  'duration-exit': '140ms',
  'duration-move': '180ms',
  'duration-enter': '220ms',
  /* One section landing on the page: the spine segment filling, the node
     turning solid. Long enough to be SEEN as the moment it happened. */
  'duration-land': '360ms',
  /* The once-per-build sweep down the finished spine. */
  'duration-sweep': '720ms',
  /* Phase 2: the ring a section wears on the canvas as it lands. */
  'duration-glow': '900ms',
  /* The light travelling down a writer's segment, one pass per loop. */
  'duration-glint': '1400ms',
  /* The live line's text shimmer. */
  'duration-shimmer': '2000ms',
  easing: 'cubic-bezier(0.2, 0, 0.13, 1)',
  'easing-enter': 'cubic-bezier(0.16, 1, 0.3, 1)',
  'easing-exit': 'cubic-bezier(0.4, 0, 1, 1)',
} as const;

/**
 * ELEVATION as two layered shadows, never one: a tight line gives the edge its
 * definition at any zoom, the soft spread gives the height. One shadow has to
 * choose between the two and always looks either flat or smudged.
 */
export const shadow = {
  raised: `0 1px 2px ${alpha.ink6}`,
  floating: `0 1px 2px ${alpha.ink6}, 0 8px 24px ${alpha.ink14}`,
  overlay: `0 1px 2px ${alpha.ink10}, 0 16px 40px ${alpha.ink18}`,
  raisedDark: '0 1px 2px rgb(0 0 0 / 40%)',
  floatingDark: '0 1px 2px rgb(0 0 0 / 45%), 0 10px 28px rgb(0 0 0 / 55%)',
  overlayDark: '0 1px 2px rgb(0 0 0 / 50%), 0 18px 44px rgb(0 0 0 / 62%)',
} as const;
