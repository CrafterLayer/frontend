/**
 * The effects library: CSS for every `ck-fx-<name>` hook class in
 * `CUSTOM_CODE_EFFECTS` (style-manager DESIGN.md §C.1–C.2).
 *
 * An effect is a class an element WEARS — glass, a mesh gradient, a grain
 * overlay, a grid — so the panel and the agent attach it by name and the page
 * stores only that name. Colours come from theme tokens (`--t-*`) with the
 * same fallbacks Tailwind's theme uses; every effect also reads
 * `--ck-fx-c1` / `--ck-fx-c2` first, so an element can point an effect at a
 * palette colour with one arbitrary utility, e.g. `[--ck-fx-c1:var(--ck-c-brand)]`.
 *
 * ## Pseudo-element map (two effects on one pseudo cannot both show)
 *
 * - `::before` (behind the content, z-index -1 in an isolated host):
 *   grid, dots, retro-grid, aurora-bg
 * - `::after` (over the content, never catching the pointer):
 *   noise, spotlight, gradient-border
 * - the element itself: glass, mesh, text-gradient, ring-glow
 *
 * ## Motion and transparency
 *
 * Only `retro-grid` and `aurora-bg` move, and only under
 * `prefers-reduced-motion: no-preference`; both are longer than 5 s, so both
 * pause on hover and focus. Glass falls back to a solid surface where
 * `backdrop-filter` is missing and under `prefers-reduced-transparency`.
 *
 * Layered in `@layer components`, like the presets: an element's own utilities
 * override an effect's defaults.
 */
import { CUSTOM_CODE_EFFECTS, type CustomCodeEffect } from '@craftkit/builder-schema';

import { NO_PREFERENCE } from './presets-css';

function rule(selectors: string | readonly string[], declarations: readonly string[]): string {
  const list = typeof selectors === 'string' ? [selectors] : selectors;
  return [`${list.join(',\n')} {`, ...declarations.map((line) => `  ${line}`), '}'].join('\n');
}

function block(prelude: string, body: readonly string[]): string {
  const inner = body.filter((part) => part !== '');
  if (inner.length === 0) return '';
  const indented = inner
    .join('\n')
    .split('\n')
    .map((line) => (line === '' ? line : `  ${line}`))
    .join('\n');
  return `${prelude} {\n${indented}\n}`;
}

const FX = (name: CustomCodeEffect): string => `.ck-fx-${name}`;
const C1 = 'var(--ck-fx-c1, var(--t-accent, #4f46e5))';
const C2 = 'var(--ck-fx-c2, var(--t-success, #16a34a))';
const SURFACE = 'var(--t-surface, #ffffff)';
const INK = 'var(--t-text, #18181b)';
const LINE = `var(--ck-fx-line, color-mix(in oklab, ${INK} 10%, transparent))`;

/** A decorative layer behind the content: the host isolates, the layer sits at -1. */
const UNDERLAY = [
  "content: '';",
  'position: absolute;',
  'inset: 0;',
  'z-index: -1;',
  'border-radius: inherit;',
  'pointer-events: none;',
];
/** A decorative layer over the content that never takes the pointer. */
const OVERLAY = [
  "content: '';",
  'position: absolute;',
  'inset: 0;',
  'border-radius: inherit;',
  'pointer-events: none;',
];
const HOST = ['position: relative;', 'isolation: isolate;'];

/** An SVG for a data: URI — escaped so it stays a valid CSS url(). */
function svgUri(svg: string): string {
  return `url("data:image/svg+xml,${svg.replace(/"/gu, "'").replace(/</gu, '%3C').replace(/>/gu, '%3E').replace(/#/gu, '%23')}")`;
}

const NOISE = svgUri(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>',
);

interface EffectCss {
  readonly base: readonly string[];
  readonly keyframes?: readonly string[];
  readonly motion?: readonly string[];
  readonly extra?: readonly string[];
}

/* The MASK colour below (#000) is an alpha stencil, not a paint colour. */
const RING_MASK = [
  '-webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);',
  '-webkit-mask-composite: xor;',
  'mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);',
];

