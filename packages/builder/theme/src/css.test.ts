import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CHROME_TOKENS, STAGE_TOKENS, TOKEN_PREFIX, type ChromeTokenName } from './contract';
import { buildStylesheet, buildUtilities, themeStyle, themeStyleText } from './css';
import { darkChromeTheme, lightChromeTheme } from './themes';
import { READING_ROLES } from './tokens/layout';

const CSS_PATH = fileURLToPath(new URL('./css/chrome.css', import.meta.url));
const UTILITIES_PATH = fileURLToPath(new URL('./css/utilities.css', import.meta.url));

function generated(): string {
  return buildStylesheet({ light: lightChromeTheme, dark: darkChromeTheme });
}

/**
 * The body of the first block `header` opens, brace-matched so a nested block
 * stays inside its parent. A `\n` at the start of `header` pins it to the top
 * level: `:lang(ar)` occurs twice in the sheet, once bare and once inside the
 * coarse-pointer query, and the two carry different values.
 */
function blockOf(css: string, header: string): string {
  const start = css.indexOf(`${header} {`);
  if (start === -1) {
    throw new Error(`the stylesheet opens no block with ${JSON.stringify(header)}`);
  }
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === '{') {
      depth += 1;
    } else if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return css.slice(open + 1, index);
      }
    }
  }
  throw new Error(`the block opened by ${JSON.stringify(header)} never closes`);
}

/** `name → value` for every `--bldr-*` a block body declares, prefix dropped. */
function declared(body: string): Map<string, string> {
  const pattern = new RegExp(`${TOKEN_PREFIX}([a-z0-9-]+):\\s*([^;]+);`, 'g');
  return new Map([...body.matchAll(pattern)].map((match) => [match[1] ?? '', match[2] ?? '']));
}

/** The four places a colour token must live, keyed by the state each serves. */
function themeBlocks(css: string): Readonly<Record<string, Map<string, string>>> {
  return {
    'bare :root (light, and the default "system" setting)': declared(blockOf(css, '\n:root')),
    'dark operating system': declared(
      blockOf(
        blockOf(css, '\n@media (prefers-color-scheme: dark)'),
        ":root:not([data-bldr-theme='light'])",
      ),
    ),
    "explicit [data-bldr-theme='dark']": declared(blockOf(css, "\n[data-bldr-theme='dark']")),
    "explicit [data-bldr-theme='light']": declared(blockOf(css, "\n[data-bldr-theme='light']")),
  };
}

/**
 * SPEC §2.1, the panel's palette as the design panel fixed it. Existing tokens
 * are listed beside the new ones on purpose: the agent panel is designed
 * against these exact values, so a ramp nudge that moves any of them changes a
 * contrast pair the spec measured, and must be a decision rather than a drift.
 */
const PANEL_PALETTE: readonly (readonly [ChromeTokenName, string, string])[] = [
  ['panel', '#fbfbfd', '#0e1116'],
  ['surface', '#ffffff', '#171b24'],
  ['surface-tint', '#eceef3', '#1f2530'],
  ['surface-hover', 'rgb(15 23 42 / 6%)', 'rgb(255 255 255 / 8%)'],
  ['panel-text', '#171b24', '#eef0f5'],
  ['panel-text-soft', '#4c5568', '#cbd0da'],
  ['panel-muted', '#6b7488', '#98a0b0'],
  ['panel-border', '#e2e5ec', '#242a36'],
  ['panel-border-strong', '#838c9d', '#5d6779'],
  ['accent', '#5b5bd6', '#8585e2'],
  ['accent-strong', '#4a4ac2', '#a9a9ec'],
  ['accent-text', '#ffffff', '#0e1116'],
  ['accent-soft', '#eeeefc', '#22224d'],
  ['accent-ring', '#c7c7f4', '#3e3ea0'],
  ['progress-track', '#c9ced9', '#3a4250'],
  ['content-outline', 'rgb(15 23 42 / 18%)', 'rgb(255 255 255 / 20%)'],
  ['danger', '#b91c1c', '#ef4444'],
  ['warning', '#b45309', '#f59e0b'],
];

