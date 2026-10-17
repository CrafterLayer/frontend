/**
 * The motion presets, rendered as CSS (style-manager DESIGN.md §B.1–B.3, D7).
 *
 * A custom-code element NAMES its animation with attributes — `data-ck-motion`
 * (entrance, stagger, scroll, loop and text presets) and `data-ck-hover` — and
 * this module is what those names mean. Nothing here is an engine: entrances
 * and scroll effects run on `animation-timeline: view()` / `scroll()`, loops
 * and hovers are keyframes and transitions, and the serialised behaviours
 * runtime (`../behaviors/runtime.ts`) only adds what CSS cannot know — the
 * child index (`--ck-i`), "has been seen" (`data-ck-inview`) on browsers
 * without view timelines, split text and pointer variables. A published page
 * therefore ships no animation library.
 *
 * ## The rules every preset keeps
 *
 * - **Reduced motion first.** Every start or hidden state, every keyframe use
 *   and every transition sits inside
 *   `@media (prefers-reduced-motion: no-preference)`. Outside it there is only
 *   layout and static paint, so the default — and the reduced-motion page — is
 *   the FINAL state.
 * - **RTL.** Inline-axis movement is multiplied by `--ck-inline-sign` (1, or
 *   -1 under `:dir(rtl)` with a `[dir='rtl']` fallback). `fade-start` comes
 *   from the inline start: the left in English, the right in Arabic.
 * - **Tokens.** Distances come from `--t-motion-distance`, durations from
 *   `--ck-dur-*` and curves from `--ck-ease-*`, each with a fallback. Spring and
 *   bounce are CSS `linear()` curves sampled at build time from the closed-form
 *   functions below (no curve is copied from anywhere).
 * - **The canvas shows final states.** The editing canvas marks its region
 *   `data-ck-still`; every automatic rule carries `:not([data-ck-still] *)`, so
 *   nothing plays there until the panel's Preview sets `data-ck-play`.
 * - **Loops longer than 5 s pause** on `:hover` and `:focus-within`.
 *
 * ## Params (all closed enums, validated by the door)
 *
 * `data-ck-trigger` (absent ⇒ view), `data-ck-delay` 0–6 (80 ms steps, or a 5 %
 * shift of the view range), `data-ck-speed`, `data-ck-ease`, `data-ck-distance`,
 * `data-ck-stagger`, `data-ck-once`, `data-ck-target`.
 *
 * ## Layering
 *
 * Everything sits in `@layer components`, after the same layer-order statement
 * Tailwind emits, so an element's own utility classes (`@layer utilities`) and
 * the region's `css` (unlayered) always win over a preset's static styles. A
 * running animation still overrides both, which is what lets a keyframe's
 * start state show through.
 */
import {
  CUSTOM_CODE_ENTRANCE_PRESETS,
  CUSTOM_CODE_HOVER_PRESETS,
  CUSTOM_CODE_MOTION_DELAYS,
  CUSTOM_CODE_MOTION_PRESETS,
  CUSTOM_CODE_STAGGER_PRESETS,
  type CUSTOM_CODE_LOOP_PRESETS,
  type CUSTOM_CODE_SCROLL_PRESETS,
  type CUSTOM_CODE_TEXT_PRESETS,
  type CustomCodeHoverPreset,
  type CustomCodeMotionPreset,
} from '@craftkit/builder-schema';

/* ── CSS text helpers (Prettier's CSS shape: one declaration per line) ────── */

function indent(text: string, by = '  '): string {
  return text
    .split('\n')
    .map((line) => (line === '' ? line : `${by}${line}`))
    .join('\n');
}

function rule(selectors: string | readonly string[], declarations: readonly string[]): string {
  const list = typeof selectors === 'string' ? [selectors] : selectors;
  return [`${list.join(',\n')} {`, ...declarations.map((line) => `  ${line}`), '}'].join('\n');
}

function block(prelude: string, body: readonly string[]): string {
  const inner = body.filter((part) => part !== '');
  if (inner.length === 0) return '';
  return [`${prelude} {`, indent(inner.join('\n')), '}'].join('\n');
}

function keyframes(name: string, frames: Readonly<Record<string, readonly string[]>>): string {
  return block(
    `@keyframes ${name}`,
    Object.entries(frames).map(([at, declarations]) => rule(at, declarations)),
  );
}

/* ── shared selectors ─────────────────────────────────────────────────────── */

export const NO_PREFERENCE = '@media (prefers-reduced-motion: no-preference)';
const HAS_VIEW = '@supports (animation-timeline: view())';
const NO_VIEW = '@supports not (animation-timeline: view())';

/** Every automatic rule carries this: the editing canvas (`data-ck-still`) shows final states. */
const LIVE = ':not([data-ck-still] *)';
/** No `data-ck-trigger`, or `view`: the default trigger. */
const ON_VIEW = ":is(:not([data-ck-trigger]), [data-ck-trigger='view'])";
const ON_LOAD = "[data-ck-trigger='load']";

const M = (name: string): string => `[data-ck-motion='${name}']`;
const H = (name: string): string => `[data-ck-hover='${name}']`;

/** `--ck-inline-sign`: 1 for left-to-right, -1 for right-to-left. */
const SIGN = 'var(--ck-inline-sign, 1)';
const C1 = 'var(--ck-fx-c1, var(--t-accent, #4f46e5))';
const C2 = 'var(--ck-fx-c2, var(--t-success, #16a34a))';

/* ── easing curves: linear() sampled from closed-form functions ───────────── */

function sampled(fn: (t: number) => number, steps: number): string {
  const points: string[] = [];
  for (let at = 0; at <= steps; at += 1) {
    const value = fn(at / steps);
    points.push(String(Math.round(value * 1000) / 1000));
  }
  return `linear(${points.join(', ')})`;
}

/** A damped spring settling at 1 (ζ ≈ 0.45): overshoots once, rings out. */
function spring(t: number): number {
  if (t >= 1) return 1;
  const omega = 14;
  const zeta = 0.45;
  const damped = omega * Math.sqrt(1 - zeta * zeta);
  return (
    1 -
    Math.exp(-zeta * omega * t) *
      (Math.cos(damped * t) + ((zeta * omega) / damped) * Math.sin(damped * t))
  );
}

/** Bounce-out: four parabolic arcs of falling height, written from the definition (no code copied). */
function bounce(t: number): number {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) {
    const u = t - 1.5 / d;
    return n * u * u + 0.75;
  }
  if (t < 2.5 / d) {
    const u = t - 2.25 / d;
    return n * u * u + 0.9375;
  }
  const u = t - 2.625 / d;
  return n * u * u + 0.984375;
}

