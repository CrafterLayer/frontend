/**
 * The styles of the video packs (media-motion DESIGN §A.2): the
 * `video-player` chrome (`.ck-vp*`), the facade's play badge
 * (`.ck-play-badge`) and iframe (`.ck-embed-frame`), and the `bg-video`
 * toggle (`.ck-bgv-toggle`).
 *
 * - Logical properties only, so the bar, the scrubber and the toggle sit
 *   right in RTL. Media icons (play, pause) are NOT mirrored: they are
 *   universal symbols.
 * - Colours: the stage tokens (`--bldr-stage-on-accent`, `--bldr-stage-accent`,
 *   `--bldr-focus-ring`), each with its value as a fallback because a
 *   published page defines no builder token, and neutral shadows behind the
 *   controls so any video reads under them.
 * - Transitions only under `prefers-reduced-motion: no-preference`.
 * - Icons are CSS masks painted in `currentColor`, so the serialised runtime
 *   carries no SVG.
 *
 * The renderer seam appends this to `BEHAVIOR_CSS`.
 */

const svg = (body: string): string =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>${body}</svg>`,
  )}")`;

const stroke = "fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'";

const ICON = {
  play: svg("<path d='M8 5.5v13l10.5-6.5z'/>"),
  pause: svg("<path d='M6.5 5h3.5v14H6.5zM14 5h3.5v14H14z'/>"),
  volume: svg(
    `<path d='M4 9.5v5h3.5L12 18V6L7.5 9.5z'/><path ${stroke} d='M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11'/>`,
  ),
  muted: svg(`<path d='M4 9.5v5h3.5L12 18V6L7.5 9.5z'/><path ${stroke} d='M15.5 9.5l5 5M20.5 9.5l-5 5'/>`),
  captions: svg(
    `<rect ${stroke} x='3' y='5.5' width='18' height='13' rx='2'/><path ${stroke} d='M10.5 10H8v4h2.5M16.5 10H14v4h2.5'/>`,
  ),
  pip: svg(`<rect ${stroke} x='3' y='5' width='18' height='14' rx='2'/><rect x='12' y='11.5' width='7' height='5.5' rx='1'/>`),
  full: svg(`<path ${stroke} d='M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5'/>`),
};

export const VIDEO_PACK_CSS = `
/* ── video packs (media-motion DESIGN §A.2) ── */
:where([data-ck-behavior='video-player'][data-ck-player]),
:where([data-ck-behavior='embed-facade']),
:where([data-ck-behavior='bg-video'][data-ck-bg-video]) {
  position: relative;
}
:where([data-ck-behavior='embed-facade']) {
  display: block;
}
[data-ck-player]:fullscreen {
  background: rgb(0 0 0);
}
[data-ck-player]:fullscreen video {
  inline-size: 100%;
  block-size: 100%;
  object-fit: contain;
}

.ck-vp {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  pointer-events: none;
  color: var(--bldr-stage-on-accent, #ffffff);
  font-size: 0.875rem;
  line-height: 1;
}
.ck-vp[inert],
.ck-vp[inert] * {
  pointer-events: none !important;
}
.ck-vp-bar {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding-block: 1.5rem 0.5rem;
  padding-inline: 0.75rem;
  background: linear-gradient(to top, rgb(0 0 0 / 0.7), rgb(0 0 0 / 0));
  pointer-events: auto;
}
.ck-vp.ck-playing:not(:hover):not(:focus-within) .ck-vp-bar {
  opacity: 0;
}
.ck-vp-btn {
  display: inline-grid;
  place-items: center;
  flex: none;
  inline-size: 2.25rem;
  block-size: 2.25rem;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0.5rem;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.ck-vp-btn:hover {
  background: rgb(255 255 255 / 0.16);
}
.ck-vp-btn::before,
.ck-play-badge::before,
.ck-bgv-toggle::before {
  content: '';
  inline-size: 1.25rem;
  block-size: 1.25rem;
  background: currentColor;
  -webkit-mask: var(--ck-vp-icon) center / contain no-repeat;
  mask: var(--ck-vp-icon) center / contain no-repeat;
}
.ck-vp-play::before,
.ck-vp-big::before,
.ck-play-badge::before,
.ck-bgv-toggle.ck-paused::before {
  --ck-vp-icon: ${ICON.play};
}
.ck-vp.ck-playing .ck-vp-play::before,
.ck-bgv-toggle::before {
  --ck-vp-icon: ${ICON.pause};
}
.ck-vp-mute::before {
  --ck-vp-icon: ${ICON.volume};
}
.ck-vp.ck-muted .ck-vp-mute::before {
  --ck-vp-icon: ${ICON.muted};
}
.ck-vp-cc::before {
  --ck-vp-icon: ${ICON.captions};
}
.ck-vp-cc[aria-pressed='false'] {
  opacity: 0.6;
}
.ck-vp-pip::before {
  --ck-vp-icon: ${ICON.pip};
}
.ck-vp-full::before {
  --ck-vp-icon: ${ICON.full};
}
.ck-vp-big,
.ck-play-badge {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  inline-size: 4.5rem;
  block-size: 4.5rem;
  margin: auto;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: rgb(0 0 0 / 0.6);
  color: var(--bldr-stage-on-accent, #ffffff);
}
.ck-vp-big {
  pointer-events: auto;
  cursor: pointer;
}
.ck-play-badge {
  pointer-events: none;
}
.ck-vp-big::before,
.ck-play-badge::before {
  inline-size: 2rem;
  block-size: 2rem;
}
.ck-vp-big:hover,
[data-ck-behavior='embed-facade']:hover .ck-play-badge,
[data-ck-behavior='embed-facade']:focus-visible .ck-play-badge {
  background: var(--bldr-stage-accent, #5b5bd6);
}
.ck-vp.ck-playing .ck-vp-big {
  opacity: 0;
}
.ck-vp-seek {
  flex: 1 1 auto;
  min-inline-size: 3rem;
  margin: 0;
  accent-color: var(--bldr-stage-accent, #5b5bd6);
  cursor: pointer;
}
.ck-vp-time {
  flex: none;
  padding-inline: 0.25rem;
  font-variant-numeric: tabular-nums;
  font-size: 0.8125rem;
  white-space: nowrap;
}

.ck-embed-frame {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  border: 0;
}

.ck-bgv-toggle {
  position: absolute;
  inset-inline-end: 1rem;
  inset-block-end: 1rem;
  z-index: 2;
  display: grid;
  place-items: center;
  inline-size: 2.5rem;
  block-size: 2.5rem;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: rgb(0 0 0 / 0.55);
  color: var(--bldr-stage-on-accent, #ffffff);
  cursor: pointer;
}
.ck-bgv-toggle::before {
  inline-size: 1rem;
  block-size: 1rem;
}

.ck-vp-btn:focus-visible,
.ck-vp-big:focus-visible,
.ck-vp-seek:focus-visible,
.ck-bgv-toggle:focus-visible,
[data-ck-player]:focus-visible,
[data-ck-behavior='embed-facade']:focus-visible {
  outline: var(--bldr-focus-ring-width, 2px) solid var(--bldr-focus-ring, #5b5bd6);
  outline-offset: var(--bldr-focus-ring-offset, 2px);
}

@media (prefers-reduced-motion: no-preference) {
  .ck-vp-bar,
  .ck-vp-big,
  .ck-vp-btn,
  .ck-play-badge,
  .ck-bgv-toggle {
    transition:
      opacity 0.2s ease,
      background-color 0.2s ease;
  }
}
`;
