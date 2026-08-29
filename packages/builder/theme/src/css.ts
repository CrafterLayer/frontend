import {
  CHROME_TOKENS,
  TOKEN_PREFIX,
  type ChromeTheme,
  type ChromeThemeOverride,
} from './contract';
import {
  densities,
  fontSize,
  fontWeight,
  lineHeight,
  motion,
  borderWidth,
  control,
  measure,
  radius,
  space,
  type DensityName,
  type ShellMetrics,
} from './tokens/layout';

/**
 * The stylesheet is DERIVED, never hand-kept. `chrome.css` is a checked-in file
 * so a consumer can import it with no build step, and `css.test.ts` asserts the
 * file equals what these functions produce — so the two physically cannot
 * disagree, and a token added in TypeScript that never reached CSS fails a test
 * instead of shipping as a silent fallback.
 */

/**
 * The generated file is formatted by the repository's Prettier run like every
 * other file, so the generator has to emit what Prettier would: the exact
 * indent for the nesting level, and values short enough not to be wrapped.
 * Otherwise `pnpm format` and the drift gate fight each other forever.
 */
function declarations(
  entries: readonly (readonly [string, string])[],
  prefix: string,
  indent = '  ',
): string {
  return entries.map(([name, value]) => `${indent}${prefix}${name}: ${value};`).join('\n');
}

/** A theme's declarations, emitted in CONTRACT order so diffs stay readable. */
export function themeDeclarations(theme: ChromeTheme, indent = '  '): string {
  return declarations(
    CHROME_TOKENS.map((token) => [token, theme[token]] as const),
    TOKEN_PREFIX,
    indent,
  );
}

export function scaleDeclarations(): string {
  const groups: (readonly [string, Readonly<Record<string, string>>])[] = [
    ['space-', space],
    ['radius-', radius],
    ['border-', borderWidth],
    ['control-', control],
    ['measure-', measure],
    ['font-size-', fontSize],
    ['font-weight-', fontWeight],
    ['line-height-', lineHeight],
    ['', motion],
  ];
  return groups
    .map(([group, scale]) =>
      declarations(
        Object.entries(scale).map(([key, value]) => [`${group}${key}`, value] as const),
        TOKEN_PREFIX,
      ),
    )
    .join('\n');
}

export function metricsDeclarations(metrics: ShellMetrics): string {
  return declarations(
    Object.entries(metrics).map(([key, value]) => [key, value] as const),
    TOKEN_PREFIX,
  );
}

/**
 * Turn a theme (or a partial override) into inline-style pairs a host can hand
 * to React or set with `setProperty`. This is the runtime half of "override at
 * any time": no rebuild, no stylesheet surgery, just custom properties on an
 * element — and because they cascade, overriding on ANY ancestor re-themes
 * everything beneath it, including portalled floating chrome that shares the
 * host document.
 */
export function themeStyle(theme: ChromeTheme | ChromeThemeOverride): Record<string, string> {
  const style: Record<string, string> = {};
  for (const [token, value] of Object.entries(theme)) {
    if (value !== undefined) {
      style[`${TOKEN_PREFIX}${token}`] = value;
    }
  }
  return style;
}

/** The same pairs as CSS text, for a `style` attribute or a `<style>` block. */
export function themeStyleText(theme: ChromeTheme | ChromeThemeOverride): string {
  return Object.entries(themeStyle(theme))
    .map(([name, value]) => `${name}: ${value}`)
    .join('; ');
}

/**
 * EVERY name the stylesheet defines — semantic tokens, the scales, and the
 * shell's metrics.
 *
 * `CHROME_TOKENS` alone was not the whole answer: it lists what a THEME may
 * re-point, while a component also reads `--bldr-space-md`, `--bldr-radius-lg`
 * and `--bldr-control-height`, which the stylesheet defines but no theme
 * chooses. The coverage gate checked only the first list, so a component could
 * reach for `--bldr-space-999` and nothing would notice. This is the set the
 * gate actually needs: what is DEFINED, not what is themeable.
 */
export function definedTokenNames(): readonly string[] {
  const scaleNames = [
    ...Object.keys(space).map((key) => `space-${key}`),
    ...Object.keys(radius).map((key) => `radius-${key}`),
    ...Object.keys(borderWidth).map((key) => `border-${key}`),
    ...Object.keys(control).map((key) => `control-${key}`),
    ...Object.keys(measure).map((key) => `measure-${key}`),
    ...Object.keys(fontSize).map((key) => `font-size-${key}`),
    ...Object.keys(fontWeight).map((key) => `font-weight-${key}`),
    ...Object.keys(lineHeight).map((key) => `line-height-${key}`),
    ...Object.keys(motion),
  ];
  const metricNames = Object.keys(densities.comfortable);
  return [...CHROME_TOKENS, ...scaleNames, ...metricNames];
}