/** The fallback curve, then the `linear()` one where the browser has it. */
const EASES: Readonly<Record<string, { readonly fallback: string; readonly linear?: string }>> = {
  standard: { fallback: 'var(--ck-ease-standard, cubic-bezier(0.2, 0, 0, 1))' },
  emphasized: { fallback: 'var(--ck-ease-emphasized, cubic-bezier(0.16, 1, 0.3, 1))' },
  spring: {
    fallback: 'var(--ck-ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1))',
    linear: `var(--ck-ease-spring, ${sampled(spring, 40)})`,
  },
  bounce: {
    fallback: 'var(--ck-ease-bounce, cubic-bezier(0.68, -0.55, 0.27, 1.55))',
    linear: `var(--ck-ease-bounce, ${sampled(bounce, 48)})`,
  },
  linear: { fallback: 'linear' },
};

/* ── params: speed, delay, ease, distance, stagger, direction ─────────────── */

const ANIMATED = ':where([data-ck-motion], [data-ck-hover])';

function paramsCss(): string {
  const base = rule(ANIMATED, [
    '--ck-dur: var(--ck-dur-normal, 700ms);',
    '--ck-hover-dur: 280ms;',
    '--ck-loop-k: 1;',
    '--ck-delay: 0ms;',
    '--ck-shift: 0%;',
    '--ck-range-to: 30%;',
    `--ck-ease: ${EASES['standard']?.fallback ?? 'ease'};`,
    '--ck-dist-k: 1;',
    '--ck-dist: var(--t-motion-distance, 24px);',
    '--ck-stagger-step: 90ms;',
    '--ck-stagger-pct: 5%;',
    '--ck-inline-sign: 1;',
  ]);
  const speeds = [
    rule(`${ANIMATED}[data-ck-speed='fast']`, [
      '--ck-dur: var(--ck-dur-fast, 400ms);',
      '--ck-hover-dur: 180ms;',
      '--ck-loop-k: 0.6;',
      '--ck-range-to: 20%;',
    ]),
    rule(`${ANIMATED}[data-ck-speed='slow']`, [
      '--ck-dur: var(--ck-dur-slow, 1100ms);',
      '--ck-hover-dur: 450ms;',
      '--ck-loop-k: 1.6;',
      '--ck-range-to: 45%;',
    ]),
  ];
  const delays = CUSTOM_CODE_MOTION_DELAYS.filter((step) => step !== '0').map((step) =>
    rule(`${ANIMATED}[data-ck-delay='${step}']`, [
      `--ck-delay: ${String(Number(step) * 80)}ms;`,
      `--ck-shift: ${String(Number(step) * 5)}%;`,
    ]),
  );
  const eases = Object.entries(EASES).map(([name, curve]) =>
    rule(`${ANIMATED}[data-ck-ease='${name}']`, [`--ck-ease: ${curve.fallback};`]),
  );
  const linearEases = Object.entries(EASES)
    .filter(([, curve]) => curve.linear !== undefined)
    .map(([name, curve]) =>
      rule(`${ANIMATED}[data-ck-ease='${name}']`, [`--ck-ease: ${curve.linear ?? ''};`]),
    );
  const distances = [
    rule(`${ANIMATED}[data-ck-distance='sm']`, [
      '--ck-dist-k: 0.5;',
      '--ck-dist: calc(var(--t-motion-distance, 24px) * 0.5);',
    ]),
    rule(`${ANIMATED}[data-ck-distance='lg']`, [
      '--ck-dist-k: 2;',
      '--ck-dist: calc(var(--t-motion-distance, 24px) * 2);',
    ]),
  ];
  const staggers = [
    rule(`${ANIMATED}[data-ck-stagger='sm']`, [
      '--ck-stagger-step: 50ms;',
      '--ck-stagger-pct: 3%;',
    ]),
    rule(`${ANIMATED}[data-ck-stagger='lg']`, [
      '--ck-stagger-step: 150ms;',
      '--ck-stagger-pct: 8%;',
    ]),
  ];
  /*
    Direction. `[dir='rtl']` first, for engines without :dir(); then :dir(),
    which sees the computed direction (a nested dir="ltr" inside an Arabic
    page is honoured). Inside :where() an unsupported :dir() drops silently
    instead of killing the rule, and every rule has zero specificity, so the
    last matching one wins.
  */
  const direction = [
    rule(
      ":where([dir='rtl'] [data-ck-motion], [dir='rtl'] [data-ck-hover], [data-ck-motion][dir='rtl'], [data-ck-hover][dir='rtl'])",
      ['--ck-inline-sign: -1;'],
    ),
    rule(':where([data-ck-motion]:dir(ltr), [data-ck-hover]:dir(ltr))', ['--ck-inline-sign: 1;']),
    rule(':where([data-ck-motion]:dir(rtl), [data-ck-hover]:dir(rtl))', ['--ck-inline-sign: -1;']),
  ];
  return [
    base,
    ...speeds,
    ...delays,
    ...eases,
    block('@supports (animation-timing-function: linear(0, 1))', linearEases),
    ...distances,
    ...staggers,
    ...direction,
  ].join('\n');
}

/* ── one preset's output ──────────────────────────────────────────────────── */

interface PresetCss {
  /** Layout and static paint: applies under reduced motion too. */
  readonly base?: readonly string[];
  readonly keyframes?: readonly string[];
  /** Inside `prefers-reduced-motion: no-preference`. */
  readonly motion?: readonly string[];
  /** Inside no-preference AND `@supports (animation-timeline: view())`. */
  readonly timeline?: readonly string[];
  /** Inside no-preference AND `@supports not (animation-timeline: view())`. */
  readonly fallback?: readonly string[];
}

function withSuffixes(selector: string, suffixes: readonly string[]): string[] {
  return suffixes.map((suffix) => `${selector}${suffix}`);
}

interface PlayOptions {
  readonly kf: string;
  /** Appended to the host selector: '' animates the host, ' > *' its children. */
  readonly targets?: readonly string[];
  /** The delay expression (children add their index). */
  readonly delay?: string;
  /** View-timeline range for the scrubbed path. */
  readonly range?: string;
  /** Children read the host's named timeline (`--ck-tl`) instead of their own view(). */
  readonly sharedTimeline?: boolean;
  /** Only once the runtime has mounted the host (it creates the targets or their attributes). */
  readonly needsMount?: boolean;
  /** Whether the view trigger uses a view() timeline where supported (false = always time-based). */
  readonly scrubbed?: boolean;
  readonly duration?: string;
}

const RANGE_DEFAULT =
  'entry var(--ck-shift, 0%) cover calc(var(--ck-range-to, 30%) + var(--ck-shift, 0%))';