/** SPEC §2.1 stage tokens: one value, whatever the editor's theme. */
const STAGE_VALUES: Readonly<Record<(typeof STAGE_TOKENS)[number], string>> = {
  'stage-accent': '#5b5bd6',
  'stage-on-accent': '#ffffff',
  'stage-halo': '#ffffff',
  'stage-veil': 'rgb(246 247 250 / 94%)',
  'stage-ink': '#4c5568',
  'stage-danger': '#b91c1c',
  'stage-box-padding': 'rgb(34 197 94 / 22%)',
  'stage-box-margin': 'rgb(249 115 22 / 22%)',
  'stage-guide': '#ec4899',
  'stage-grid-track': 'rgb(91 91 214 / 8%)',
};

/** SPEC §2.2 reading scale, `[role, latin size, latin line, arabic size, arabic line]`. */
const READING: readonly (readonly [string, string, string, string, string])[] = [
  ['figure', '11px', '16px', '12px', '18px'],
  ['meta', '12px', '16px', '13px', '20px'],
  ['read', '13px', '20px', '14px', '22px'],
  ['name', '14px', '20px', '15px', '22px'],
  ['input', '14px', '20px', '15px', '24px'],
  ['lead', '16px', '24px', '18px', '30px'],
];

const LATIN_STACK =
  "'IBM Plex Sans', 'IBM Plex Sans Arabic', system-ui, -apple-system, 'Segoe UI', sans-serif";
const ARABIC_STACK =
  "'IBM Plex Sans Arabic', 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif";

/** Latin text inside an Arabic subtree: any element whose own lang is not Arabic. */
const LATIN_ISLAND = ':lang(ar) [lang]:not(:lang(ar))';

