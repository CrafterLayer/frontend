/**
 * The Tailwind plugins pages are styled with, and the design tokens they wear.
 *
 * Three packages raise what a generated section can look like without a line of region CSS:
 * `tw-animate-css` (`animate-in fade-in slide-in-from-bottom-4`, the shadcn entrance vocabulary),
 * `@tailwindcss/typography` (`prose` for long-form text) and `@tailwindcss/forms` (`form-input`,
 * `form-select`, `form-checkbox`… for real fields). This module is the one place they are named,
 * as two generated stylesheets.
 *
 * ## Two layers, because of what each one costs a first load
 *
 * - The ANIMATE layer ({@link buildTailwindAnimateCss}, `tailwind-animate.css`) goes everywhere:
 *   the static sheet behind the editor's door, the in-page compiler and the export. It is small,
 *   and its reduced-motion guard has to exist wherever an entrance class can render.
 * - The CONTENT layer ({@link buildTailwindContentCss}, `tailwind-content.css`) — typography and
 *   forms — is generated per page by the compiler that knows which classes the page uses: the
 *   in-page compiler on the canvas and in preview (and as the door's oracle), `compileFor` in the
 *   export. Its per-class output is large (one `prose` is ~20 KB of CSS, each `form-*` ~2 KB),
 *   and a static build would pay for it on every editor load — `prose` is an ordinary word in
 *   this codebase's comments, so the source scan would generate it whether a page used it or not
 *   (measured: +3 to +5 KB gzip against a first-load budget with under 2 KB to spare). The file is
 *   exported for a host that wants the layer statically anyway.
 *
 * ## Why generated stylesheets, like the token bridge
 *
 * A static build reads the files from disk; the in-page compiler cannot import a stylesheet as
 * text without a bundler-specific suffix, so it takes the same text from the generators. A test
 * holds each file equal to its generator.
 *
 * ## Why every colour is `--theme(…)`
 *
 * Both content plugins ship literal palettes (typography's grays, forms' blue-600 focus).
 * `--theme()` resolves through the token bridge, whose `@theme inline` turns
 * `--theme(--color-accent)` into `var(--t-accent, #…)`: a re-themed site re-themes its prose and
 * its fields, and a page with no theme applied still has the default theme's colours.
 *
 * ## Why the overrides are shaped the way they are
 *
 * An `@utility prose` beside the plugin's own `prose` is emitted as a second rule, and Tailwind
 * orders the two by their properties (lowest property index first, then most properties first).
 * Each override therefore declares only properties its plugin rule ALSO declares, which sorts it
 * after the plugin's rule — so it wins — and, having a real property, before the plugin's
 * custom-property-only colour modifiers (`prose-invert`), which therefore still win over it. A
 * one-property utility on the element (`rounded-full`, `text-success`) sorts after both.
 * `plugin-bridge.test.ts` pins each of those orders against the real compiler.
 *
 * ## The animate layer's two unlayered rules
 *
 * - tw-animate's slide distances multiply `var(--spacing)`, which this bridge binds INLINE, so
 *   the variable is never emitted and a `slide-in-from-bottom-4` would travel nothing. The
 *   sliding element gets `--spacing` itself, resolved through the token like `p-4` is.
 * - A person who asked their system to reduce motion gets no entrance at all: `animation: none`
 *   on anything carrying an enter or exit class, under any variant. Unlayered, so no utility
 *   order can bring the movement back (motion-css.ts makes the same choice for presets).
 */

/** The plugin modules a `@plugin` in {@link buildTailwindContentCss} names. */
export const TAILWIND_PLUGIN_MODULES = ['@tailwindcss/typography', '@tailwindcss/forms'] as const;

export type TailwindPluginModule = (typeof TAILWIND_PLUGIN_MODULES)[number];

/** The plugin stylesheet an `@import` in {@link buildTailwindAnimateCss} names. */
export const TW_ANIMATE_STYLESHEET = 'tw-animate-css';

const header = (summary: string): string => `/*
  GENERATED FILE — do not edit by hand.

  Produced by packages/builder/renderer/src/tailwind/plugin-bridge.ts and held equal to its
  generator by plugin-bridge.test.ts. Edit the generator.

${summary}
*/`;

const ANIMATE_HEADER =
  header(`  tw-animate-css (animate-in, fade-in, zoom-in-95, slide-in-from-*): the entrance vocabulary
  every page carries, its slide distances in the site's spacing step, and no entrance at all
  under reduced motion. Import it after the token bridge.`);

const CONTENT_HEADER =
  header(`  Typography (prose) and forms (form-*, class strategy: no global input reset) in the site's
  tokens. The in-page compiler and the export generate it per page; a static entry may import it
  after the token bridge, at the cost of every class it carries.`);

/** Text fields: the four classes `@tailwindcss/forms` styles as one. */
const FIELD_CLASSES = ['form-input', 'form-textarea', 'form-select', 'form-multiselect'] as const;

/** Checkable controls, drawn by the plugin with `currentColor` once checked. */
const CHECK_CLASSES = ['form-checkbox', 'form-radio'] as const;