/**
 * The trigger plumbing every "play once" preset shares:
 * - view, timeline browsers: scrubbed by `view()` until the runtime marks it
 *   `data-ck-done` (once) — then the animation is dropped and the element rests
 *   at its final state;
 * - view, other browsers (or `scrubbed: false`): paused on its first frame
 *   until the runtime's IntersectionObserver sets `data-ck-inview`;
 * - load: plays on a clock as the page loads, script or not;
 * - click / hover / canvas Preview: plays while `data-ck-play` is set.
 */
function playRules(name: string, options: PlayOptions): PresetCss {
  const host = M(name);
  const targets = options.targets ?? [''];
  const delay = options.delay ?? 'var(--ck-delay, 0ms)';
  const duration = options.duration ?? 'var(--ck-dur, 700ms)';
  const mounted = options.needsMount === true ? '[data-ck-mounted]' : '';
  const clock = `${options.kf} ${duration} var(--ck-ease) ${delay} both`;
  const scrubbed = options.scrubbed !== false;

  const armed = rule(
    withSuffixes(`${host}[data-ck-mounted]${ON_VIEW}:not([data-ck-play])${LIVE}`, targets),
    [`animation: ${clock};`, 'animation-play-state: paused;'],
  );
  const seen = rule(
    withSuffixes(`${host}[data-ck-inview]${ON_VIEW}:not([data-ck-play])${LIVE}`, targets),
    ['animation-play-state: running;'],
  );
  const onLoad = rule(
    withSuffixes(`${host}${mounted}${ON_LOAD}:not([data-ck-play])${LIVE}`, targets),
    [`animation: ${clock};`],
  );
  const played = rule(withSuffixes(`${host}${mounted}[data-ck-play]`, targets), [
    `animation: ${clock};`,
  ]);
  const rearm = rule(withSuffixes(`${host}[data-ck-rearm]`, targets), ['animation-name: none;']);

  if (!scrubbed) {
    return { motion: [armed, seen, onLoad, played, rearm] };
  }
  const timelineHost =
    options.sharedTimeline === true
      ? [rule(`${host}${LIVE}`, ['view-timeline-name: --ck-tl;'])]
      : [];
  const scrub = rule(
    withSuffixes(`${host}${mounted}${ON_VIEW}:not([data-ck-done], [data-ck-play])${LIVE}`, targets),
    [
      `animation-name: ${options.kf};`,
      'animation-duration: auto;',
      'animation-timing-function: var(--ck-ease);',
      'animation-fill-mode: both;',
      `animation-timeline: ${options.sharedTimeline === true ? '--ck-tl' : 'view()'};`,
      `animation-range: ${options.range ?? RANGE_DEFAULT};`,
    ],
  );
  return {
    motion: [onLoad, played, rearm],
    timeline: [...timelineHost, scrub],
    fallback: [armed, seen],
  };
}

interface LoopOptions {
  readonly kf: string;
  readonly seconds: number;
  readonly timing?: string;
  readonly direction?: string;
  readonly targets?: readonly string[];
  /** Declarations the host needs only while it animates (overflow, position). */
  readonly host?: readonly string[];
  /** Per-target declarations needed only while animating. */
  readonly extra?: readonly string[];
}

/**
 * Loops: run on load (or when seen, or while hovered). A loop longer than 5 s
 * pauses while the pointer or focus is inside it — WCAG 2.2.2 asks that moving
 * content can be paused, and this is the pause that needs no button.
 */
function loopRules(name: string, options: LoopOptions): PresetCss {
  const host = M(name);
  const targets = options.targets ?? [''];
  const duration = `calc(${String(options.seconds)}s * var(--ck-loop-k, 1))`;
  const animation = [
    `animation: ${options.kf} ${duration} ${options.timing ?? 'linear'} var(--ck-delay, 0ms) infinite ${options.direction ?? 'normal'};`,
    ...(options.extra ?? []),
  ];
  const running = [`${host}${LIVE}`, `${host}[data-ck-play]`];
  const motion: string[] = [];
  if (options.host !== undefined) motion.push(rule(running, options.host));
  motion.push(
    rule(
      running.flatMap((selector) => withSuffixes(selector, targets)),
      animation,
    ),
    rule(
      withSuffixes(
        `${host}[data-ck-mounted]${ON_VIEW}:not([data-ck-inview], [data-ck-play])${LIVE}`,
        targets,
      ),
      ['animation-play-state: paused;'],
    ),
    rule(
      withSuffixes(
        `${host}[data-ck-trigger='hover']:not(:hover, :focus-within, [data-ck-play])${LIVE}`,
        targets,
      ),
      ['animation-play-state: paused;'],
    ),
    rule(withSuffixes(`${host}[data-ck-trigger='click']:not([data-ck-play])${LIVE}`, targets), [
      'animation-play-state: paused;',
    ]),
  );
  if (options.seconds > 5) {
    motion.push(
      rule(
        withSuffixes(
          `${host}:not([data-ck-trigger='hover']):is(:hover, :focus-within)${LIVE}`,
          targets,
        ),
        ['animation-play-state: paused;'],
      ),
    );
  }
  return { motion };
}

/* ── entrance presets ─────────────────────────────────────────────────────── */

const ENTRANCE_FROM: Readonly<
  Record<(typeof CUSTOM_CODE_ENTRANCE_PRESETS)[number], Readonly<Record<string, readonly string[]>>>
> = {
  fade: { from: ['opacity: 0;'] },
  'fade-up': { from: ['opacity: 0;', 'transform: translateY(var(--ck-dist));'] },
  'fade-down': { from: ['opacity: 0;', 'transform: translateY(calc(var(--ck-dist) * -1));'] },
  'fade-start': {
    from: ['opacity: 0;', `transform: translateX(calc(var(--ck-dist) * -1 * ${SIGN}));`],
  },
  'fade-end': { from: ['opacity: 0;', `transform: translateX(calc(var(--ck-dist) * ${SIGN}));`] },
  'zoom-in': { from: ['opacity: 0;', 'transform: scale(0.92);'] },
  'zoom-out': { from: ['opacity: 0;', 'transform: scale(1.08);'] },
  /* Magic UI blur-fade (MIT): blur + a quarter-distance rise; see vendor/VENDOR.md. */
  'blur-in': {
    from: [
      'opacity: 0;',
      'filter: blur(6px);',
      'transform: translateY(calc(var(--ck-dist) * 0.25));',
    ],
  },
  'flip-up': {
    from: [
      'opacity: 0;',
      'transform: perspective(900px) rotateX(28deg) translateY(calc(var(--ck-dist) * 0.5));',
    ],
  },
  'clip-up': { from: ['clip-path: inset(100% 0 0 0);'], to: ['clip-path: inset(0 0 0 0);'] },
  /* The wipe starts at the inline start: the right inset in LTR, the left inset in RTL. */
  'clip-start': {
    from: [`clip-path: inset(0 calc(50% + 50% * ${SIGN}) 0 calc(50% - 50% * ${SIGN}));`],
    to: ['clip-path: inset(0 0 0 0);'],
  },
  'rise-mask': {
    from: ['clip-path: inset(-0.2em -0.2em 100% -0.2em);', 'transform: translateY(0.75em);'],
    to: ['clip-path: inset(-0.2em -0.2em -0.2em -0.2em);', 'transform: none;'],
  },
  'tilt-in': {
    from: [
      'opacity: 0;',
      `transform: perspective(900px) rotateY(calc(-18deg * ${SIGN})) translateX(calc(var(--ck-dist) * -0.5 * ${SIGN}));`,
    ],
  },
};

