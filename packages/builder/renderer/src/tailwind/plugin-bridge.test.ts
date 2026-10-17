/*
  @vitest-environment node

  Reads and writes a file on disk and compiles with the real Tailwind; no DOM. Under jsdom
  `import.meta.url` is an http URL and fileURLToPath rejects it.
*/
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { compile } from 'tailwindcss';
import { describe, expect, it } from 'vitest';

import { compilerLoaders } from './compiler-loaders';
import { buildTailwindAnimateCss, buildTailwindContentCss } from './plugin-bridge';
import { buildTailwindThemeCss } from './token-bridge';

const GENERATED = [
  ['tailwind-animate.css', buildTailwindAnimateCss],
  ['tailwind-content.css', buildTailwindContentCss],
] as const;

const ENTRY = [
  "@import 'tailwindcss/theme.css' layer(theme);",
  "@import 'tailwindcss/utilities.css' layer(utilities);",
  "@import 'craftkit/theme.css';",
  "@import 'craftkit/plugins.css';",
].join('\n');

const loaders = compilerLoaders({
  'tailwindcss/theme.css': readFileSync(
    createRequire(import.meta.url).resolve('tailwindcss/theme.css'),
    'utf8',
  ),
  'tailwindcss/utilities.css': '@tailwind utilities;',
  'craftkit/theme.css': buildTailwindThemeCss(),
});

async function build(classes: readonly string[]): Promise<string> {
  return (await compile(ENTRY, loaders)).build([...classes]);
}

/** Index of the first rule whose selector is exactly `selector`, after `from`. */
function ruleAt(css: string, selector: string, from = 0): number {
  return css.indexOf(`\n  ${selector} {`, from);
}

