/**
 * The published site's base reset: Tailwind CSS v4.3.3 `preflight.css`,
 * vendored and minified (MIT License, Copyright (c) Tailwind Labs, Inc.,
 * https://github.com/tailwindlabs/tailwindcss/blob/main/packages/tailwindcss/preflight.css).
 *
 * The canvas renders inside a host page that already carries this reset, so
 * the live-utilities sheet deliberately omits it. A published page has no such
 * host: without it `figure`/`blockquote` keep their 40px margins, `ol` shows
 * browser markers and boxes size content-box — the site no longer looks like
 * the canvas. `--theme(...)` calls are resolved to the `var()` fallbacks
 * Tailwind compiles them to.
 *
 * It sits in `@layer base`, after an explicit layer order, so every utility
 * (in `@layer utilities`) and every unlayered region stylesheet still wins.
 */
// ── block-parts (2026-10-06) ──
import { TEXT_BIDI_CSS } from '../bidi';
// ── /block-parts ──

const FONT_SANS =
  "var(--default-font-family,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue','Noto Sans',Arial,sans-serif,'Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol','Noto Color Emoji')";
const FONT_MONO =
  "var(--default-mono-font-family,ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace)";

const PREFLIGHT = [
  '*,::after,::before,::backdrop,::file-selector-button{box-sizing:border-box;margin:0;padding:0;border:0 solid}',
  `html,:host{line-height:1.5;-webkit-text-size-adjust:100%;tab-size:4;font-family:${FONT_SANS};font-feature-settings:var(--default-font-feature-settings,normal);font-variation-settings:var(--default-font-variation-settings,normal);-webkit-tap-highlight-color:transparent}`,
  'hr{height:0;color:inherit;border-top-width:1px}',
  'abbr:where([title]){-webkit-text-decoration:underline dotted;text-decoration:underline dotted}',
  'h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}',
  'a{color:inherit;-webkit-text-decoration:inherit;text-decoration:inherit}',
  'b,strong{font-weight:bolder}',
  `code,kbd,samp,pre{font-family:${FONT_MONO};font-feature-settings:var(--default-mono-font-feature-settings,normal);font-variation-settings:var(--default-mono-font-variation-settings,normal);font-size:1em}`,
  'small{font-size:80%}',
  'sub,sup{font-size:75%;line-height:0;position:relative;vertical-align:baseline}',
  'sub{bottom:-.25em}',
  'sup{top:-.5em}',
  'table{text-indent:0;border-color:inherit;border-collapse:collapse}',
  ':-moz-focusring:where(:not(iframe)){outline:auto}',
  'progress{vertical-align:baseline}',
  'summary{display:list-item}',
  'ol,ul,menu{list-style:none}',
  'img,svg,video,canvas,audio,iframe,embed,object{display:block;vertical-align:middle}',
  'img,video{max-width:100%;height:auto}',
  'button,input,select,optgroup,textarea,::file-selector-button{font:inherit;font-feature-settings:inherit;font-variation-settings:inherit;letter-spacing:inherit;color:inherit;border-radius:0;background-color:transparent;opacity:1}',
  ':where(select:is([multiple],[size])) optgroup{font-weight:bolder}',
  ':where(select:is([multiple],[size])) optgroup option{padding-inline-start:20px}',
  '::file-selector-button{margin-inline-end:4px}',
  '::placeholder{opacity:1}',
  '@supports (not (-webkit-appearance:-apple-pay-button)) or (contain-intrinsic-size:1px){::placeholder{color:color-mix(in oklab,currentcolor 50%,transparent)}}',
  'textarea{resize:vertical}',
  '::-webkit-search-decoration{-webkit-appearance:none}',
  '::-webkit-date-and-time-value{min-height:1lh;text-align:inherit}',
  '::-webkit-datetime-edit{display:inline-flex}',
  '::-webkit-datetime-edit-fields-wrapper{padding:0}',
  '::-webkit-datetime-edit,::-webkit-datetime-edit-year-field,::-webkit-datetime-edit-month-field,::-webkit-datetime-edit-day-field,::-webkit-datetime-edit-hour-field,::-webkit-datetime-edit-minute-field,::-webkit-datetime-edit-second-field,::-webkit-datetime-edit-millisecond-field,::-webkit-datetime-edit-meridiem-field{padding-block:0}',
  '::-webkit-calendar-picker-indicator{line-height:1}',
  ':-moz-ui-invalid{box-shadow:none}',
  "button,input:where([type='button'],[type='reset'],[type='submit']),::file-selector-button{appearance:button}",
  '::-webkit-inner-spin-button,::-webkit-outer-spin-button{height:auto}',
  "[hidden]:where(:not([hidden='until-found'])){display:none!important}",
].join('');

/**
 * Layer order first, then the reset in `@layer base` — prepended to every published stylesheet.
 * The base layer ends with the text-direction rule (block-parts DESIGN §2.11), the same one the
 * canvas frame injects, so a published RTL page keeps an English line's full stop at its end.
 */
// ── block-parts (2026-10-06) ──
export const STATIC_BASE_CSS = `@layer properties,theme,base,components,utilities;\n@layer base{${PREFLIGHT}${TEXT_BIDI_CSS}}`;
// ── /block-parts ──