function entrance(name: (typeof CUSTOM_CODE_ENTRANCE_PRESETS)[number]): PresetCss {
  const kf = `ck-m-${name}`;
  return { keyframes: [keyframes(kf, ENTRANCE_FROM[name])], ...playRules(name, { kf }) };
}

/* ── stagger presets: the container plays, children carry --ck-i ──────────── */

const STAGGER_FROM: Readonly<
  Record<(typeof CUSTOM_CODE_STAGGER_PRESETS)[number], readonly string[]>
> = {
  'stagger-up': ['opacity: 0;', 'transform: translateY(var(--ck-dist));'],
  'stagger-fade': ['opacity: 0;'],
  'stagger-zoom': ['opacity: 0;', 'transform: scale(0.9);'],
  'stagger-grid': ['opacity: 0;', 'transform: translateY(calc(var(--ck-dist) * 0.6)) scale(0.96);'],
};

function stagger(name: (typeof CUSTOM_CODE_STAGGER_PRESETS)[number]): PresetCss {
  const kf = `ck-m-${name}`;
  const step = 'var(--ck-i, 0) * var(--ck-stagger-pct, 5%)';
  return {
    keyframes: [keyframes(kf, { from: STAGGER_FROM[name] })],
    ...playRules(name, {
      kf,
      targets: [' > *'],
      sharedTimeline: true,
      delay: 'calc(var(--ck-delay, 0ms) + var(--ck-i, 0) * var(--ck-stagger-step, 90ms))',
      range: `entry calc(var(--ck-shift, 0%) + ${step}) cover calc(var(--ck-range-to, 30%) + var(--ck-shift, 0%) + ${step})`,
    }),
  };
}

/* ── scroll-linked presets ────────────────────────────────────────────────── */

function scrubbed(name: string, kf: string, range: string, extra: readonly string[] = []): string {
  return rule(`${M(name)}${LIVE}`, [
    `animation-name: ${kf};`,
    'animation-duration: auto;',
    'animation-timing-function: linear;',
    'animation-fill-mode: both;',
    'animation-timeline: view();',
    `animation-range: ${range};`,
    ...extra,
  ]);
}

const PARALLAX = 'calc(var(--t-motion-parallax, 40px) * var(--ck-dist-k, 1))';

const SCROLL: Readonly<Record<(typeof CUSTOM_CODE_SCROLL_PRESETS)[number], () => PresetCss>> = {
  'parallax-slow': () => ({
    keyframes: [
      keyframes('ck-m-parallax-slow', {
        from: [`transform: translateY(calc(${PARALLAX} * -1));`],
        to: [`transform: translateY(${PARALLAX});`],
      }),
    ],
    timeline: [scrubbed('parallax-slow', 'ck-m-parallax-slow', 'cover 0% cover 100%')],
  }),
  'parallax-fast': () => ({
    keyframes: [
      keyframes('ck-m-parallax-fast', {
        from: [`transform: translateY(calc(${PARALLAX} * -2));`],
        to: [`transform: translateY(calc(${PARALLAX} * 2));`],
      }),
    ],
    timeline: [scrubbed('parallax-fast', 'ck-m-parallax-fast', 'cover 0% cover 100%')],
  }),
  'scale-on-scroll': () => ({
    keyframes: [
      keyframes('ck-m-scale-on-scroll', { from: ['transform: scale(0.86);', 'opacity: 0.6;'] }),
    ],
    timeline: [scrubbed('scale-on-scroll', 'ck-m-scale-on-scroll', 'entry 0% cover 45%')],
  }),
  'fade-on-exit': () => ({
    keyframes: [
      keyframes('ck-m-fade-on-exit', {
        to: ['opacity: 0;', 'transform: translateY(calc(var(--ck-dist) * -0.5));'],
      }),
    ],
    timeline: [scrubbed('fade-on-exit', 'ck-m-fade-on-exit', 'exit 0% exit 100%')],
  }),
  /*
    A page-progress bar. It is decorative (the runtime marks it aria-hidden),
    it shows only where a scroll timeline can drive it, and it grows from the
    inline start: transform-origin is 0% in LTR and 100% in RTL.
  */
  'reading-progress': () => ({
    base: [rule(M('reading-progress'), ['display: none;'])],
    keyframes: [
      keyframes('ck-m-reading-progress', {
        from: ['transform: scaleX(0);'],
        to: ['transform: scaleX(1);'],
      }),
    ],
    timeline: [
      rule(`${M('reading-progress')}${LIVE}`, [
        'display: block;',
        'position: fixed;',
        'inset-block-start: 0;',
        'inset-inline: 0;',
        'z-index: 60;',
        'block-size: 3px;',
        `background-color: ${C1};`,
        `transform-origin: calc(50% - 50% * ${SIGN}) 50%;`,
        'animation-name: ck-m-reading-progress;',
        'animation-duration: auto;',
        'animation-timing-function: linear;',
        'animation-fill-mode: both;',
        'animation-timeline: scroll(root block);',
      ]),
    ],
  }),
  /*
    Cards that stack: each child sticks a little lower than the one before and
    shrinks as the ones after it slide over. The sticking is layout (kept
    under reduced motion); the shrink follows the container's view timeline.
  */
  'sticky-stack': () => ({
    base: [
      rule(`${M('sticky-stack')} > *`, [
        'position: sticky;',
        'inset-block-start: calc(var(--ck-stack-top, 6rem) + var(--ck-i, 0) * 1rem);',
      ]),
    ],
    keyframes: [
      keyframes('ck-m-sticky-stack', {
        to: [
          'transform: scale(calc(1 - (var(--ck-n, 1) - var(--ck-i, 0) - 1) * 0.04));',
          'filter: brightness(0.94);',
        ],
      }),
    ],
    timeline: [
      rule(`${M('sticky-stack')}${LIVE}`, ['view-timeline-name: --ck-tl;']),
      rule(`${M('sticky-stack')}${LIVE} > *`, [
        'transform-origin: 50% 0;',
        'animation-name: ck-m-sticky-stack;',
        'animation-duration: auto;',
        'animation-timing-function: linear;',
        'animation-fill-mode: both;',
        'animation-timeline: --ck-tl;',
        'animation-range: contain calc(var(--ck-i, 0) * 100% / var(--ck-n, 1)) contain 100%;',
      ]),
    ],
  }),
  /*
    Pin: the first child sticks while the host's extra scroll length passes
    (sm 50vh, md 100vh, lg 200vh). Pure position: sticky — no engine. Inner
    presets can follow the host's named timeline, `--ck-tl`.
  */
  pin: () => ({
    motion: [
      rule(`${M('pin')}${LIVE}`, [
        'min-block-size: calc(100vh + 100vh * var(--ck-dist-k, 1));',
        'view-timeline-name: --ck-tl;',
      ]),
      rule(`${M('pin')}${LIVE} > :first-child`, ['position: sticky;', 'inset-block-start: 0;']),
    ],
  }),
  /*
    Horizontal scroll: the host becomes tall, its first child sticks to the
    viewport and translates along the INLINE axis as the host scrolls past —
    leftwards in LTR, rightwards in RTL, by (track width − viewport width).
    Without a view timeline, or under reduced motion, the track is a plain
    horizontal scroller.
  */
  'horizontal-scroll': () => ({
    base: [
      rule(`${M('horizontal-scroll')} > :first-child`, [
        'display: flex;',
        'overflow-x: auto;',
        'overscroll-behavior-x: contain;',
      ]),
    ],
    keyframes: [
      keyframes('ck-m-horizontal-scroll', {
        to: [`transform: translateX(calc((100vw - 100%) * ${SIGN}));`],
      }),
    ],
    timeline: [
      rule(`${M('horizontal-scroll')}${LIVE}`, [
        'block-size: calc(100vh * (1 + 2 * var(--ck-dist-k, 1)));',
        'overflow-x: clip;',
        'view-timeline-name: --ck-tl;',
      ]),
      rule(`${M('horizontal-scroll')}${LIVE} > :first-child`, [
        'position: sticky;',
        'inset-block-start: 0;',
        'block-size: 100vh;',
        'inline-size: max-content;',
        'overflow: visible;',
        'align-items: center;',
        'animation-name: ck-m-horizontal-scroll;',
        'animation-duration: auto;',
        'animation-timing-function: linear;',
        'animation-fill-mode: both;',
        'animation-timeline: --ck-tl;',
        'animation-range: contain 0% contain 100%;',
      ]),
    ],
  }),
};