describe('the stylesheet is derived, never maintained', () => {
  it('chrome.css equals what the themes generate', () => {
    // The shipped file is a build artifact kept in the tree so consumers need
    // no build step. This test is what makes that safe: add a token in
    // TypeScript and forget to regenerate, and you fail HERE rather than
    // shipping a component that silently falls back.
    //
    // Regenerate with:  UPDATE_THEME_CSS=1 pnpm --filter @craftkit/builder-theme test
    const expected = generated();
    if (process.env['UPDATE_THEME_CSS'] === '1') {
      writeFileSync(CSS_PATH, expected, 'utf8');
    }
    expect(readFileSync(CSS_PATH, 'utf8')).toBe(expected);
  });

  it('keeps the utility sheet derived from the scales, never hand-written', () => {
    // Same law as the stylesheet above: the classes are a PROJECTION of the
    // scales, so a hand-edit here would make the scale true in two places and
    // eventually in neither.
    //
    // Regenerate with:  UPDATE_THEME_CSS=1 pnpm --filter @craftkit/builder-theme test
    const expected = buildUtilities();
    if (process.env['UPDATE_THEME_CSS'] === '1') {
      writeFileSync(UTILITIES_PATH, expected, 'utf8');
    }
    expect(readFileSync(UTILITIES_PATH, 'utf8')).toBe(expected);
  });

  it('resolves every utility through a custom property, never a literal', () => {
    // This is the whole reason the project could not adopt Tailwind: Tailwind
    // resolves at build time, and the promise here is a host re-pointing a token
    // at RUNTIME. A single literal in this sheet is a hole in that promise.
    const css = buildUtilities();
    const declarations = css
      .split('\n')
      .filter((line) => line.startsWith('  ') && line.includes(':'))
      .filter((line) => !line.trimStart().startsWith('*'));

    expect(declarations.length).toBeGreaterThan(60);
    // Keywords are fine — `tabular-nums` is not a measurement and there is
    // nothing to re-point. What must never appear is a VALUE: a length, or a
    // colour. Those are the things a host re-themes.
    for (const declaration of declarations) {
      expect(declaration).not.toMatch(/\b\d+(\.\d+)?(px|rem|em)\b/);
      expect(declaration).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/);
    }
    // And the sheet is overwhelmingly custom properties, not keywords.
    const throughTokens = declarations.filter((line) => line.includes('var(--bldr-'));
    expect(throughTokens.length).toBeGreaterThan(declarations.length - 5);
  });

  it('offers no physical-direction utility, because this editor mirrors', () => {
    const css = buildUtilities();
    // `.bldr-pl-*` would be wrong in half the world's languages; the axes are
    // inline and block, which is why the pair cannot be got wrong.
    expect(css).not.toMatch(/\.bldr-(p|m)[lr]-/);
    expect(css).toMatch(/\.bldr-pi-/);
    expect(css).toMatch(/\.bldr-pb-/);
  });

  it('defines EVERY contract token in the bare :root block', () => {
    // The default "system" theme setting stamps no attribute at all, so a token
    // whose only definition lives inside a media query or an attribute
    // selector is undefined for most viewers — the classic half-themed page.
    const css = generated();
    const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('\n}'));
    for (const token of CHROME_TOKENS) {
      expect(rootBlock).toContain(`${TOKEN_PREFIX}${token}:`);
    }
  });

  it('emits no line Prettier would re-wrap, so the drift gate and `pnpm format` agree', () => {
    /*
      The sheet is checked in and formatted like any other file. A font stack
      naming both Plex families runs past the 100-column print width on one
      line; if the generator left it there, Prettier would wrap it and this
      file's drift gate would fail on the formatted copy, forever.
    */
    const css = generated();
    const long = css.split('\n').filter((line) => line.length > 100);
    expect(long).toEqual([]);
    // Non-vacuous: the wrap actually happened, rather than the stack shrinking.
    expect(css).toContain(`  ${TOKEN_PREFIX}font:\n    ${LATIN_STACK};`);
  });

  it('lets an explicit light choice beat a dark operating system', () => {
    const css = generated();
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain(":root:not([data-bldr-theme='light'])");
  });

  it('declares the native-control palette in every theme state', () => {
    const css = generated();
    expect(css).toContain(':root {\n  color-scheme: light;');
    expect(css).toContain(":root:not([data-bldr-theme='light']) {\n    color-scheme: dark;");
    expect(css).toContain("[data-bldr-theme='dark'] {\n  color-scheme: dark;");
    expect(css).toContain("[data-bldr-theme='light'] {\n  color-scheme: light;");
  });

  it('keys the explicit choice on the attribute, not on the document element', () => {
    // This gate exists because its predecessor asserted `:root[data-bldr-theme]`
    // and passed for as long as the product was broken. `BuilderTheme` stamps
    // its OWN element, so a `:root`-anchored rule matched nothing: the attribute
    // flipped to dark in the browser and every token stayed light. A selector
    // is the shape of a claim; only the browser can check the claim, which
    // `colorScheme.stories.tsx` does by reading the resolved color scheme.
    const css = generated();
    expect(css).toContain("\n[data-bldr-theme='dark'] {");
    expect(css).toContain("\n[data-bldr-theme='light'] {");
    expect(css).not.toContain(":root[data-bldr-theme='dark']");
    expect(css).toContain('\n[data-bldr-density=');
  });

  it('carries one focus ring for the whole product, and honours reduced motion', () => {
    const css = generated();
    expect(css).toContain('.bldr-root :focus-visible');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('lets a composite control DELEGATE the ring, and never simply drop it', () => {
    /*
      The ring rule is a DESCENDANT selector, so it also lands on the inner
      surface of a control that is one thing to the person using it. Those
      surfaces opted out with an "outline: none" of their own — one class
      against this rule's two — and lost, so the rich-text field drew a ring
      around its wrapper AND a second one around the surface inside it.

      The escape hatch is declared rather than fought for. It matters that it
      can only ever mean "my wrapper draws it": there is no value of this
      attribute that removes the ring, which is why the product law survives
      the fix.
    */
    const css = generated();
    const rule = css.slice(css.indexOf('.bldr-root :focus-visible'));
    const selector = rule.slice(0, rule.indexOf('{')).trim();

    expect(selector).toBe(".bldr-root :focus-visible:not([data-bldr-focus-ring='delegated'])");

    // Non-vacuous: the sheet must still paint a real ring, not merely carry a
    // selector that excludes things.
    const body = rule.slice(rule.indexOf('{'), rule.indexOf('}'));
    expect(body).toContain(`var(${TOKEN_PREFIX}focus-ring-width) solid`);
    expect(body).toContain(`var(${TOKEN_PREFIX}focus-ring)`);
  });
});

