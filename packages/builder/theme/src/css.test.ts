import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CHROME_TOKENS, TOKEN_PREFIX } from './contract';
import { buildStylesheet, buildUtilities, themeStyle, themeStyleText } from './css';
import { darkChromeTheme, lightChromeTheme } from './themes';

const CSS_PATH = fileURLToPath(new URL('./css/chrome.css', import.meta.url));
const UTILITIES_PATH = fileURLToPath(new URL('./css/utilities.css', import.meta.url));

function generated(): string {
  return buildStylesheet({ light: lightChromeTheme, dark: darkChromeTheme });
}

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