/* ── loops ────────────────────────────────────────────────────────────────── */

/** Meteors travel toward the inline start and down: 143.13° in LTR, 36.87° in RTL. */
const METEOR_ANGLE = `calc(90deg + 53.13deg * ${SIGN})`;
/** Orbit angle of child i of n. */
const ORBIT_ANGLE = 'calc(var(--ck-i, 0) * 360deg / var(--ck-n, 1))';
const ORBIT_RADIUS =
  'var(--ck-orbit-r, calc(var(--t-motion-distance, 24px) * 5 * var(--ck-dist-k, 1)))';

const LOOP: Readonly<Record<(typeof CUSTOM_CODE_LOOP_PRESETS)[number], () => PresetCss>> = {
  float: () => ({
    keyframes: [
      keyframes('ck-m-float', {
        '0%,\n100%': ['transform: translateY(0);'],
        '50%': ['transform: translateY(calc(var(--ck-dist) * -0.5));'],
      }),
    ],
    ...loopRules('float', { kf: 'ck-m-float', seconds: 6, timing: 'ease-in-out' }),
  }),
  pulse: () => ({
    keyframes: [
      keyframes('ck-m-pulse', {
        '0%,\n100%': ['transform: scale(1);'],
        '50%': ['transform: scale(1.04);'],
      }),
    ],
    ...loopRules('pulse', { kf: 'ck-m-pulse', seconds: 2.4, timing: 'ease-in-out' }),
  }),
  'gradient-shift': () => ({
    keyframes: [
      keyframes('ck-m-gradient-shift', {
        '0%,\n100%': ['background-position: 0% 50%;'],
        '50%': ['background-position: 100% 50%;'],
      }),
    ],
    ...loopRules('gradient-shift', {
      kf: 'ck-m-gradient-shift',
      seconds: 8,
      timing: 'ease-in-out',
      extra: ['background-size: 200% 200%;'],
    }),
  }),
  shimmer: () => ({
    keyframes: [
      keyframes('ck-m-shimmer', {
        from: [`transform: translateX(calc(-100% * ${SIGN}));`],
        to: [`transform: translateX(calc(100% * ${SIGN}));`],
      }),
    ],
    ...loopRules('shimmer', {
      kf: 'ck-m-shimmer',
      seconds: 2.6,
      timing: 'ease-in-out',
      targets: ['::after'],
      host: ['position: relative;', 'overflow: hidden;', 'isolation: isolate;'],
      extra: [
        "content: '';",
        'position: absolute;',
        'inset: 0;',
        'pointer-events: none;',
        'background-image: linear-gradient(105deg, transparent 35%, color-mix(in oklab, var(--t-surface, #ffffff) 55%, transparent) 50%, transparent 65%);',
      ],
    }),
  }),
  'spin-slow': () => ({
    keyframes: [keyframes('ck-m-spin-slow', { to: [`transform: rotate(calc(1turn * ${SIGN}));`] })],
    ...loopRules('spin-slow', { kf: 'ck-m-spin-slow', seconds: 14 }),
  }),
  /* Magic UI orbiting-circles (MIT): rotate · translate · counter-rotate; see vendor/VENDOR.md. */
  orbit: () => ({
    base: [
      rule(M('orbit'), ['position: relative;']),
      rule(`${M('orbit')} > *`, [
        `--ck-a: ${ORBIT_ANGLE};`,
        'position: absolute;',
        'inset-block-start: 50%;',
        'inset-inline-start: 50%;',
        `translate: calc(-50% * ${SIGN}) -50%;`,
        `transform: rotate(var(--ck-a)) translateY(calc(${ORBIT_RADIUS} * -1)) rotate(calc(var(--ck-a) * -1));`,
      ]),
    ],
    keyframes: [
      keyframes('ck-m-orbit', {
        from: [
          `transform: rotate(var(--ck-a)) translateY(calc(${ORBIT_RADIUS} * -1)) rotate(calc(var(--ck-a) * -1));`,
        ],
        to: [
          `transform: rotate(calc(var(--ck-a) + 1turn * ${SIGN})) translateY(calc(${ORBIT_RADIUS} * -1)) rotate(calc(var(--ck-a) * -1 - 1turn * ${SIGN}));`,
        ],
      }),
    ],
    ...loopRules('orbit', { kf: 'ck-m-orbit', seconds: 20, targets: [' > *'] }),
  }),
  /*
    Magic UI meteors (MIT). The runtime adds the `.ck-meteor` spans (random
    inline position, delay and duration) — none under reduced motion. Inside a
    meteor the frame is ROTATED, so its tail is placed with physical
    `right`/`left`: they name the direction of travel, not the text direction.
  */
  meteors: () => ({
    base: [
      rule('.ck-meteor', [
        'position: absolute;',
        'inset-block-start: var(--ck-meteor-y, -5%);',
        'inset-inline-start: var(--ck-meteor-x, 50%);',
        'inline-size: 2px;',
        'block-size: 2px;',
        'border-radius: 9999px;',
        `color: var(--ck-fx-c1, var(--t-text-muted, #71717a));`,
        'background-color: currentColor;',
        'pointer-events: none;',
        'opacity: 0;',
      ]),
      rule('.ck-meteor::before', [
        "content: '';",
        'position: absolute;',
        'top: 50%;',
        'right: 100%;',
        'width: 3.25rem;',
        'height: 1px;',
        'translate: 0 -50%;',
        'background-image: linear-gradient(to left, currentColor, transparent);',
      ]),
    ],
    keyframes: [
      keyframes('ck-m-meteor', {
        from: [`transform: rotate(${METEOR_ANGLE}) translateX(0);`, 'opacity: 1;'],
        '70%': ['opacity: 1;'],
        to: [
          `transform: rotate(${METEOR_ANGLE}) translateX(var(--ck-meteor-travel, 32rem));`,
          'opacity: 0;',
        ],
      }),
    ],
    ...loopRules('meteors', {
      kf: 'ck-m-meteor',
      seconds: 6,
      targets: [' .ck-meteor'],
      host: ['position: relative;', 'overflow: hidden;'],
      extra: [
        'animation-duration: calc(var(--ck-meteor-dur, 6s) * var(--ck-loop-k, 1));',
        'animation-delay: var(--ck-meteor-delay, 0s);',
      ],
    }),
  }),
};

