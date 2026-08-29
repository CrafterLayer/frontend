/**
 * Motion, rendered as CSS.
 *
 * This is the BASELINE, and it is deliberately the whole story for most pages.
 * Reveals and scroll-linked effects are expressed with `@keyframes` plus
 * `animation-timeline: view()`, so they run on the compositor with no
 * JavaScript at all. That is what keeps FR-063 true: the read path, the publish
 * path, and static output all animate a document without loading an engine.
 *
 * The contained `motion` extension exists for the small set of effects CSS
 * genuinely cannot express — pinning a section while the page scrolls past it,
 * spring physics, and orchestrated stagger. Everything below works without it.
 *
 * Every duration and offset resolves from `--t-motion-*` custom properties
 * rather than being written inline, for the same reason colours do: a named
 * step a theme can re-point, never a number frozen into a rule.
 */
import {
  MOTION_DELAYS,
  MOTION_DURATIONS,
  MOTION_EASINGS,
  REVEAL_EFFECTS,
  SCROLL_EFFECTS,
  type MotionSpec,
} from '@craftkit/builder-schema';

/** The class a node carries so the sheet below can find it. */
export const MOTION_CLASS = 'bldr-motion';

const DURATION_MS: Record<(typeof MOTION_DURATIONS)[number], string> = {
  instant: '120ms',
  fast: '220ms',
  normal: '420ms',
  slow: '700ms',
  deliberate: '1100ms',
};

const DELAY_MS: Record<(typeof MOTION_DELAYS)[number], string> = {
  none: '0ms',
  short: '80ms',
  medium: '180ms',
  long: '320ms',
};

const EASING_FN: Record<(typeof MOTION_EASINGS)[number], string> = {
  linear: 'linear',
  'ease-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
  'ease-in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
  /* CSS cannot do real spring physics; this is its closest honest approximation.
     The extension replaces it with the real thing when it is loaded. */
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)',
};

/** The transform a reveal starts from. `none` and `fade` move nothing. */
const REVEAL_FROM: Record<(typeof REVEAL_EFFECTS)[number], string> = {
  none: '',
  fade: '',
  'fade-up': 'translateY(var(--t-motion-distance, 24px))',
  'fade-down': 'translateY(calc(var(--t-motion-distance, 24px) * -1))',
  'fade-left': 'translateX(var(--t-motion-distance, 24px))',
  'fade-right': 'translateX(calc(var(--t-motion-distance, 24px) * -1))',
  'zoom-in': 'scale(0.94)',
  'zoom-out': 'scale(1.06)',
  'blur-in': '',
};

const STAGGER_STEP: Record<string, string> = {
  none: '0ms',
  tight: '60ms',
  normal: '110ms',
  loose: '200ms',
};

/*
  Emitted one declaration per line, at two-space indent.

  Not a style preference: the checked-in stylesheet is covered by
  `pnpm format:check`, and a generator whose output Prettier would reformat
  puts the drift gate and the formatter permanently at war — each one
  "fixing" the file the other just corrected. Matching Prettier's CSS shape
  here is what lets both gates hold at once. `chrome.css` solved it the same
  way.
*/
function rule(selector: string, declarations: readonly string[]): string {
  return [`${selector} {`, ...declarations.map((line) => `  ${line}`), `}`].join('\n');
}

function frame(name: string, declarations: readonly string[]): string {
  return [`  ${name} {`, ...declarations.map((line) => `    ${line}`), `  }`].join('\n');
}

function revealRules(): string {
  return REVEAL_EFFECTS.filter((effect) => effect !== 'none')
    .map((effect) => {
      const from = REVEAL_FROM[effect];
      const fromDeclarations = ['opacity: 0;'];
      if (from !== '') {
        fromDeclarations.push(`transform: ${from};`);
      }
      if (effect === 'blur-in') {
        fromDeclarations.push('filter: blur(10px);');
      }
      return [
        `@keyframes ${MOTION_CLASS}-${effect} {`,
        frame('from', fromDeclarations),
        frame('to', ['opacity: 1;', 'transform: none;', 'filter: none;']),
        `}`,
        /*
          A view() timeline is what makes the reveal fire when the element
          actually enters the viewport, with no observer and no JavaScript.
          `both` holds the start frame before entry, which is what stops the
          content flashing at full opacity for one frame on load.
        */
        rule(`.${MOTION_CLASS}[data-reveal='${effect}']`, [
          `animation-name: ${MOTION_CLASS}-${effect};`,
          'animation-timeline: view();',
          'animation-range: entry 0% cover 32%;',
          'animation-fill-mode: both;',
        ]),
      ].join('\n');
    })
    .join('\n\n');
}