export interface StylesheetInput {
  readonly light: ChromeTheme;
  readonly dark: ChromeTheme;
  readonly density?: DensityName;
}

/**
 * The complete stylesheet, in the three-state shape the platform actually has:
 *
 *   `:root`                                     the full LIGHT palette
 *   `@media (prefers-color-scheme: dark)`       guarded so an explicit light
 *     `:root:not([data-bldr-theme='light'])`    choice beats a dark OS
 *   `[data-bldr-theme='dark']`                  so the toggle wins both ways
 *
 * Each state also declares `color-scheme`, so native controls inherit the
 * same light or dark user-agent palette as the editor chrome around them.
 *
 * Every token is defined in the bare `:root` block. A token whose only
 * definition sits inside a media query is undefined for the default "system"
 * setting, which stamps no attribute at all — the classic unreadable-theme bug.
 *
 * The explicit-choice blocks are keyed on the ATTRIBUTE ALONE, not on
 * `:root[…]`. They used to require the document element, and `BuilderTheme`
 * stamps its own element — so in a real browser the attribute flipped to
 * `dark` and every token stayed light: the rule matched nothing. Keying on the
 * attribute keeps the document-element case working (an `<html>` carrying the
 * attribute still matches) and makes the intended one work: a builder can be
 * dark inside a light page, which is the entire reason the editor's theme is
 * separate from the page's.
 */
export function buildStylesheet({ light, dark, density = 'comfortable' }: StylesheetInput): string {
  const metrics = densities[density];
  const otherDensity: DensityName = density === 'comfortable' ? 'compact' : 'comfortable';

  return `/* GENERATED by @craftkit/builder-theme — edit the themes, not this file.
   \`pnpm --filter @craftkit/builder-theme test\` fails if the two disagree. */

:root {
  color-scheme: light;

${themeDeclarations(light)}

${scaleDeclarations()}

${metricsDeclarations(metrics)}
}

/* The default "system" setting stamps nothing, so only the media query
   separates light from dark there; the :not() lets an explicit light choice
   win over a dark operating system. */
@media (prefers-color-scheme: dark) {
  :root:not([data-bldr-theme='light']) {
    color-scheme: dark;

${themeDeclarations(dark, '    ')}
  }
}

/* An explicit choice wins in both directions. Keyed on the attribute alone so
   it applies to whichever element carries it — the document, or the builder's
   own root, which is where \`BuilderTheme\` puts it. */
[data-bldr-theme='dark'] {
  color-scheme: dark;

${themeDeclarations(dark)}
}

[data-bldr-theme='light'] {
  color-scheme: light;

${themeDeclarations(light)}
}

/* Density is a layout decision, independent of colour: a host may run the dark
   theme comfortably or the light theme tight. */
[data-bldr-density='${otherDensity}'] {
${metricsDeclarations(densities[otherDensity])}
}

/* The builder's own surface honours the tokens it publishes. */
.bldr-root {
  background: var(${TOKEN_PREFIX}ground);
  color: var(${TOKEN_PREFIX}panel-text);
  font-family: var(${TOKEN_PREFIX}font);
}

/* One focus ring for the entire product. A component may re-colour it through
   the token; none may remove it. */
.bldr-root :focus-visible {
  outline: var(${TOKEN_PREFIX}focus-ring-width) solid var(${TOKEN_PREFIX}focus-ring);
  outline-offset: var(${TOKEN_PREFIX}focus-ring-offset);
}

@media (prefers-reduced-motion: reduce) {
  .bldr-root *,
  .bldr-root *::before,
  .bldr-root *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`;
}