/* ── text presets ─────────────────────────────────────────────────────────── */

const SPLIT_FROM: Readonly<Record<string, readonly string[]>> = {
  'split-chars': ['opacity: 0;', 'transform: translateY(0.35em);'],
  'split-words': ['opacity: 0;', 'transform: translateY(0.5em);'],
  'split-lines': ['opacity: 0;', 'transform: translateY(0.75em);'],
  'blur-words': ['opacity: 0;', 'filter: blur(8px);', 'transform: translateY(0.2em);'],
};

const SPLIT_STEP: Readonly<Record<string, string>> = {
  'split-chars': '28ms',
  'split-words': '70ms',
  'split-lines': '160ms',
  'blur-words': '90ms',
};

/** Splitting.js technique (MIT, shshaw): the runtime wraps units in spans carrying their index. */
function split(name: string): PresetCss {
  const kf = `ck-m-${name}`;
  return {
    base: [
      rule(M(name), [`--ck-u-step: ${SPLIT_STEP[name] ?? '60ms'};`]),
      rule(`${M(name)}[data-ck-mounted] .ck-u`, ['display: inline-block;']),
    ],
    keyframes: [keyframes(kf, { from: SPLIT_FROM[name] ?? ['opacity: 0;'] })],
    ...playRules(name, {
      kf,
      targets: [' .ck-u'],
      scrubbed: false,
      needsMount: true,
      duration: 'calc(var(--ck-dur, 700ms) * 0.8)',
      delay:
        'calc(var(--ck-delay, 0ms) + var(--ck-u-i, 0) * var(--ck-u-step, 60ms) * var(--ck-loop-k, 1))',
    }),
  };
}

const TEXT: Readonly<Record<(typeof CUSTOM_CODE_TEXT_PRESETS)[number], () => PresetCss>> = {
  'split-chars': () => split('split-chars'),
  'split-words': () => split('split-words'),
  'split-lines': () => split('split-lines'),
  'blur-words': () => split('blur-words'),
  /* The runtime types into `.ck-tw`; the caret blinks only under no-preference. */
  typewriter: () => ({
    keyframes: [keyframes('ck-m-caret', { '50%': ['opacity: 0;'] })],
    motion: [
      rule(`${M('typewriter')} .ck-tw::after`, [
        "content: '';",
        'display: inline-block;',
        'inline-size: 0.08em;',
        'block-size: 1em;',
        'margin-inline-start: 0.06em;',
        'vertical-align: -0.1em;',
        'background-color: currentColor;',
        'animation: ck-m-caret 1s steps(1) infinite;',
      ]),
    ],
  }),
  /*
    Magic UI word-rotate (MIT). Words are the host's element children (or the
    runtime builds them from "a|b|c"). Without a script only the first shows;
    with it the runtime moves `data-ck-on` and keeps every word in a `.ck-sr`
    span for screen readers.
  */
  'word-rotate': () => ({
    base: [
      rule(`${M('word-rotate')}:not([data-ck-mounted]) > :not(:first-child)`, ['display: none;']),
      rule(`${M('word-rotate')}[data-ck-mounted] > :not([data-ck-on], .ck-sr)`, ['display: none;']),
      rule(`${M('word-rotate')} > .ck-wr-word`, ['display: inline-block;']),
    ],
    keyframes: [
      keyframes('ck-m-word-in', {
        from: ['opacity: 0;', 'transform: translateY(-0.5em);', 'filter: blur(4px);'],
      }),
    ],
    motion: [
      rule(`${M('word-rotate')}[data-ck-mounted]${LIVE} > [data-ck-on]`, [
        'animation: ck-m-word-in calc(var(--ck-dur, 700ms) * 0.6) var(--ck-ease) both;',
      ]),
    ],
  }),
  /* Magic UI animated-gradient-text (MIT): a 300 % gradient panned behind clipped text. */
  'gradient-text': () => ({
    base: [
      rule(M('gradient-text'), [
        `background-image: linear-gradient(calc(90deg * ${SIGN}), ${C1}, ${C2}, ${C1});`,
        'background-size: 300% 100%;',
        '-webkit-background-clip: text;',
        'background-clip: text;',
        'color: transparent;',
        '-webkit-text-fill-color: transparent;',
      ]),
    ],
    keyframes: [
      keyframes('ck-m-gradient-text', {
        '0%,\n100%': ['background-position: 0% 50%;'],
        '50%': ['background-position: 100% 50%;'],
      }),
    ],
    ...loopRules('gradient-text', { kf: 'ck-m-gradient-text', seconds: 8, timing: 'ease-in-out' }),
  }),
  /* A marker sweeping under the text from the inline start. */
  'highlight-sweep': () => ({
    base: [
      rule(M('highlight-sweep'), [
        `background-image: linear-gradient(var(--ck-highlight, color-mix(in oklab, ${C1} 30%, transparent)) 0 0);`,
        'background-repeat: no-repeat;',
        'background-size: 100% 0.42em;',
        `background-position: calc(50% - 50% * ${SIGN}) 88%;`,
        '-webkit-box-decoration-break: clone;',
        'box-decoration-break: clone;',
      ]),
    ],
    keyframes: [keyframes('ck-m-highlight-sweep', { from: ['background-size: 0% 0.42em;'] })],
    ...playRules('highlight-sweep', { kf: 'ck-m-highlight-sweep' }),
  }),
  /*
    anime.js line drawing (MIT, Julian Garnier): the runtime sets
    pathLength="1" on every shape, so a dash of 1 is the whole stroke and the
    offset animates 1 → 0. Waits for the runtime: without pathLength a dash of
    1 would dot the line.
  */
  'draw-line': () => ({
    base: [
      rule(
        [
          `${M('draw-line')}[data-ck-mounted] :is(path, line, polyline, polygon, circle, ellipse, rect)`,
          `${M('draw-line')}[data-ck-mounted]:is(path, line, polyline, polygon, circle, ellipse, rect)`,
        ],
        ['stroke-dasharray: 1;'],
      ),
    ],
    keyframes: [
      keyframes('ck-m-draw-line', {
        from: ['stroke-dashoffset: 1;'],
        to: ['stroke-dashoffset: 0;'],
      }),
    ],
    ...playRules('draw-line', {
      kf: 'ck-m-draw-line',
      needsMount: true,
      sharedTimeline: true,
      duration: 'calc(var(--ck-dur, 700ms) * 2)',
      targets: [' :is(path, line, polyline, polygon, circle, ellipse, rect)', ''],
    }),
  }),
};