const EFFECTS: Readonly<Record<CustomCodeEffect, () => EffectCss>> = {
  glass: () => ({
    base: [
      rule(FX('glass'), [
        `background-color: color-mix(in oklab, ${SURFACE} 62%, transparent);`,
        '-webkit-backdrop-filter: blur(16px) saturate(1.5);',
        'backdrop-filter: blur(16px) saturate(1.5);',
        `border: 1px solid color-mix(in oklab, ${INK} 12%, transparent);`,
        `box-shadow: inset 0 1px 0 color-mix(in oklab, ${SURFACE} 45%, transparent);`,
      ]),
    ],
    extra: [
      block(
        '@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))',
        [rule(FX('glass'), [`background-color: ${SURFACE};`])],
      ),
      block('@media (prefers-reduced-transparency: reduce)', [
        rule(FX('glass'), [
          `background-color: ${SURFACE};`,
          '-webkit-backdrop-filter: none;',
          'backdrop-filter: none;',
        ]),
      ]),
    ],
  }),
  mesh: () => ({
    base: [
      rule(FX('mesh'), [
        `background-color: ${SURFACE};`,
        [
          'background-image:',
          `radial-gradient(at 12% 18%, color-mix(in oklab, ${C1} 55%, transparent) 0, transparent 55%),`,
          `radial-gradient(at 88% 12%, color-mix(in oklab, ${C2} 45%, transparent) 0, transparent 50%),`,
          `radial-gradient(at 78% 88%, color-mix(in oklab, var(--ck-fx-c3, var(--t-accent-text, #ffffff)) 40%, transparent) 0, transparent 55%),`,
          `radial-gradient(at 18% 92%, color-mix(in oklab, ${C1} 30%, transparent) 0, transparent 50%);`,
        ].join(' '),
      ]),
    ],
  }),
  noise: () => ({
    base: [
      rule(FX('noise'), HOST),
      rule(`${FX('noise')}::after`, [
        ...OVERLAY,
        `background-image: ${NOISE};`,
        'background-size: 160px 160px;',
        'opacity: var(--ck-fx-noise, 0.14);',
        'mix-blend-mode: overlay;',
      ]),
    ],
  }),
  /* Magic UI grid-pattern (MIT): a 1px lattice, faded out by a radial mask. */
  grid: () => ({
    base: [
      rule(FX('grid'), HOST),
      rule(`${FX('grid')}::before`, [
        ...UNDERLAY,
        `background-image: linear-gradient(to right, ${LINE} 1px, transparent 1px), linear-gradient(to bottom, ${LINE} 1px, transparent 1px);`,
        'background-size: var(--ck-fx-cell, 40px) var(--ck-fx-cell, 40px);',
        '-webkit-mask-image: radial-gradient(ellipse at 50% 40%, #000 30%, transparent 75%);',
        'mask-image: radial-gradient(ellipse at 50% 40%, #000 30%, transparent 75%);',
      ]),
    ],
  }),
  /* Magic UI dot-pattern (MIT): one dot per cell, the same fading mask. */
  dots: () => ({
    base: [
      rule(FX('dots'), HOST),
      rule(`${FX('dots')}::before`, [
        ...UNDERLAY,
        `background-image: radial-gradient(circle at 1px 1px, var(--ck-fx-line, color-mix(in oklab, ${INK} 22%, transparent)) 1px, transparent 1.5px);`,
        'background-size: var(--ck-fx-cell, 20px) var(--ck-fx-cell, 20px);',
        '-webkit-mask-image: radial-gradient(ellipse at 50% 40%, #000 35%, transparent 78%);',
        'mask-image: radial-gradient(ellipse at 50% 40%, #000 35%, transparent 78%);',
      ]),
    ],
  }),
  /*
    Magic UI retro-grid (MIT): upstream now draws with WebGL and keeps a CSS
    fallback — a grid plane tipped back by perspective + rotateX that scrolls
    toward the viewer. That fallback is what is ported, as one pseudo-element.
  */
  'retro-grid': () => ({
    base: [
      rule(FX('retro-grid'), [...HOST, 'overflow: hidden;']),
      rule(`${FX('retro-grid')}::before`, [
        "content: '';",
        'position: absolute;',
        'z-index: -1;',
        'inset-inline: -50%;',
        'inset-block-start: 35%;',
        'block-size: 200%;',
        'pointer-events: none;',
        `background-image: linear-gradient(to right, var(--ck-fx-line, color-mix(in oklab, ${INK} 18%, transparent)) 1px, transparent 0), linear-gradient(to bottom, var(--ck-fx-line, color-mix(in oklab, ${INK} 18%, transparent)) 1px, transparent 0);`,
        'background-size: var(--ck-fx-cell, 60px) var(--ck-fx-cell, 60px);',
        'transform: perspective(200px) rotateX(65deg);',
        'transform-origin: 50% 0;',
        '-webkit-mask-image: linear-gradient(to bottom, #000, transparent 70%);',
        'mask-image: linear-gradient(to bottom, #000, transparent 70%);',
      ]),
    ],
    keyframes: [
      block('@keyframes ck-fx-retro-grid', [
        rule('to', ['background-position: 0 var(--ck-fx-cell, 60px);']),
      ]),
    ],
    motion: [
      rule(`${FX('retro-grid')}::before`, ['animation: ck-fx-retro-grid 15s linear infinite;']),
      rule(`${FX('retro-grid')}:is(:hover, :focus-within)::before`, [
        'animation-play-state: paused;',
      ]),
    ],
  }),
  /* The runtime writes --ck-spot-x/y from a fine pointer; otherwise the light rests top-centre. */
  spotlight: () => ({
    base: [
      rule(FX('spotlight'), HOST),
      rule(`${FX('spotlight')}::after`, [
        ...OVERLAY,
        `background-image: radial-gradient(var(--ck-fx-spot-size, 420px) circle at var(--ck-spot-x, 50%) var(--ck-spot-y, 0%), color-mix(in oklab, ${C1} 18%, transparent), transparent 70%);`,
      ]),
    ],
  }),
  /* The ShineBorder ring (vendor/VENDOR.md, Magic UI): a gradient on the border only. */
  'gradient-border': () => ({
    base: [
      rule(FX('gradient-border'), ['position: relative;']),
      rule(`${FX('gradient-border')}::after`, [
        ...OVERLAY,
        'padding: var(--ck-fx-border, 1.5px);',
        `background-image: linear-gradient(135deg, ${C1}, ${C2});`,
        ...RING_MASK,
      ]),
    ],
  }),
  /*
    Our own aurora (no Aceternity code): banded token colours, blurred and
    masked into a corner, drifting under no-preference.
  */
  'aurora-bg': () => ({
    base: [
      rule(FX('aurora-bg'), [...HOST, 'overflow: hidden;']),
      rule(`${FX('aurora-bg')}::before`, [
        ...UNDERLAY,
        'inset: -10%;',
        `background-image: repeating-linear-gradient(100deg, ${C1} 10%, ${C2} 16%, var(--ck-fx-c3, color-mix(in oklab, ${C1} 50%, ${SURFACE})) 22%, ${C1} 28%);`,
        'background-size: 300% 200%;',
        'background-position: 50% 50%;',
        'filter: blur(48px) saturate(1.2);',
        'opacity: var(--ck-fx-aurora, 0.45);',
        '-webkit-mask-image: radial-gradient(ellipse at 80% 0%, #000 10%, transparent 70%);',
        'mask-image: radial-gradient(ellipse at 80% 0%, #000 10%, transparent 70%);',
      ]),
    ],
    keyframes: [
      block('@keyframes ck-fx-aurora-bg', [
        rule('from', ['background-position: 50% 50%;']),
        rule('to', ['background-position: 350% 50%;']),
      ]),
    ],
    motion: [
      rule(`${FX('aurora-bg')}::before`, ['animation: ck-fx-aurora-bg 30s linear infinite;']),
      rule(`${FX('aurora-bg')}:is(:hover, :focus-within)::before`, [
        'animation-play-state: paused;',
      ]),
    ],
  }),
  /* The gradient runs from the inline start: 90deg in LTR, 270deg in RTL. */
  'text-gradient': () => ({
    base: [
      rule(FX('text-gradient'), [
        '--ck-fx-angle: 90deg;',
        `background-image: linear-gradient(var(--ck-fx-angle), ${C1}, ${C2});`,
        '-webkit-background-clip: text;',
        'background-clip: text;',
        'color: transparent;',
        '-webkit-text-fill-color: transparent;',
      ]),
      rule(`:where([dir='rtl'] ${FX('text-gradient')}, ${FX('text-gradient')}[dir='rtl'])`, [
        '--ck-fx-angle: 270deg;',
      ]),
      rule(`:where(${FX('text-gradient')}:dir(ltr))`, ['--ck-fx-angle: 90deg;']),
      rule(`:where(${FX('text-gradient')}:dir(rtl))`, ['--ck-fx-angle: 270deg;']),
    ],
  }),
  'ring-glow': () => ({
    base: [
      rule(FX('ring-glow'), [
        `box-shadow: 0 0 0 1px color-mix(in oklab, ${C1} 35%, transparent), 0 0 0 4px color-mix(in oklab, ${C1} 12%, transparent), 0 8px 32px -6px color-mix(in oklab, ${C1} 45%, transparent);`,
      ]),
    ],
  }),
};

