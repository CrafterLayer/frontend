/**
 * The styles of the `gallery` / `lightbox` pack (packs/gallery.ts) and the
 * `carousel` pack (packs/carousel.ts).
 *
 * Each constant opens with the rules `behaviors-css.ts` carried for the old
 * single-image lightbox and the old carousel, copied verbatim (the seam
 * deletes those copies), then adds what the packs build: the group dialog's
 * previous/next buttons, caption and counter; the carousel's dots, counter
 * and pause/play toggle.
 *
 * Logical properties only, so every control sits at the INLINE start or end
 * and mirrors under RTL by itself; the lightbox's arrow glyphs are flipped by
 * the dialog's `dir`. Focus rings are visible on keyboard focus only. Every
 * transition lives under `prefers-reduced-motion: no-preference`; under
 * reduce, images swap and dots change at once.
 *
 * Colours are `var(--bldr-*)` tokens with system-colour fallbacks, because a
 * published page does not carry the builder's chrome theme. The lightbox
 * draws on its own dark backdrop, so its text stays white on a dark veil, as
 * the original close button does.
 */
const RING = 'var(--bldr-focus-ring-width, 2px) solid var(--bldr-focus-ring, Highlight)';
const RING_OFFSET = 'var(--bldr-focus-ring-offset, 2px)';

export const GALLERY_PACK_CSS = `
[data-ck-behavior='lightbox'] {
  cursor: zoom-in;
}
dialog[data-ck-lightbox] {
  /* fix pass (2026-10-06): the published site.css carries the Tailwind preflight
     (*,::backdrop{margin:0}), which undoes the UA dialog{margin:auto}; restated so
     the lightbox is centred, not pinned to the inline-start corner. */
  margin: auto;
  inset: 0;
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

[data-ck-behavior='gallery'] img,
[data-ck-behavior='gallery'] [aria-haspopup='dialog'] {
  cursor: zoom-in;
}
[data-ck-behavior='gallery'] [aria-haspopup='dialog']:focus-visible,
[data-ck-behavior='lightbox']:focus-visible {
  outline: ${RING};
  outline-offset: ${RING_OFFSET};
}
dialog[data-ck-lightbox] {
  overflow: visible;
  touch-action: pan-y pinch-zoom;
}
dialog[data-ck-lightbox]:has([data-ck-lightbox-caption]:not([hidden])) img {
  max-height: 80vh;
}
dialog[data-ck-lightbox] button:focus-visible {
  outline: ${RING};
  outline-offset: ${RING_OFFSET};
}
dialog[data-ck-lightbox] button[data-ck-lightbox-nav] {
  inset-block-start: 50%;
  translate: 0 -50%;
  display: inline-grid;
  place-items: center;
  inline-size: 2.75rem;
  block-size: 2.75rem;
  font-size: 1.75rem;
}
dialog[data-ck-lightbox] button[data-ck-lightbox-nav='prev'] {
  inset-inline-start: 0.5rem;
  inset-inline-end: auto;
}
dialog[data-ck-lightbox] button[data-ck-lightbox-nav='next'] {
  inset-inline-end: 0.5rem;
}
dialog[data-ck-lightbox][dir='rtl'] button[data-ck-lightbox-nav] > span {
  display: inline-block;
  scale: -1 1;
}
dialog[data-ck-lightbox] [data-ck-lightbox-caption] {
  margin: 0;
  padding-block: 0.625rem 0;
  padding-inline: 0.5rem;
  color: #fff;
  font-size: 0.95rem;
  line-height: 1.5;
  text-align: center;
  cursor: auto;
}
dialog[data-ck-lightbox] [data-ck-lightbox-caption][hidden] {
  display: none;
}
dialog[data-ck-lightbox] [data-ck-lightbox-counter] {
  position: absolute;
  inset-block-start: 0.75rem;
  inset-inline-start: 0.75rem;
  padding-block: 0.125rem;
  padding-inline: 0.625rem;
  border-radius: 999px;
  background: rgb(0 0 0 / 0.55);
  color: #fff;
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  line-height: 1.6;
}
@media (prefers-reduced-motion: no-preference) {
  dialog[data-ck-lightbox][open] {
    animation: ck-lightbox-in 0.2s ease-out;
  }
  dialog[data-ck-lightbox] img[data-ck-lightbox-step] {
    animation: ck-lightbox-step 0.28s cubic-bezier(0.22, 1, 0.36, 1);
  }
}
@keyframes ck-lightbox-in {
  from {
    opacity: 0;
  }
}
@keyframes ck-lightbox-step {
  from {
    opacity: 0;
    translate: calc(var(--ck-lightbox-from, 0) * 2rem) 0;
  }
}
`;

export const CAROUSEL_PACK_CSS = `
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

[data-ck-behavior='carousel'] [data-ck-track]:focus-visible,
[data-ck-behavior='carousel'][data-ck-track]:focus-visible {
  outline: ${RING};
  outline-offset: ${RING_OFFSET};
}
[data-ck-carousel-ui] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-block-start: 0.75rem;
}
[data-ck-carousel-dots] {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.125rem;
}
[data-ck-carousel-dots] > button {
  display: inline-grid;
  place-items: center;
  inline-size: 1.5rem;
  block-size: 1.5rem;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
[data-ck-carousel-dots] > button::before {
  content: '';
  inline-size: 0.5rem;
  block-size: 0.5rem;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.35;
}
[data-ck-carousel-dots] > button[aria-current='true']::before {
  inline-size: 1rem;
  background: var(--bldr-accent, currentColor);
  opacity: 1;
}
[data-ck-carousel-counter] {
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}
[data-ck-carousel-play] {
  display: inline-grid;
  place-items: center;
  inline-size: 2.25rem;
  block-size: 2.25rem;
  padding: 0;
  border: 1px solid var(--bldr-panel-border, ButtonBorder);
  border-radius: 999px;
  background: var(--bldr-surface, Canvas);
  color: var(--bldr-panel-text, CanvasText);
  font-size: 0.75rem;
  line-height: 1;
  cursor: pointer;
}
[data-ck-carousel-dots] > button:focus-visible,
[data-ck-carousel-play]:focus-visible {
  outline: ${RING};
  outline-offset: ${RING_OFFSET};
}
[data-ck-still] [data-ck-carousel-ui] button {
  pointer-events: none;
}
@media (prefers-reduced-motion: no-preference) {
  [data-ck-carousel-dots] > button::before {
    transition:
      inline-size 0.2s ease,
      opacity 0.2s ease;
  }
}
`;