/**
 * The utility layer — Tailwind's principle, this theme's values.
 *
 * Tailwind's real idea is not its class names; it is that spacing, type and
 * colour come from ONE scale and a component composes rather than measures.
 * The reason this repository could not simply adopt Tailwind is that Tailwind
 * resolves at BUILD time, and the whole promise here is that a host re-points a
 * token at RUNTIME and the entire editor follows. So the classes are generated
 * from the same scales the stylesheet is, and every one of them resolves
 * through a custom property: `.bldr-p-md` is `padding: var(--bldr-space-md)`,
 * never `padding: 8px`. Re-point the token and every utility moves with it.
 *
 * Two rules that are not negotiable here:
 *
 *  - LOGICAL properties only. This editor mirrors, so a `pl-` class that means
 *    "left" would be wrong in half the world's languages. The axes are inline
 *    and block, which is also why there is no `-l`/`-r` pair to get wrong.
 *  - No arbitrary values. There is no `.bldr-p-[13px]` escape hatch, because
 *    the moment one exists the scale stops being the single source and the
 *    override promise has a hole in it.
 */
function utilityRules(): string {
  const rules: string[] = [];
  const emit = (name: string, declarations: string): void => {
    rules.push(`.bldr-${name} {\n${declarations}\n}`);
  };

  for (const step of Object.keys(space)) {
    const value = `var(${TOKEN_PREFIX}space-${step})`;
    emit(`p-${step}`, `  padding: ${value};`);
    emit(`pi-${step}`, `  padding-inline: ${value};`);
    emit(`pb-${step}`, `  padding-block: ${value};`);
    emit(`gap-${step}`, `  gap: ${value};`);
    emit(`gap-i-${step}`, `  column-gap: ${value};`);
    emit(`gap-b-${step}`, `  row-gap: ${value};`);
    emit(`mi-${step}`, `  margin-inline: ${value};`);
    emit(`mb-${step}`, `  margin-block: ${value};`);
  }

  for (const step of Object.keys(radius)) {
    emit(`radius-${step}`, `  border-radius: var(${TOKEN_PREFIX}radius-${step});`);
  }

  for (const step of Object.keys(fontSize)) {
    emit(`text-${step}`, `  font-size: var(${TOKEN_PREFIX}font-size-${step});`);
  }

  for (const step of Object.keys(fontWeight)) {
    emit(`weight-${step}`, `  font-weight: var(${TOKEN_PREFIX}font-weight-${step});`);
  }

  for (const step of Object.keys(lineHeight)) {
    emit(`leading-${step}`, `  line-height: var(${TOKEN_PREFIX}line-height-${step});`);
  }

  // Colour utilities carry the ROLE, not the hue: `.bldr-bg-panel`, never
  // `.bldr-bg-slate-25`. A component that names a hue cannot be re-themed.
  const surfaces = [
    'surface',
    'surface-raised',
    'surface-sunken',
    'panel',
    'panel-control',
    'rail',
    'ground',
    'accent',
    'accent-soft',
    'danger-soft',
    'warning-soft',
    'success-soft',
  ];
  for (const role of surfaces) {
    emit(`bg-${role}`, `  background-color: var(${TOKEN_PREFIX}${role});`);
  }

  const inks = [
    'panel-text',
    'panel-text-soft',
    'panel-muted',
    'rail-text',
    'rail-text-strong',
    'accent',
    'accent-text',
    'danger',
    'warning',
    'success',
  ];
  for (const role of inks) {
    emit(`fg-${role}`, `  color: var(${TOKEN_PREFIX}${role});`);
  }

  for (const role of ['panel-border', 'panel-border-strong', 'surface-border', 'accent-ring']) {
    emit(`border-${role}`, `  border-color: var(${TOKEN_PREFIX}${role});`);
  }

  for (const role of ['raised', 'floating', 'overlay']) {
    emit(`shadow-${role}`, `  box-shadow: var(${TOKEN_PREFIX}shadow-${role});`);
  }

  emit('font-sans', `  font-family: var(${TOKEN_PREFIX}font);`);
  emit(
    'font-mono',
    `  font-family: var(${TOKEN_PREFIX}font-mono);\n  font-variant-numeric: tabular-nums;`,
  );
  emit(
    'hit-target',
    `  min-block-size: var(${TOKEN_PREFIX}hit-target-min);\n  min-inline-size: var(${TOKEN_PREFIX}hit-target-min);`,
  );

  return rules.join('\n\n');
}

/** The generated utility stylesheet. */
export function buildUtilities(): string {
  return `/* GENERATED by @craftkit/builder-theme — edit the scales, not this file.
   \`pnpm --filter @craftkit/builder-theme test\` fails if the two disagree.

   Tailwind's principle with this theme's values: one scale, composed rather
   than measured — but every class resolves through a custom property, so a
   host that re-points a token at runtime moves every utility with it. */

${utilityRules()}
`;
}