function motionPreset(name: CustomCodeMotionPreset): PresetCss {
  if ((CUSTOM_CODE_ENTRANCE_PRESETS as readonly string[]).includes(name))
    return entrance(name as (typeof CUSTOM_CODE_ENTRANCE_PRESETS)[number]);
  if ((CUSTOM_CODE_STAGGER_PRESETS as readonly string[]).includes(name))
    return stagger(name as (typeof CUSTOM_CODE_STAGGER_PRESETS)[number]);
  if (name in SCROLL) return SCROLL[name as keyof typeof SCROLL]();
  if (name in LOOP) return LOOP[name as keyof typeof LOOP]();
  return TEXT[name as keyof typeof TEXT]();
}

/* ── hover presets ────────────────────────────────────────────────────────── */

/**
 * When a hover preset is "on": real hover or keyboard focus (live pages
 * only), the canvas state switcher (`data-ck-state~='hover'`), or Preview.
 */
function on(name: string, suffix = ''): string[] {
  const host = H(name);
  return [
    `${host}${LIVE}:is(:hover, :focus-visible, :focus-within)${suffix}`,
    `${host}[data-ck-state~='hover']${suffix}`,
    `${host}[data-ck-play]${suffix}`,
  ];
}

const HOVER: Readonly<Record<CustomCodeHoverPreset, () => PresetCss>> = {
  lift: () => ({
    motion: [
      rule(H('lift'), [
        'transition-property: transform, box-shadow;',
        'transition-duration: var(--ck-hover-dur, 280ms);',
        'transition-timing-function: var(--ck-ease);',
      ]),
      rule(on('lift'), [
        'transform: translateY(calc(var(--ck-dist) * -0.25));',
        'box-shadow: var(--t-shadow-elevated, 0 18px 40px -18px rgb(0 0 0 / 0.35));',
      ]),
    ],
  }),
  /* The glow is a state, not motion: it shows under reduced motion too; only its fade is gated. */
  glow: () => ({
    base: [
      rule(on('glow'), [
        `box-shadow: 0 0 0 1px color-mix(in oklab, ${C1} 45%, transparent), 0 10px 40px -8px color-mix(in oklab, ${C1} 55%, transparent);`,
      ]),
    ],
    motion: [
      rule(H('glow'), ['transition: box-shadow var(--ck-hover-dur, 280ms) var(--ck-ease);']),
    ],
  }),
  scale: () => ({
    motion: [
      rule(H('scale'), ['transition: transform var(--ck-hover-dur, 280ms) var(--ck-ease);']),
      rule(on('scale'), ['transform: scale(1.04);']),
    ],
  }),
  /* The runtime writes --ck-tilt-x/y from a FINE pointer only; coarse pointers never tilt. */
  tilt: () => ({
    motion: [
      rule(`${H('tilt')}${LIVE}`, [
        'transform: perspective(900px) rotateX(var(--ck-tilt-x, 0deg)) rotateY(var(--ck-tilt-y, 0deg));',
        'transition: transform 200ms ease-out;',
      ]),
    ],
  }),
  magnetic: () => ({
    motion: [
      rule(`${H('magnetic')}${LIVE}`, [
        'transform: translate(var(--ck-mag-x, 0px), var(--ck-mag-y, 0px));',
        'transition: transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1);',
      ]),
    ],
  }),
  'shine-sweep': () => ({
    motion: [
      rule(H('shine-sweep'), ['position: relative;', 'overflow: hidden;', 'isolation: isolate;']),
      rule(`${H('shine-sweep')}::after`, [
        "content: '';",
        'position: absolute;',
        'inset: 0;',
        'pointer-events: none;',
        'background-image: linear-gradient(105deg, transparent 30%, color-mix(in oklab, var(--t-surface, #ffffff) 45%, transparent) 50%, transparent 70%);',
        `transform: translateX(calc(-110% * ${SIGN}));`,
        'transition: transform calc(var(--ck-hover-dur, 280ms) * 2.4) var(--ck-ease);',
      ]),
      rule(on('shine-sweep', '::after'), [`transform: translateX(calc(110% * ${SIGN}));`]),
    ],
  }),
  /* The underline is a state; its growth from the inline start is the motion. */
  'underline-grow': () => ({
    base: [
      rule(H('underline-grow'), [
        'background-image: linear-gradient(currentColor, currentColor);',
        'background-repeat: no-repeat;',
        'background-size: 0% 0.08em;',
        `background-position: calc(50% - 50% * ${SIGN}) 100%;`,
      ]),
      rule(on('underline-grow'), ['background-size: 100% 0.08em;']),
    ],
    motion: [
      rule(H('underline-grow'), [
        'transition: background-size var(--ck-hover-dur, 280ms) var(--ck-ease);',
      ]),
    ],
  }),
  'image-zoom': () => ({
    motion: [
      rule(H('image-zoom'), ['overflow: hidden;']),
      rule(
        [`${H('image-zoom')} img`, `${H('image-zoom')} video`],
        ['transition: transform calc(var(--ck-hover-dur, 280ms) * 2) var(--ck-ease);'],
      ),
      rule(
        [...on('image-zoom', ' img'), ...on('image-zoom', ' video')],
        ['transform: scale(1.06);'],
      ),
    ],
  }),
  /*
    Magic UI border-beam (MIT). Upstream moves a gradient blob along
    `offset-path: rect()` with Motion; ours is engine-free: the ShineBorder
    ring (two masks composited with `exclude`) painted by a conic gradient
    whose start angle is a registered property, so it can rotate.
  */
  'border-beam': () => ({
    base: [
      rule(H('border-beam'), ['position: relative;']),
      rule(`${H('border-beam')}::before`, [
        "content: '';",
        'position: absolute;',
        'inset: 0;',
        'border-radius: inherit;',
        'padding: var(--ck-beam-width, 1.5px);',
        'pointer-events: none;',
        `background-image: conic-gradient(from var(--ck-beam-angle, 0deg), transparent 0%, transparent 68%, ${C1} 82%, ${C2} 92%, transparent 100%);`,
        '-webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);',
        '-webkit-mask-composite: xor;',
        'mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);',
        'opacity: 0;',
      ]),
      rule(on('border-beam', '::before'), ['opacity: 1;']),
    ],
    keyframes: [
      keyframes('ck-h-border-beam', { to: [`--ck-beam-angle: calc(360deg * ${SIGN});`] }),
    ],
    motion: [
      rule(`${H('border-beam')}::before`, [
        'transition: opacity var(--ck-hover-dur, 280ms) var(--ck-ease);',
        'animation: ck-h-border-beam calc(4s * var(--ck-loop-k, 1)) linear infinite paused;',
      ]),
      rule(on('border-beam', '::before'), ['animation-play-state: running;']),
    ],
  }),
  'icon-nudge': () => ({
    motion: [
      rule(
        [`${H('icon-nudge')} svg`, `${H('icon-nudge')} [data-ck-icon]`],
        ['transition: transform var(--ck-hover-dur, 280ms) var(--ck-ease);'],
      ),
      rule(
        [...on('icon-nudge', ' svg'), ...on('icon-nudge', ' [data-ck-icon]')],
        [`transform: translateX(calc(0.25em * ${SIGN}));`],
      ),
    ],
  }),
};

