import { describe, expect, it } from 'vitest';

import type { SiteFont, SiteLibrary } from '@craftkit/builder-schema';

import { buildLibraryCss, fontImportRule, siteFontImportUrl } from './build-library-css';

const WOFF2 = `data:font/woff2;base64,${'AAAA'.repeat(16)}`;

describe('buildLibraryCss', () => {
  it('is empty for no library and for an empty one', () => {
    expect(buildLibraryCss(undefined)).toBe('');
    expect(buildLibraryCss({})).toBe('');
  });

  it('publishes each palette colour as --ck-c-<id> on :root and [data-ck-page]', () => {
    const css = buildLibraryCss({
      palette: [
        { id: 'brand-600', name: 'Brand', value: '#0f766e' },
        { id: 'sand', name: 'Sand', value: 'oklch(92% 0.04 85)' },
      ],
    });
    expect(css).toContain(':root,\n[data-ck-page] {');
    expect(css).toContain('--ck-c-brand-600: #0f766e;');
    expect(css).toContain('--ck-c-sand: oklch(92% 0.04 85);');
  });

  it('leaves out a palette value that is not one colour, and keeps the rest', () => {
    const library = {
      palette: [
        { id: 'evil', name: 'Evil', value: 'red;} body{display:none' },
        { id: 'ok', name: 'Ok', value: '#fff' },
      ],
    } as SiteLibrary;
    const css = buildLibraryCss(library);
    expect(css).not.toContain('evil');
    expect(css).not.toContain('display:none');
    expect(css).toContain('--ck-c-ok: #fff;');
  });

  it('puts hosted-font imports before every other rule', () => {
    const css = buildLibraryCss({
      palette: [{ id: 'ink', name: 'Ink', value: '#111827' }],
      fonts: [
        { family: 'Cairo', source: 'google', weights: [700, 400] },
        { family: 'Inter', source: 'bunny', weights: [400] },
      ],
    });
    const lines = css.split('\n');
    expect(lines[0]).toBe(
      '@import url(https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap);',
    );
    expect(lines[1]).toBe(
      '@import url(https://fonts.bunny.net/css?family=inter:400&display=swap);',
    );
    expect(css.indexOf('@import')).toBeLessThan(css.indexOf(':root'));
  });

  it('declares an uploaded woff2 with font-display: swap', () => {
    const css = buildLibraryCss({
      fonts: [{ family: 'House Sans', source: 'upload', weights: [300, 800], url: WOFF2 }],
    });
    expect(css).toContain('@font-face {');
    expect(css).toContain('font-family: "House Sans";');
    expect(css).toContain(`src: url(${WOFF2}) format("woff2");`);
    expect(css).toContain('font-weight: 300 800;');
    expect(css).toContain('font-display: swap;');
    expect(css).not.toContain('@import');
  });

  it('refuses an upload whose url is not an embedded woff2', () => {
    const library = {
      fonts: [
        { family: 'Remote', source: 'upload', weights: [400], url: 'https://evil.test/x.woff2' },
      ],
    } as SiteLibrary;
    expect(buildLibraryCss(library)).toBe('');
  });
});

describe('siteFontImportUrl', () => {
  it('builds the Google css2 URL with sorted weights and + for spaces', () => {
    const font: SiteFont = {
      family: 'IBM Plex Sans Arabic',
      source: 'google',
      weights: [700, 400],
    };
    expect(siteFontImportUrl(font)).toBe(
      'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;700&display=swap',
    );
  });

  it('builds the Google ital,wght axis when italics are wanted', () => {
    const font: SiteFont = { family: 'Lora', source: 'google', weights: [400, 600], italic: true };
    expect(siteFontImportUrl(font)).toBe(
      'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400;1,600&display=swap',
    );
  });

  it('builds the Bunny URL with a dashed lower-case family and i-suffixed italics', () => {
    const font: SiteFont = {
      family: 'Noto Kufi Arabic',
      source: 'bunny',
      weights: [400],
      italic: true,
    };
    expect(siteFontImportUrl(font)).toBe(
      'https://fonts.bunny.net/css?family=noto-kufi-arabic:400,400i&display=swap',
    );
  });

  it('has no URL for an upload', () => {
    expect(siteFontImportUrl({ family: 'X', source: 'upload', weights: [400], url: WOFF2 })).toBe(
      undefined,
    );
  });
});

describe('fontImportRule', () => {
  it('admits only the two hosts the CSS door admits', () => {
    expect(fontImportRule('https://fonts.googleapis.com/css2?family=Inter')).toBe(
      '@import url(https://fonts.googleapis.com/css2?family=Inter);',
    );
    expect(fontImportRule('https://fonts.bunny.net/css?family=inter:400')).toContain('@import');
    expect(fontImportRule('https://fonts.googleapis.com.evil.test/x.css')).toBeUndefined();
    expect(fontImportRule('http://fonts.googleapis.com/css2?family=Inter')).toBeUndefined();
    expect(fontImportRule('https://evil.test/font.css')).toBeUndefined();
    expect(fontImportRule(undefined)).toBeUndefined();
  });

  it('refuses a URL that could end the url() early', () => {
    expect(fontImportRule('https://fonts.googleapis.com/css2?family=a);body{x:y}')).toBeUndefined();
    expect(fontImportRule('https://fonts.googleapis.com/css2?family="a"')).toBeUndefined();
  });
});