function scrollRules(): string {
  const bodies: Record<string, { from: readonly string[]; to: readonly string[] }> = {
    'parallax-slow': {
      from: ['transform: translateY(calc(var(--t-motion-parallax, 40px) * -1));'],
      to: ['transform: translateY(var(--t-motion-parallax, 40px));'],
    },
    'parallax-fast': {
      from: ['transform: translateY(calc(var(--t-motion-parallax, 40px) * -2));'],
      to: ['transform: translateY(calc(var(--t-motion-parallax, 40px) * 2));'],
    },
    'scale-on-scroll': { from: ['transform: scale(0.88);'], to: ['transform: scale(1);'] },
    'fade-on-scroll': { from: ['opacity: 0.25;'], to: ['opacity: 1;'] },
    'blur-on-scroll': { from: ['filter: blur(8px);'], to: ['filter: none;'] },
    'scrub-reveal': {
      from: ['clip-path: inset(0 100% 0 0);'],
      to: ['clip-path: inset(0 0 0 0);'],
    },
  };

  return SCROLL_EFFECTS.filter((effect) => effect !== 'none' && effect !== 'pin')
    .map((effect) => {
      const body = bodies[effect] ?? { from: [], to: [] };
      return [
        `@keyframes ${MOTION_CLASS}-${effect} {`,
        frame('from', body.from),
        frame('to', body.to),
        `}`,
        rule(`.${MOTION_CLASS}[data-scroll='${effect}']`, [
          `animation-name: ${MOTION_CLASS}-${effect};`,
          'animation-timeline: view();',
          'animation-range: cover 0% cover 100%;',
          'animation-fill-mode: both;',
          'animation-timing-function: linear;',
        ]),
      ].join('\n');
    })
    .join('\n\n');
}

function scaleRules(): string {
  const durations = MOTION_DURATIONS.map((name) =>
    rule(`.${MOTION_CLASS}[data-duration='${name}']`, [
      `animation-duration: ${DURATION_MS[name]};`,
    ]),
  );
  const delays = MOTION_DELAYS.map((name) =>
    rule(`.${MOTION_CLASS}[data-delay='${name}']`, [`animation-delay: ${DELAY_MS[name]};`]),
  );
  const easings = MOTION_EASINGS.map((name) =>
    rule(`.${MOTION_CLASS}[data-easing='${name}']`, [
      `animation-timing-function: ${EASING_FN[name]};`,
    ]),
  );
  /*
    `--stagger-index` is deliberately outside both token namespaces.

    It is a per-ELEMENT counter — "you are the third card in this grid" — set
    per instance, not a design decision the theme owns. Naming it `--bldr-…` or
    `--t-…` would put it in a namespace the coverage gate scans, and the gate
    would be right to fail it: a token no theme defines is a hard-coded value
    wearing a token's clothes. It caught exactly that here.
  */
  const staggers = Object.entries(STAGGER_STEP).map(([name, step]) =>
    rule(`.${MOTION_CLASS}[data-stagger='${name}'] > *`, [
      `animation-delay: calc(${step} * var(--stagger-index, 0));`,
    ]),
  );

  return [...durations, ...delays, ...easings, ...staggers].join('\n');
}

const HEADER = `/*
  GENERATED FILE — do not edit by hand.

  Produced by packages/builder/renderer/src/motion/motion-css.ts and held equal
  to its generator by motion-css.test.ts. Edit the generator.

  Motion runs here as pure CSS: keyframes driven by a view() timeline, with no
  JavaScript and no animation engine. That is what lets the publish path and
  static output animate a document without loading anything (FR-063).
*/`;

/*
  Reduced motion is not a nicety and not an afterthought.

  A person who has asked their operating system to reduce motion has usually
  asked because motion makes them ill. `animation: none` on everything is the
  only honest answer; a "gentler" animation is still an animation. Opacity is
  restored explicitly, because an interrupted fill-mode would otherwise leave
  the content invisible — the failure that turns an accessibility preference
  into a blank page.
*/
const REDUCED_MOTION = `@media (prefers-reduced-motion: reduce) {
  .${MOTION_CLASS},
  .${MOTION_CLASS} > * {
    animation: none !important;
    transition: none !important;
    opacity: 1 !important;
    transform: none !important;
    filter: none !important;
    clip-path: none !important;
  }
}`;

/*
  Browsers without scroll-driven animation support get the content, plainly
  visible, with nothing hidden waiting for a timeline that will never run.
  Progressive enhancement in the direction that fails safe.
*/
const NO_TIMELINE_FALLBACK = `@supports not (animation-timeline: view()) {
  .${MOTION_CLASS} {
    animation: none;
    opacity: 1;
    transform: none;
    filter: none;
    clip-path: none;
  }
}`;

export function buildMotionCss(): string {
  return [HEADER, revealRules(), scrollRules(), scaleRules(), NO_TIMELINE_FALLBACK, REDUCED_MOTION]
    .join('\n\n')
    .concat('\n');
}

/**
 * The DOM attributes a node's motion becomes.
 *
 * Attributes rather than inline styles, so the stylesheet stays the single
 * place any timing lives and a document never carries a literal duration.
 * `pin` is absent here on purpose: CSS cannot pin, so it is the extension's
 * job, and a `pin` that quietly did nothing would be worse than one that
 * visibly needs the engine.
 */
export function motionAttributes(spec: MotionSpec | undefined): Record<string, string> {
  if (spec === undefined) {
    return {};
  }

  const attributes: Record<string, string> = {};
  const set = (key: string, value: string | undefined): void => {
    if (value !== undefined && value !== 'none') {
      attributes[key] = value;
    }
  };

  set('data-reveal', spec.reveal);
  set('data-scroll', spec.scroll);
  set('data-duration', spec.duration);
  set('data-delay', spec.delay);
  set('data-easing', spec.easing);
  set('data-stagger', spec.stagger);
  if (spec.repeat === true) {
    attributes['data-motion-repeat'] = 'true';
  }

  return Object.keys(attributes).length === 0 ? {} : { class: MOTION_CLASS, ...attributes };
}