const PROSE = `/*
  prose in the site's colours. color is restated (the plugin sets it too) only to sort this rule
  between the plugin's prose and its colour modifiers; see plugin-bridge.ts.
*/
@utility prose {
  color: var(--tw-prose-body);
  --tw-prose-body: --theme(--color-text);
  --tw-prose-headings: --theme(--color-text);
  --tw-prose-lead: --theme(--color-text-muted);
  --tw-prose-links: --theme(--color-accent);
  --tw-prose-bold: --theme(--color-text);
  --tw-prose-counters: --theme(--color-text-muted);
  --tw-prose-bullets: color-mix(in oklab, --theme(--color-text-muted) 60%, transparent);
  --tw-prose-hr: color-mix(in oklab, --theme(--color-text) 12%, transparent);
  --tw-prose-quotes: --theme(--color-text);
  --tw-prose-quote-borders: --theme(--color-accent);
  --tw-prose-captions: --theme(--color-text-muted);
  --tw-prose-kbd: --theme(--color-text);
  --tw-prose-kbd-shadows: color-mix(in oklab, currentColor 10%, transparent);
  --tw-prose-code: --theme(--color-text);
  --tw-prose-pre-code: --theme(--color-text-inverse);
  --tw-prose-pre-bg: --theme(--color-surface-inverse);
  --tw-prose-th-borders: color-mix(in oklab, --theme(--color-text) 20%, transparent);
  --tw-prose-td-borders: color-mix(in oklab, --theme(--color-text) 10%, transparent);
  --tw-prose-invert-body: --theme(--color-text-inverse);
  --tw-prose-invert-headings: --theme(--color-text-inverse);
  --tw-prose-invert-lead: color-mix(in oklab, --theme(--color-text-inverse) 80%, transparent);
  --tw-prose-invert-links: --theme(--color-text-inverse);
  --tw-prose-invert-bold: --theme(--color-text-inverse);
  --tw-prose-invert-counters: color-mix(in oklab, --theme(--color-text-inverse) 70%, transparent);
  --tw-prose-invert-bullets: color-mix(in oklab, --theme(--color-text-inverse) 45%, transparent);
  --tw-prose-invert-hr: color-mix(in oklab, --theme(--color-text-inverse) 20%, transparent);
  --tw-prose-invert-quotes: --theme(--color-text-inverse);
  --tw-prose-invert-quote-borders: --theme(--color-accent);
  --tw-prose-invert-captions: color-mix(in oklab, --theme(--color-text-inverse) 70%, transparent);
  --tw-prose-invert-kbd: --theme(--color-text-inverse);
  --tw-prose-invert-kbd-shadows: color-mix(in oklab, currentColor 10%, transparent);
  --tw-prose-invert-code: --theme(--color-text-inverse);
  --tw-prose-invert-pre-code: --theme(--color-text-inverse);
  --tw-prose-invert-pre-bg: color-mix(in oklab, --theme(--color-text) 50%, transparent);
  --tw-prose-invert-th-borders: color-mix(in oklab, --theme(--color-text-inverse) 30%, transparent);
  --tw-prose-invert-td-borders: color-mix(in oklab, --theme(--color-text-inverse) 15%, transparent);
}`;

/*
  A field wears the section it sits in: transparent, its border and placeholder mixed from the
  inherited text colour (so a field on a bg-surface-inverse band stays readable), the site's
  small radius, and the accent for focus. The select's chevron sits at the inline end, so an
  Arabic page draws it on the left.
*/
const PLACEHOLDER = `
  &::placeholder {
    color: color-mix(in oklab, currentColor 55%, transparent);
  }`;

const RTL_CHEVRON = `
  &:where(:dir(rtl), [dir='rtl'], [dir='rtl'] *) {
    background-position: left 0.5rem center;
    padding-right: 0.75rem;
    padding-left: 2.5rem;
  }`;

const field = (name: (typeof FIELD_CLASSES)[number]): string => `@utility ${name} {
  background-color: transparent;
  border-color: color-mix(in oklab, currentColor 30%, transparent);
  border-radius: --theme(--radius-sm);
  &:focus {
    --tw-ring-offset-color: --theme(--color-surface);
    --tw-ring-color: --theme(--color-accent);
    border-color: --theme(--color-accent);
  }${name === 'form-input' || name === 'form-textarea' ? PLACEHOLDER : ''}${name === 'form-select' ? RTL_CHEVRON : ''}
}`;

const check = (name: (typeof CHECK_CLASSES)[number]): string => `@utility ${name} {
  color: --theme(--color-accent);
  background-color: transparent;
  border-color: color-mix(in oklab, currentColor 55%, transparent);
  &:focus {
    --tw-ring-offset-color: --theme(--color-surface);
    --tw-ring-color: --theme(--color-accent);
  }
}`;

const FORMS = `/* Fields and checks in the site's colours, without the plugin's global reset. */
${FIELD_CLASSES.map(field).join('\n')}
${CHECK_CLASSES.map(check).join('\n')}`;

const ANIMATE_GUARDS = `/* tw-animate multiplies var(--spacing), which the token bridge never emits (it is inline). */
:where([class*='slide-in-from-'], [class*='slide-out-to-']) {
  --spacing: --theme(--spacing);
}

/* Reduced motion: no entrance or exit at all, whatever variant asked for one. */
@media (prefers-reduced-motion: reduce) {
  :where([class*='animate-in'], [class*='animate-out']) {
    animation: none;
  }
}`;

/** The animate layer: `tailwind-animate.css`, in every sheet a page can render with. */
export function buildTailwindAnimateCss(): string {
  return `${ANIMATE_HEADER}

@import '${TW_ANIMATE_STYLESHEET}';

${ANIMATE_GUARDS}
`;
}

/** The content layer: `tailwind-content.css`, generated per page by the live compiler and export. */
export function buildTailwindContentCss(): string {
  return `${CONTENT_HEADER}

@plugin '${TAILWIND_PLUGIN_MODULES[0]}';
@plugin '${TAILWIND_PLUGIN_MODULES[1]}' {
  strategy: 'class';
}

${PROSE}

${FORMS}
`;
}