const HEADER = `/*
  GENERATED by packages/builder/renderer/src/motion/effects-css.ts — do not edit.
  Effect hook classes ck-fx-* (style-manager DESIGN.md §C). Tokens only; motion
  only under prefers-reduced-motion: no-preference.
*/`;

/**
 * The effects stylesheet; with `only`, just those effect names (the static
 * export passes the ones a site uses). Names outside the vocabulary are ignored.
 */
export function buildEffectsCss(only?: Iterable<string>): string {
  const wanted = only === undefined ? undefined : new Set(only);
  const names = CUSTOM_CODE_EFFECTS.filter((name) => wanted === undefined || wanted.has(name));
  if (names.length === 0) return '';
  const parts = names.map((name) => EFFECTS[name]());
  const layered = [
    ...parts.flatMap((part) => part.base),
    ...parts.flatMap((part) => part.keyframes ?? []),
    ...parts.flatMap((part) => part.extra ?? []),
    block(
      NO_PREFERENCE,
      parts.flatMap((part) => part.motion ?? []),
    ),
  ];
  return [
    HEADER,
    '@layer properties, theme, base, components, utilities;',
    block('@layer components', layered),
  ]
    .join('\n\n')
    .concat('\n');
}

/** The CSS one effect contributes (tests, panel previews). */
export function effectCss(name: CustomCodeEffect): string {
  const part = EFFECTS[name]();
  return [
    ...part.base,
    ...(part.keyframes ?? []),
    ...(part.extra ?? []),
    ...(part.motion ?? []),
  ].join('\n');
}