describe('the Tailwind plugin layers', () => {
  it.each(GENERATED)('holds the checked-in %s equal to its generator', (file, generate) => {
    // Regenerate with: UPDATE_TAILWIND_CSS=1 pnpm --filter @craftkit/builder-renderer test src/tailwind
    const path = fileURLToPath(new URL(`./${file}`, import.meta.url));
    if (process.env['UPDATE_TAILWIND_CSS'] === '1') writeFileSync(path, generate(), 'utf8');
    expect(readFileSync(path, 'utf8')).toBe(generate());
  });

  it('keeps the heavy content plugins out of the animate layer every static sheet imports', () => {
    expect(buildTailwindAnimateCss()).not.toContain('@plugin');
    expect(buildTailwindContentCss()).not.toContain('tw-animate-css');
  });

  it('names no colour of its own: every colour is a token, currentColor or a mix of them', () => {
    const css = buildTailwindContentCss().replace(/\/\*[\s\S]*?\*\//gu, '');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|\b(?:rgb|hsl|oklch|oklab)\(/iu);
    for (const line of css.split('\n').filter((text) => /color|--tw-prose-/u.test(text))) {
      if (!line.includes(':') || line.trim().startsWith('@')) continue;
      expect(line, line).toMatch(
        /--theme\(--color-|currentColor|var\(--tw-prose-body\)|: transparent;/u,
      );
    }
  });

  it('refuses any module or stylesheet it does not name', async () => {
    await expect(loaders.loadModule('./evil.js', '/', 'plugin')).rejects.toThrow(/own plugins/u);
    await expect(loaders.loadStylesheet('evil.css', '/')).rejects.toThrow(/cannot load/u);
  });
});

describe('prose wears the site tokens', () => {
  it('re-points every prose colour at a --t-* token', async () => {
    const css = await build(['prose']);
    expect(css).toContain('--tw-prose-body: var(--t-text, #111827)');
    expect(css).toContain('--tw-prose-links: var(--t-accent, #4f46e5)');
    expect(css).toContain('--tw-prose-invert-body: var(--t-text-inverse, #f9fafb)');
    // The token wins over the plugin's gray: it is declared later in the same rule.
    const gray = css.indexOf('--tw-prose-body: oklch(');
    expect(gray).toBeGreaterThan(-1);
    expect(css.indexOf('--tw-prose-body: var(--t-text')).toBeGreaterThan(gray);
  });

  it('sorts after the plugin and its sizes, and before the colour modifiers that must still win', async () => {
    // Spelled in parts: the app's Tailwind scans every file under packages/builder, tests
    // included, and would ship each name in its first-load CSS.
    const [large, slate] = [['prose', 'lg'].join('-'), ['prose', 'slate'].join('-')];
    const css = await build(['prose', large, 'prose-invert', slate]);
    const plugin = ruleAt(css, '.prose');
    const size = ruleAt(css, `.${large}`);
    const tokens = css.indexOf('--tw-prose-body: var(--t-text');
    expect(plugin).toBeLessThan(size);
    expect(size).toBeLessThan(tokens);
    expect(tokens).toBeLessThan(ruleAt(css, `.${slate}`));
    expect(tokens).toBeLessThan(ruleAt(css, '.prose-invert'));
  });
});

describe('forms wear the section they sit in', () => {
  it('generates only the form-* classes: no global reset of every input', async () => {
    const css = await build(['form-input', 'form-select', 'form-checkbox', 'form-radio']);
    expect(css).not.toMatch(/input:where\(|^\s*select\s*\{|^\s*textarea\s*\{/mu);
    for (const name of ['.form-input', '.form-select', '.form-checkbox', '.form-radio']) {
      expect(css, name).toContain(`${name} {`);
    }
  });

  it('draws borders from the inherited colour and focus from the accent token', async () => {
    const css = await build(['form-input', 'form-checkbox']);
    const field = ruleAt(css, '.form-input');
    expect(css.indexOf('background-color: transparent', field)).toBeGreaterThan(field);
    expect(css).toContain('border-color: color-mix(in oklab, currentColor 30%, transparent)');
    expect(css).toContain('--tw-ring-color: var(--t-accent, #4f46e5)');
    expect(css).toContain('border-radius: var(--t-radius-sm, 8px)');
    expect(css).toContain('color: var(--t-accent, #4f46e5)');
  });

  it('lets a one-property utility on the element win over the themed default', async () => {
    const css = await build(['form-input', 'rounded-full', 'form-checkbox', 'text-success']);
    expect(css.lastIndexOf('border-radius: var(--t-radius-sm')).toBeLessThan(
      ruleAt(css, '.rounded-full'),
    );
    expect(css.lastIndexOf('color: var(--t-accent')).toBeLessThan(ruleAt(css, '.text-success'));
  });

  it("mirrors the select's chevron on a right-to-left page", async () => {
    const css = await build(['form-select']);
    expect(css).toMatch(
      /:where\(:dir\(rtl\), \[dir=["']rtl["']\], \[dir=["']rtl["']\] \*\) \{\s*background-position: left/u,
    );
  });
});

describe('tw-animate entrances', () => {
  it('generates the shadcn entrance vocabulary', async () => {
    const css = await build(['animate-in', 'fade-in', 'zoom-in-95', 'slide-in-from-bottom-4']);
    expect(css).toContain('animation: enter ');
    expect(css).toContain('@keyframes enter');
    expect(css).toContain('--tw-enter-opacity: 0');
    expect(css).toContain('--tw-enter-translate-y: calc(4*var(--spacing))');
  });

  it('gives a sliding element the spacing step the inline token bridge never emits', async () => {
    const css = await build(['slide-in-from-bottom-4']);
    expect(css).not.toMatch(/^\s*--spacing:\s*0\.25rem/mu);
    expect(css).toContain('--spacing: var(--t-space-unit, 4px)');
  });

  it('stops every entrance and exit under reduced motion, outside any layer', async () => {
    const css = await build(['animate-in']);
    // At column 0: a rule inside @layer would be indented.
    const guard = css.indexOf('\n@media (prefers-reduced-motion: reduce) {\n  :where(');
    expect(guard).toBeGreaterThan(-1);
    expect(css.slice(guard)).toMatch(/\[class\*=["']animate-in["']\][^{]*\{\s*animation: none;/u);
  });
});
