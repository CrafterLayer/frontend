import { contrastRatio } from '@craftkit/builder-schema';

/**
 * Slabs: the dark grounds a marketing block paints, kept dark in a dark theme.
 *
 * ## The defect this exists for
 *
 * A slab is `bg-surface-inverse text-text-inverse`: a `tone: 'dark'` section,
 * the bento lead card, a contrast stat card, the split newsletter's copy
 * panel, the inverse announcement bar. The dark page theme points
 * `surfaceInverse` at a near-WHITE (it is the inverse of a dark page), so in
 * dark mode every one of those turned into a bright slab inside a dark page
 * (templates audit, 2026-10-08). And the accent drawn on a slab — stat values,
 * eyebrows, secondary actions — measured 2.82:1 in the light theme.
 *
 * ## Why the fix is a derived colour and not a new token
 *
 * The page carries no "this is the dark scheme" signal a stylesheet could
 * branch on: a dark page is a different token TABLE, nothing more. So the slab
 * derives its ground from the inverse surface with CSS relative colour and
 * CLAMPS the lightness — a ground that is already dark is left exactly as the
 * design system set it, and one that is light is pulled down to a dark slab.
 * The ink and the accent are clamped the other way. Every value still flows
 * from the site's own tokens; nothing here is a colour of its own.
 *
 * ## Why the rules name `bg-surface-inverse` as well as `mkt-slab`
 *
 * The derived ground applies only while the element still carries the inverse
 * utility. A caller who repaints the block (`className: 'bg-accent'`, a part
 * style) has that utility merged away, and the slab rule stops matching —
 * so a person's explicit choice still wins, exactly as it did before.
 *
 * The numbers live here, once: `slabCss()` writes the stylesheet block from
 * them (section-tone.test.ts holds `section-layout.css` to it verbatim), and
 * `slabColours()` computes the same colours in TypeScript so a unit test can
 * measure contrast over the light and dark token tables.
 */

/** The marker class every slab element carries beside its inverse utilities. */
export const SLAB_CLASS = 'mkt-slab';

/** The inverse pair plus the marker, for a block's own slab elements. */
export const SLAB_CLASSES = `bg-surface-inverse text-text-inverse ${SLAB_CLASS}`;

export const SLAB_LIMITS = Object.freeze({
  /** OKLCH lightness ceiling of the slab ground. */
  groundMaxL: 0.27,
  /** OKLCH lightness floor of the slab ink, and its chroma ceiling. */
  inkMinL: 0.97,
  inkMaxC: 0.02,
  /** The accent drawn ON a slab: lightened, and calmed so it stays in gamut. */
  accentMinL: 0.8,
  accentMaxC: 0.12,
  /** Muted text on a slab: this percentage of the ink over the ground. */
  mutedInk: 74,
});

/**
 * The stylesheet block, generated from `SLAB_LIMITS`.
 *
 * The `@supports` probe uses an OKLCH literal as its origin because a feature
 * query has to name SOME colour; it paints nothing. Browsers without relative
 * colour keep the plain inverse utilities.
 */
export function slabCss(): string {
  const s = SLAB_LIMITS;
  const slab = `.${SLAB_CLASS}.bg-surface-inverse`;
  return [
    '@supports (color: oklch(from oklch(0.5 0 0) calc(l - 0.1) c h)) {',
    `  .${SLAB_CLASS} {`,
    `    --mkt-slab-ground: oklch(from var(--t-surface-inverse) min(l, ${String(s.groundMaxL)}) c h);`,
    `    --mkt-slab-ink: oklch(from var(--t-text-inverse) max(l, ${String(s.inkMinL)}) min(c, ${String(s.inkMaxC)}) h);`,
    `    --mkt-slab-accent: oklch(from var(--t-accent) max(l, ${String(s.accentMinL)}) min(c, ${String(s.accentMaxC)}) h);`,
    `    --mkt-slab-muted: color-mix(in oklab, var(--mkt-slab-ink) ${String(s.mutedInk)}%, var(--mkt-slab-ground));`,
    '  }',
    `  ${slab} {`,
    '    background-color: var(--mkt-slab-ground);',
    '    --ck-cta-ink: var(--mkt-slab-accent);',
    '  }',
    `  .${SLAB_CLASS}.border-surface-inverse {`,
    '    border-color: var(--mkt-slab-ground);',
    '  }',
    `  ${slab}.text-text-inverse,`,
    `  ${slab} :is(.text-text, .text-text-inverse) {`,
    '    color: var(--mkt-slab-ink);',
    '  }',
    `  ${slab} .text-text-muted {`,
    '    color: var(--mkt-slab-muted);',
    '  }',
    `  ${slab} .text-accent {`,
    '    color: var(--mkt-slab-accent);',
    '  }',
    `  ${slab} :is(.bg-surface, .bg-accent) {`,
    '    --ck-cta-ink: initial;',
    '  }',
    // A light card that carries its own ink (`bg-surface text-text` on one element) keeps it too.
    `  ${slab} :is(.bg-surface, .bg-accent) :is(.text-text, .text-text-inverse, .text-text-muted, .text-accent),`,
    `  ${slab} :is(.bg-surface, .bg-accent):is(.text-text, .text-text-inverse, .text-text-muted, .text-accent) {`,
    '    color: revert-layer;',
    '  }',
    '}',
  ].join('\n');
}