describe('runtime override — the point of the package', () => {
  it('turns a PARTIAL override into custom properties, leaving the rest alone', () => {
    // A host re-brands by naming only what changes. Everything it does not
    // name keeps cascading from the stylesheet, which is why an override can
    // be three lines instead of a fork.
    const style = themeStyle({ accent: '#0f766e', 'accent-soft': '#ccfbf1' });
    expect(style).toEqual({
      '--bldr-accent': '#0f766e',
      '--bldr-accent-soft': '#ccfbf1',
    });
    expect(Object.keys(style)).toHaveLength(2);
  });

  it('emits a full theme as text for a style attribute', () => {
    const text = themeStyleText(lightChromeTheme);
    expect(text).toContain(`${TOKEN_PREFIX}accent: ${lightChromeTheme.accent}`);
    expect(text.split('; ')).toHaveLength(CHROME_TOKENS.length);
  });

  it('drops undefined entries rather than writing "undefined" into the DOM', () => {
    const style = themeStyle({ accent: '#0f766e', danger: undefined });
    expect(style).toEqual({ '--bldr-accent': '#0f766e' });
  });
});

describe('the agent panel tokens (design SPEC §2)', () => {
  it('declares every new colour token in the light, dark-media and both explicit theme blocks', () => {
    /*
      The bare :root alone is not enough. A token defined there but missing from
      the dark blocks keeps its LIGHT value under a dark theme: the bubble tint
      would stay #eceef3 on a #0e1116 panel, which is exactly the half-themed
      page this generator exists to make impossible.
    */
    const added: readonly ChromeTokenName[] = [
      'font-arabic',
      'surface-tint',
      'progress-track',
      'content-outline',
      ...STAGE_TOKENS,
    ];
    for (const [state, tokens] of Object.entries(themeBlocks(generated()))) {
      const missing = added.filter((token) => !tokens.has(token));
      expect({ state, missing }).toEqual({ state, missing: [] });
    }
  });

  it('paints the SPEC §2.1 palette exactly, in both themes and every theme state', () => {
    const blocks = themeBlocks(generated());
    const light = blocks['bare :root (light, and the default "system" setting)'];
    const explicitLight = blocks["explicit [data-bldr-theme='light']"];
    const dark = blocks["explicit [data-bldr-theme='dark']"];
    const darkMedia = blocks['dark operating system'];

    // Non-vacuous: the table is the spec's, not an empty loop.
    expect(PANEL_PALETTE.length).toBe(18);
    for (const [token, lightValue, darkValue] of PANEL_PALETTE) {
      expect({ token, light: light?.get(token) }).toEqual({ token, light: lightValue });
      expect({ token, light: explicitLight?.get(token) }).toEqual({ token, light: lightValue });
      expect({ token, dark: dark?.get(token) }).toEqual({ token, dark: darkValue });
      expect({ token, dark: darkMedia?.get(token) }).toEqual({ token, dark: darkValue });
    }
  });

  it('keeps every stage token one value in all four theme states', () => {
    /*
      Stage marks sit on the person's PAGE, not on the chrome: a light page stays
      light inside a dark editor, so a mark that followed the editor's theme would
      be tuned for the wrong ground. They are still declared in every block,
      because the contract requires every token in each one.
    */
    expect(STAGE_TOKENS).toHaveLength(10);
    for (const [state, tokens] of Object.entries(themeBlocks(generated()))) {
      for (const token of STAGE_TOKENS) {
        expect({ state, token, value: tokens.get(token) }).toEqual({
          state,
          token,
          value: STAGE_VALUES[token],
        });
      }
    }
  });

  it('names the two families: Latin first for the chrome, Arabic first for Arabic text', () => {
    const root = declared(blockOf(generated(), '\n:root'));
    expect(root.get('font')).toBe(LATIN_STACK);
    expect(root.get('font-arabic')).toBe(ARABIC_STACK);
  });

  it('types the panel in its own reading scale, Latin values at the root', () => {
    const root = declared(blockOf(generated(), '\n:root'));
    expect(READING_ROLES).toEqual(READING.map(([role]) => role));
    for (const [role, size, line] of READING) {
      expect({
        role,
        size: root.get(`font-size-${role}`),
        line: root.get(`line-height-${role}`),
      }).toEqual({ role, size, line });
    }
  });

  it(':lang(ar) re-points only the SPEC §2.2 reading tokens and --bldr-font', () => {
    /*
      The blast-radius rule. Arabic runs one step larger and looser, but only in
      the panel's own reading tokens: the chrome's micro…display sizes are what
      the shell's other components and the SC-013 matrix were measured against,
      so an Arabic page must not move them.
    */
    const arabic = declared(blockOf(generated(), '\n:lang(ar)'));
    const expected = new Map<string, string>([
      ['font', `var(${TOKEN_PREFIX}font-arabic)`],
      ...READING.flatMap(([role, , , size, line]) => [
        [`font-size-${role}`, size] as const,
        [`line-height-${role}`, line] as const,
      ]),
    ]);
    expect(Object.fromEntries(arabic)).toEqual(Object.fromEntries(expected));
  });

  it('restores the Latin family and reading scale on a Latin island inside Arabic', () => {
    /*
      Custom properties inherit their COMPUTED value, so an English message,
      model name or section title carrying lang="en" inside the Arabic panel
      (the default locale; SPEC §6.2 gives user and model text its own lang)
      inherited the Arabic-first stack and the Arabic sizes. Measured in
      Chromium before this block: read 14/22 and input 15/24 on Latin text
      instead of 13/20 and 14/20, on Plex Sans Arabic's strut. The panel's
      `.ck-agent [lang] { font-family: var(--bldr-font) }` cannot undo that,
      because the variable itself is still Arabic there. So the island re-points
      the variable back, with every value the bare :root gives Latin text.
    */
    const island = declared(blockOf(generated(), `\n${LATIN_ISLAND}`));
    const expected = new Map<string, string>([
      ['font', LATIN_STACK],
      ...READING.flatMap(([role, size, line]) => [
        [`font-size-${role}`, size] as const,
        [`line-height-${role}`, line] as const,
      ]),
    ]);
    expect(Object.fromEntries(island)).toEqual(Object.fromEntries(expected));
  });

  it('scopes the Latin island under an Arabic ancestor, so it never matches the document', () => {
    /*
      An unscoped `[lang]:not(:lang(ar))` would match `<html lang="en">` at
      (0,2,0) and out-rank the coarse block's `:root` (0,1,0), pinning every
      coarse-pointer input back to 14px, the size iOS Safari zooms on focus.
      Anchored under `:lang(ar)` it can only match inside an Arabic subtree.
    */
    const css = generated();
    const occurrences = [...css.matchAll(/\[lang\]:not\(:lang\(ar\)\)/g)];
    // Non-vacuous: once bare, once inside the coarse-pointer query.
    expect(occurrences).toHaveLength(2);
    for (const match of occurrences) {
      expect(css.slice(Math.max(0, match.index - ':lang(ar) '.length), match.index)).toBe(
        ':lang(ar) ',
      );
    }
    // After the bare Arabic block, so the two read in the order they apply.
    expect(css.indexOf(`\n${LATIN_ISLAND} {`)).toBeGreaterThan(css.indexOf('\n:lang(ar) {'));
  });

  it('raises only the input and the panel rows under a coarse pointer, in both scripts', () => {
    const coarse = blockOf(generated(), '\n@media (pointer: coarse)');
    expect(Object.fromEntries(declared(blockOf(coarse, ':root')))).toEqual({
      'font-size-input': '16px',
      'line-height-input': '24px',
      'agent-runbar-height': '52px',
      'agent-row-height': '44px',
    });
    // `:lang(ar)` re-declares the input size on every Arabic element, so an
    // inherited coarse value from :root would lose to it; Arabic needs its own.
    expect(Object.fromEntries(declared(blockOf(coarse, '\n  :lang(ar)')))).toEqual({
      'font-size-input': '16px',
      'line-height-input': '26px',
    });
    // The Latin island restates the Latin input on its own element at (0,3,0),
    // so it would beat the coarse :root value it inherits; it needs its own
    // coarse restatement, later in the sheet at the same specificity.
    expect(Object.fromEntries(declared(blockOf(coarse, `\n  ${LATIN_ISLAND}`)))).toEqual({
      'font-size-input': '16px',
      'line-height-input': '24px',
    });
    const css = generated();
    expect(css.indexOf('\n@media (pointer: coarse) {')).toBeGreaterThan(
      css.indexOf(`\n${LATIN_ISLAND} {`),
    );
  });

  it('emits :lang(ar) and then the coarse block AFTER the theme and density blocks', () => {
    /*
      `[data-bldr-theme='dark']` restates `--bldr-font` with the Latin stack and
      has the same specificity as `:lang(ar)` (one attribute, one pseudo-class).
      When one element carries both, only source order decides, so the language
      block must come later or Arabic text is set on a Latin strut. The coarse
      block comes last for the same reason against the bare `:lang(ar)` block.
    */
    const css = generated();
    const lastThemeOrDensity = Math.max(
      css.indexOf("\n[data-bldr-theme='dark'] {"),
      css.indexOf("\n[data-bldr-theme='light'] {"),
      css.indexOf('\n[data-bldr-density='),
    );
    const language = css.indexOf('\n:lang(ar) {');
    const coarse = css.indexOf('\n@media (pointer: coarse) {');

    expect(lastThemeOrDensity).toBeGreaterThan(0);
    expect(language).toBeGreaterThan(lastThemeOrDensity);
    expect(coarse).toBeGreaterThan(language);
  });

  it('moves at the SPEC §2.6 tempo, exit about 0.64 of enter', () => {
    const root = declared(blockOf(generated(), '\n:root'));
    expect({
      press: root.get('duration-press'),
      state: root.get('duration-state'),
      exit: root.get('duration-exit'),
      move: root.get('duration-move'),
      enter: root.get('duration-enter'),
      land: root.get('duration-land'),
      sweep: root.get('duration-sweep'),
      glow: root.get('duration-glow'),
      glint: root.get('duration-glint'),
      shimmer: root.get('duration-shimmer'),
      easing: root.get('easing'),
      easingEnter: root.get('easing-enter'),
      easingExit: root.get('easing-exit'),
    }).toEqual({
      press: '80ms',
      state: '120ms',
      exit: '140ms',
      move: '180ms',
      enter: '220ms',
      land: '360ms',
      sweep: '720ms',
      glow: '900ms',
      glint: '1400ms',
      shimmer: '2000ms',
      easing: 'cubic-bezier(0.2, 0, 0.13, 1)',
      easingEnter: 'cubic-bezier(0.16, 1, 0.3, 1)',
      easingExit: 'cubic-bezier(0.4, 0, 1, 1)',
    });
    const exit = Number.parseFloat(root.get('duration-exit') ?? '');
    const enter = Number.parseFloat(root.get('duration-enter') ?? '');
    expect(exit / enter).toBeCloseTo(0.64, 2);
  });
});
