/**
 * The styles the site behaviours need, scoped by `[data-ck-behavior]` and the
 * runtime's mount marker so an unmounted page (no script) always shows its
 * content. Motion lives only under `prefers-reduced-motion: no-preference`.
 *
 * One source, three readers: `behaviors.css` (held equal by
 * behaviors-css.test.ts), the static exporter (embeds `BEHAVIOR_CSS` in a
 * <style>), and the canvas (`ensureBehaviorCss` injects it once per document).
 * Colours are neutral shadows only, so any page palette sits under them.
 */
export const BEHAVIOR_CSS = `/*
  GENERATED FILE — do not edit by hand.
  Produced by packages/builder/renderer/src/behaviors/behaviors-css.ts (BEHAVIOR_CSS)
  and held equal to it by behaviors-css.test.ts.
*/

@media (prefers-reduced-motion: no-preference) {
  [data-ck-behavior='reveal'][data-ck-mounted]:not(.ck-in),
  [data-ck-behavior='stagger'][data-ck-mounted]:not(.ck-in) > * {
    opacity: 0;
    transform: translateY(1.25rem);
  }
  [data-ck-behavior='reveal'][data-ck-mounted],
  [data-ck-behavior='stagger'][data-ck-mounted] > * {
    transition:
      opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1),
      transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
  }
  [data-ck-behavior='stagger'][data-ck-mounted] > * {
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

[data-ck-behavior='carousel'] [data-ck-track],
[data-ck-behavior='carousel'][data-ck-track] {
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
}
[data-ck-behavior='carousel'] [data-ck-track]::-webkit-scrollbar {
  display: none;
}
[data-ck-behavior='carousel'] [data-ck-track] > * {
  scroll-snap-align: start;
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

[data-ck-behavior='lightbox'] {
  cursor: zoom-in;
}
dialog[data-ck-lightbox] {
  max-width: min(92vw, 1200px);
  max-height: 92vh;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: zoom-out;
}
dialog[data-ck-lightbox]::backdrop {
  background: rgb(0 0 0 / 0.8);
}
dialog[data-ck-lightbox] img {
  display: block;
  max-width: 100%;
  max-height: 88vh;
  object-fit: contain;
}
dialog[data-ck-lightbox] button {
  position: absolute;
  inset-block-start: 0.5rem;
  inset-inline-end: 0.5rem;
  inline-size: 2.5rem;
  block-size: 2.5rem;
  border: 0;
  border-radius: 999px;
  background: rgb(0 0 0 / 0.55);
  color: #fff;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
}

[data-ck-behavior='countdown'] {
  font-variant-numeric: tabular-nums;
}
[data-ck-behavior='copy-text'].ck-copied {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
`;

const STYLE_MARK = 'data-ck-behavior-css';

/**
 * Put the behaviour styles in a document once. The canvas calls it before
 * mounting, so a host needs no stylesheet import for behaviours to render.
 */
export function ensureBehaviorCss(document: Document): void {
  if (document.head.querySelector(`style[${STYLE_MARK}]`) !== null) return;
  const style = document.createElement('style');
  style.setAttribute(STYLE_MARK, '');
  style.textContent = BEHAVIOR_CSS;
  document.head.appendChild(style);
}
