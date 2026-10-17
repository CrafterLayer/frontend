/**
 * The styles of the widget packs — `compare` (packs/compare.ts) and the
 * `toggle-group` switch (packs/toggle-group.ts). `mailto-form` needs none.
 *
 * Every rule is gated on the pack's mount marker or the control the pack
 * builds, so a page without the script reads as plain content: two images in
 * a row, prices with the `b` set hidden by the markup itself.
 *
 * Logical properties only, so the compare divider and the switch knob both
 * travel from the INLINE START and mirror under RTL by themselves. The one
 * physical value — `clip-path: inset()` has no logical form — is written per
 * direction: LTR clips the after image from the left, RTL from the right, by
 * `:dir()` where the browser has it and by a `[dir='rtl']` ancestor
 * (zero-specificity `:where`) where it does not.
 *
 * Colours are `var(--bldr-*)` tokens with system-colour fallbacks, because a
 * published page does not carry the builder's chrome theme.
 */
const COMPARE = "[data-ck-behavior='compare'][data-ck-mounted]";
const AFTER = `${COMPARE} > img ~ img`;
const RANGE = `${COMPARE} > [data-ck-compare-range]`;
const SWITCH = '[data-ck-switch]';

export const WIDGETS_PACK_CSS = `
${COMPARE} {
  position: relative;
  display: grid;
  overflow: hidden;
  isolation: isolate;
  --ck-compare: 50%;
}
${COMPARE} > img {
  grid-area: 1 / 1;
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
  user-select: none;
}
${AFTER} {
  clip-path: inset(0 0 0 var(--ck-compare));
}
:where([dir='rtl']) ${AFTER} {
  clip-path: inset(0 var(--ck-compare) 0 0);
}
${AFTER}:dir(rtl) {
  clip-path: inset(0 var(--ck-compare) 0 0);
}
${AFTER}:dir(ltr) {
  clip-path: inset(0 0 0 var(--ck-compare));
}
${COMPARE}::after {
  content: '';
  position: absolute;
  inset-block: 0;
  inset-inline-start: var(--ck-compare);
  inline-size: 2px;
  margin-inline-start: -1px;
  background: var(--bldr-surface, Canvas);
  box-shadow: var(--bldr-shadow-raised, 0 0 0 1px rgb(0 0 0 / 0.25));
  pointer-events: none;
  z-index: 1;
}
${RANGE} {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  margin: 0;
  appearance: none;
  background: transparent;
  cursor: ew-resize;
  z-index: 2;
}
${RANGE}::-webkit-slider-runnable-track {
  background: transparent;
}
${RANGE}::-webkit-slider-thumb {
  appearance: none;
  inline-size: 2.5rem;
  block-size: 2.5rem;
  border: 2px solid var(--bldr-surface, Canvas);
  border-radius: 999px;
  background: var(--bldr-accent, AccentColor);
  box-shadow: var(--bldr-shadow-raised, 0 1px 4px rgb(0 0 0 / 0.35));
}
${RANGE}::-moz-range-track {
  background: transparent;
}
${RANGE}::-moz-range-thumb {
  inline-size: 2.5rem;
  block-size: 2.5rem;
  border: 2px solid var(--bldr-surface, Canvas);
  border-radius: 999px;
  background: var(--bldr-accent, AccentColor);
  box-shadow: var(--bldr-shadow-raised, 0 1px 4px rgb(0 0 0 / 0.35));
}
${RANGE}:focus-visible {
  outline: none;
}
${RANGE}:focus-visible::-webkit-slider-thumb {
  outline: var(--bldr-focus-ring-width, 2px) solid var(--bldr-focus-ring, Highlight);
  outline-offset: var(--bldr-focus-ring-offset, 2px);
}
${RANGE}:focus-visible::-moz-range-thumb {
  outline: var(--bldr-focus-ring-width, 2px) solid var(--bldr-focus-ring, Highlight);
  outline-offset: var(--bldr-focus-ring-offset, 2px);
}

${SWITCH} {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-block-size: 1.75rem;
  padding-inline-start: 3.25rem;
  cursor: pointer;
}
${SWITCH}::before {
  content: '';
  position: absolute;
  inset-block-start: 50%;
  inset-inline-start: 0;
  inline-size: 2.75rem;
  block-size: 1.5rem;
  margin-block-start: -0.75rem;
  border-radius: 999px;
  background: var(--bldr-surface-sunken, ButtonFace);
  box-shadow: inset 0 0 0 1px var(--bldr-panel-border, ButtonBorder);
}
${SWITCH}::after {
  content: '';
  position: absolute;
  inset-block-start: 50%;
  inset-inline-start: 0.1875rem;
  inline-size: 1.125rem;
  block-size: 1.125rem;
  margin-block-start: -0.5625rem;
  border-radius: 999px;
  background: var(--bldr-surface, Canvas);
  box-shadow: var(--bldr-shadow-raised, 0 1px 2px rgb(0 0 0 / 0.3));
}
${SWITCH}[aria-checked='true']::before {
  background: var(--bldr-accent, AccentColor);
  box-shadow: none;
}
${SWITCH}[aria-checked='true']::after {
  inset-inline-start: 1.4375rem;
}
${SWITCH}:focus-visible {
  outline: var(--bldr-focus-ring-width, 2px) solid var(--bldr-focus-ring, Highlight);
  outline-offset: var(--bldr-focus-ring-offset, 2px);
}
@media (prefers-reduced-motion: no-preference) {
  ${SWITCH}::before,
  ${SWITCH}::after {
    transition:
      inset-inline-start 0.2s cubic-bezier(0.22, 1, 0.36, 1),
      background-color 0.2s ease;
  }
}
`;