// ── The same colours, in TypeScript ──────────────────────────────────────────

interface Oklch {
  readonly l: number;
  readonly c: number;
  readonly h: number;
}

interface Oklab {
  readonly l: number;
  readonly a: number;
  readonly b: number;
}

function channels(hex: string): readonly [number, number, number] {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/iu.exec(hex.trim());
  if (match === null) throw new Error(`Not a #rrggbb colour: ${hex}`);
  return [match[1], match[2], match[3]].map((part) => Number.parseInt(part ?? '0', 16) / 255) as [
    number,
    number,
    number,
  ];
}

const toLinear = (value: number) =>
  value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const toGamma = (value: number) =>
  value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;

/** sRGB hex → OKLab (Björn Ottosson's matrices, the ones CSS Color 4 specifies). */
export function hexToOklab(hex: string): Oklab {
  const [r, g, b] = channels(hex).map(toLinear) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

/** OKLab → sRGB hex, each channel clamped into gamut. */
export function oklabToHex({ l, a, b }: Oklab): string {
  const l1 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m1 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s1 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l1 - 3.3077115913 * m1 + 0.2309699292 * s1,
    -1.2684380046 * l1 + 2.6097574011 * m1 - 0.3413193965 * s1,
    -0.0041960863 * l1 - 0.7034186147 * m1 + 1.707614701 * s1,
  ];
  return `#${linear
    .map((value) =>
      Math.round(Math.min(1, Math.max(0, toGamma(Math.min(1, Math.max(0, value))))) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

export function hexToOklch(hex: string): Oklch {
  const { l, a, b } = hexToOklab(hex);
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return { l, c: Math.hypot(a, b), h: h < 0 ? h + 360 : h };
}

export function oklchToHex({ l, c, h }: Oklch): string {
  const radians = (h * Math.PI) / 180;
  return oklabToHex({ l, a: c * Math.cos(radians), b: c * Math.sin(radians) });
}

/** `weight` (0–1) of `a` over `b`, interpolated in OKLab — `color-mix(in oklab, …)`. */
export function mixOklab(a: string, b: string, weight: number): string {
  const one = hexToOklab(a);
  const two = hexToOklab(b);
  return oklabToHex({
    l: one.l * weight + two.l * (1 - weight),
    a: one.a * weight + two.a * (1 - weight),
    b: one.b * weight + two.b * (1 - weight),
  });
}

/** The roles a slab reads. A `Theme` satisfies this; so does any design system's tokens. */
export interface SlabTokens {
  readonly surfaceInverse: string;
  readonly textInverse: string;
  readonly accent: string;
}

export interface SlabColours {
  readonly ground: string;
  readonly ink: string;
  readonly muted: string;
  readonly accent: string;
}

/** What `slabCss()` resolves to for one token table, as hex. */
export function slabColours(tokens: SlabTokens): SlabColours {
  const s = SLAB_LIMITS;
  const groundOrigin = hexToOklch(tokens.surfaceInverse);
  const inkOrigin = hexToOklch(tokens.textInverse);
  const accentOrigin = hexToOklch(tokens.accent);
  const ground = oklchToHex({ ...groundOrigin, l: Math.min(groundOrigin.l, s.groundMaxL) });
  const ink = oklchToHex({
    l: Math.max(inkOrigin.l, s.inkMinL),
    c: Math.min(inkOrigin.c, s.inkMaxC),
    h: inkOrigin.h,
  });
  return {
    ground,
    ink,
    muted: mixOklab(ink, ground, s.mutedInk / 100),
    accent: oklchToHex({
      l: Math.max(accentOrigin.l, s.accentMinL),
      c: Math.min(accentOrigin.c, s.accentMaxC),
      h: accentOrigin.h,
    }),
  };
}

/** WCAG contrast of two hex colours (0 when either is unreadable). */
export function contrastOf(foreground: string, background: string): number {
  return contrastRatio(foreground, background) ?? 0;
}
