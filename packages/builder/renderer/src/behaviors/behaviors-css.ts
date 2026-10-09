import { buildEffectsCss } from '../motion/effects-css';
import { buildMotionPresetsCss } from '../motion/presets-css';

// media-motion (2026-10-06): the packs' styles join BEHAVIOR_CSS (the old carousel/lightbox rules moved there).
import { PACK_CSS } from './packs';

/**
 * The styles the site behaviours need, scoped by `[data-ck-behavior]` and the
 * runtime's mount marker so an unmounted page (no script) always shows its
 * content. Motion lives only under `prefers-reduced-motion: no-preference`.
 *
 * One source, three readers: `behaviors.css` (held equal by
 * behaviors-css.test.ts), the static exporter (embeds `BEHAVIOR_CSS` in a
 * <style>), and the canvas (`ensureBehaviorCss` injects it once per document).
 * Colours are neutral shadows only, so any page palette sits under them.
 *
 * One owner per entrance (walk 2026-10-08): an element whose entrance a
 * timeline plays (`data-ck-timeline`) is never held hidden or transitioned by
 * the reveal/stagger rules. Both together left a published testimonials grid
 * at opacity 0 for good: the timeline animated from the hidden state to the
 * hidden state the stagger CSS was still holding.
 */
export const BEHAVIOR_CSS = `/*
  GENERATED FILE — do not edit by hand.
  Produced by packages/builder/renderer/src/behaviors/behaviors-css.ts (BEHAVIOR_CSS)
  and held equal to it by behaviors-css.test.ts.
*/

@media (prefers-reduced-motion: no-preference) {
  [data-ck-behavior='reveal'][data-ck-mounted]:not(.ck-in):not([data-ck-timeline]),
  [data-ck-behavior='stagger'][data-ck-mounted]:not(.ck-in):not([data-ck-timeline]) > * {
    opacity: 0;
    transform: translateY(1.25rem);
  }
  [data-ck-behavior='reveal'][data-ck-mounted]:not([data-ck-timeline]),
  [data-ck-behavior='stagger'][data-ck-mounted]:not([data-ck-timeline]) > * {
    transition:
      opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1),
      transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
  }
  [data-ck-behavior='stagger'][data-ck-mounted]:not([data-ck-timeline]) > * {
    transition-delay: calc(var(--ck-i, 0) * 80ms);
  }
  [data-ck-behavior='reveal'][data-ck-speed='slow'][data-ck-mounted],
  [data-ck-behavior='stagger'][data-ck-speed='slow'][data-ck-mounted] > * {
    transition-duration: 1s;
  }
  [data-ck-behavior='reveal'][data-ck-speed='fast'][data-ck-mounted],
  [data-ck-behavior='stagger'][data-ck-speed='fast'][data-ck-mounted] > * {
    transition-duration: 0.35s;
  }

  [data-ck-behavior='marquee'][data-ck-mounted] > * {
    animation: ck-marquee var(--ck-marquee-duration, 28s) linear infinite;
  }
  [data-ck-behavior='marquee'][data-ck-mounted]:hover > *,
  [data-ck-behavior='marquee'][data-ck-mounted]:focus-within > * {
    animation-play-state: paused;
  }
}

@keyframes ck-marquee {
  to {
    transform: translateX(calc(var(--ck-marquee-distance, 0px) * var(--ck-marquee-dir, -1)));
  }
}

[data-ck-behavior='marquee'] {
  display: flex;
  overflow: hidden;
}
[data-ck-behavior='marquee'] > * {
  flex-shrink: 0;
}
[data-ck-behavior='marquee'][data-ck-speed='slow'] {
  --ck-marquee-duration: 45s;
}
[data-ck-behavior='marquee'][data-ck-speed='fast'] {
  --ck-marquee-duration: 15s;
}

[data-ck-behavior='sticky-header'] {
  position: sticky;
  top: 0;
  z-index: 40;
  transition:
    box-shadow 0.25s ease,
    backdrop-filter 0.25s ease;
}
[data-ck-behavior='sticky-header'].ck-scrolled {
  box-shadow: 0 8px 24px -16px rgb(0 0 0 / 0.35);
  backdrop-filter: saturate(1.4) blur(10px);
}

[data-ck-behavior='countdown'] {
  font-variant-numeric: tabular-nums;
}

.ck-ticker {
  display: inline-flex;
  direction: ltr;
  unicode-bidi: isolate;
  font-variant-numeric: tabular-nums;
}
.ck-tick-col {
  display: inline-block;
  block-size: 1.15em;
  line-height: 1.15em;
  overflow: hidden;
  vertical-align: bottom;
}
.ck-tick-strip {
  display: flex;
  flex-direction: column;
  transform: translateY(calc(var(--ck-d, 0) * -10%));
}
.ck-tick-strip > span {
  block-size: 1.15em;
}
@media (prefers-reduced-motion: no-preference) {
  .ck-tick-strip {
    transition: transform var(--ck-tick-dur, 1.2s) cubic-bezier(0.16, 1, 0.3, 1);
  }
  [data-ck-behavior='ticker'][data-ck-speed='slow'] .ck-tick-strip {
    --ck-tick-dur: 2s;
  }
  [data-ck-behavior='ticker'][data-ck-speed='fast'] .ck-tick-strip {
    --ck-tick-dur: 0.7s;
  }
}
[data-ck-behavior='copy-text'].ck-copied {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

/* Behaviour packs (media-motion 2026-10-06): gallery/lightbox, carousel, video, widgets, engines. */
${PACK_CSS}
`;

const STYLE_MARK = 'data-ck-behavior-css';
const MOTION_MARK = 'data-ck-motion-css';
const EFFECTS_MARK = 'data-ck-effects-css';

function ensureStyle(document: Document, mark: string, css: () => string): void {
  if (document.head.querySelector(`style[${mark}]`) !== null) return;
  const style = document.createElement('style');
  style.setAttribute(mark, '');
  style.textContent = css();
  document.head.appendChild(style);
}

/**
 * Put the motion presets and the effects library in a document once (every
 * preset and effect: the canvas cannot know which ones the next edit adds).
 * The canvas region carries `data-ck-still`, so the presets show their final
 * states there until a Preview sets `data-ck-play`.
 */
export function ensureMotionCss(document: Document): void {
  ensureStyle(document, MOTION_MARK, () => buildMotionPresetsCss());
  ensureStyle(document, EFFECTS_MARK, () => buildEffectsCss());
}

/**
 * Put the behaviour styles in a document once — and with them the motion
 * presets and effects. The canvas calls it before mounting, so a host needs
 * no stylesheet import for behaviours, presets or effects to render.
 */
export function ensureBehaviorCss(document: Document): void {
  ensureStyle(document, STYLE_MARK, () => BEHAVIOR_CSS);
  ensureMotionCss(document);
}