/* ── shared runtime classes ───────────────────────────────────────────────── */

const SHARED_BASE = [
  /* Visually hidden, still read: the full sentence of a rotating or typed text. */
  rule('.ck-sr', [
    'position: absolute;',
    'inline-size: 1px;',
    'block-size: 1px;',
    'margin: -1px;',
    'padding: 0;',
    'overflow: hidden;',
    'clip-path: inset(50%);',
    'white-space: nowrap;',
    'border: 0;',
  ]),
];

const SHARED_MOTION = [
  /* Re-arming a "play every time" element: drop its animation for one style pass. */
  rule(['[data-ck-rearm]', '[data-ck-rearm] *'], ['animation-name: none !important;']),
];

/* ── assembly ─────────────────────────────────────────────────────────────── */

const HEADER = `/*
  GENERATED by packages/builder/renderer/src/motion/presets-css.ts — do not edit.
  Motion presets for data-ck-motion / data-ck-hover (style-manager DESIGN.md §B).
  Start states live only under prefers-reduced-motion: no-preference.
*/`;

const LAYER_ORDER = '@layer properties, theme, base, components, utilities;';

const BEAM_ANGLE = `@property --ck-beam-angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}`;

export interface MotionCssSelection {
  /** Only these `data-ck-motion` names (default: all). */
  readonly presets?: Iterable<string>;
  /** Only these `data-ck-hover` names (default: all). */
  readonly hovers?: Iterable<string>;
}

function chosen<T extends string>(all: readonly T[], only: Iterable<string> | undefined): T[] {
  if (only === undefined) return [...all];
  const wanted = new Set(only);
  return all.filter((name) => wanted.has(name));
}

/**
 * The preset stylesheet. With a selection, only the named presets are
 * emitted (the static export passes the names a site uses); an empty
 * selection yields an empty string.
 */
export function buildMotionPresetsCss(selection: MotionCssSelection = {}): string {
  const presets = chosen(CUSTOM_CODE_MOTION_PRESETS, selection.presets);
  const hovers = chosen(CUSTOM_CODE_HOVER_PRESETS, selection.hovers);
  if (presets.length === 0 && hovers.length === 0) return '';
  const parts = [...presets.map(motionPreset), ...hovers.map((name) => HOVER[name]())];
  const collect = (key: keyof PresetCss): string[] => parts.flatMap((part) => part[key] ?? []);

  const layered = [
    paramsCss(),
    ...SHARED_BASE,
    ...collect('base'),
    ...collect('keyframes'),
    block(NO_PREFERENCE, [
      ...SHARED_MOTION,
      ...collect('motion'),
      block(HAS_VIEW, collect('timeline')),
      block(NO_VIEW, collect('fallback')),
    ]),
  ];
  const usesBeam = hovers.includes('border-beam');
  return [
    HEADER,
    LAYER_ORDER,
    ...(usesBeam ? [BEAM_ANGLE] : []),
    block('@layer components', layered),
  ]
    .join('\n\n')
    .concat('\n');
}

/** Presets whose movement runs along the inline axis — each reads `--ck-inline-sign`. */
export const INLINE_AXIS_PRESETS: readonly string[] = [
  'fade-start',
  'fade-end',
  'clip-start',
  'tilt-in',
  'reading-progress',
  'horizontal-scroll',
  'shimmer',
  'spin-slow',
  'orbit',
  'meteors',
  'gradient-text',
  'highlight-sweep',
];

/** Hover presets whose movement runs along the inline axis. */
export const INLINE_AXIS_HOVERS: readonly string[] = [
  'shine-sweep',
  'underline-grow',
  'icon-nudge',
  'border-beam',
];

/** The CSS one preset contributes (for tests and the panel's mini previews). */
export function motionPresetCss(name: CustomCodeMotionPreset): string {
  const part = motionPreset(name);
  return [
    ...(part.base ?? []),
    ...(part.keyframes ?? []),
    ...(part.motion ?? []),
    ...(part.timeline ?? []),
    ...(part.fallback ?? []),
  ].join('\n');
}

/** The CSS one hover preset contributes. */
export function hoverPresetCss(name: CustomCodeHoverPreset): string {
  const part = HOVER[name]();
  return [...(part.base ?? []), ...(part.keyframes ?? []), ...(part.motion ?? [])].join('\n');
}
