import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CHROME_TOKENS, lightChromeTheme, themeStyle } from '@craftkit/builder-theme';
import { TOKEN_NAMES, defaultDesignSystem } from '@craftkit/builder-schema';
import { designSystemToCssVars, tokenCssName } from '@craftkit/builder-renderer';

import { BuilderTheme } from './BuilderTheme';

afterEach(cleanup);

function root(): HTMLElement {
  const element = screen.getByTestId('inside').parentElement;
  if (element === null) {
    throw new Error('BuilderTheme must render an element around its children');
  }
  return element;
}

describe('BuilderTheme — the chrome root', () => {
  it('carries the class the stylesheet targets', () => {
    // Without this class the tokens are defined but nothing consumes them: no
    // ground, no chrome font, and — the one that matters — no focus ring.
    render(
      <BuilderTheme>
        <span data-testid="inside">page</span>
      </BuilderTheme>,
    );
    expect(root()).toHaveClass('bldr-root');
  });

  it('follows the operating system by DEFAULT, stamping no attribute', () => {
    // Absent is a state, not a missing value: it is what most viewers are in,
    // and stamping 'light' by default would override their dark preference.
    render(
      <BuilderTheme>
        <span data-testid="inside">page</span>
      </BuilderTheme>,
    );
    expect(root()).not.toHaveAttribute('data-bldr-theme');
    expect(root()).not.toHaveAttribute('data-bldr-density');
    expect(root()).not.toHaveAttribute('style');
  });

  it.each(['light', 'dark'] as const)('stamps an EXPLICIT %s choice', (theme) => {
    render(
      <BuilderTheme theme={theme}>
        <span data-testid="inside">page</span>
      </BuilderTheme>,
    );
    expect(root()).toHaveAttribute('data-bldr-theme', theme);
  });

  it('treats density as independent of colour', () => {
    // A host may run the dark theme comfortably or the light theme tight;
    // binding the two would make one of those impossible.
    render(
      <BuilderTheme theme="light" density="compact">
        <span data-testid="inside">page</span>
      </BuilderTheme>,
    );
    expect(root()).toHaveAttribute('data-bldr-theme', 'light');
    expect(root()).toHaveAttribute('data-bldr-density', 'compact');
  });

  it('writes ONLY the tokens an override names', () => {
    // The point of a partial override: everything unnamed keeps cascading, so
    // re-branding is three lines rather than a copy of the whole theme.
    render(
      <BuilderTheme overrides={{ accent: '#0f766e', 'accent-soft': '#ccfbf1' }}>
        <span data-testid="inside">page</span>
      </BuilderTheme>,
    );
    const { style } = root();
    expect(style.getPropertyValue('--bldr-accent')).toBe('#0f766e');
    expect(style.getPropertyValue('--bldr-accent-soft')).toBe('#ccfbf1');
    expect(style.getPropertyValue('--bldr-selection')).toBe('');
    expect(style.length).toBe(2);
  });

  it('accepts a COMPLETE theme as an override, every token of it', () => {
    render(
      <BuilderTheme overrides={lightChromeTheme}>
        <span data-testid="inside">page</span>
      </BuilderTheme>,
    );
    const { style } = root();
    expect(style.length).toBe(CHROME_TOKENS.length);
    for (const token of CHROME_TOKENS) {
      expect(style.getPropertyValue(`--bldr-${token}`)).not.toBe('');
    }
  });

  it('keeps a host class alongside its own instead of replacing it', () => {
    render(
      <BuilderTheme className="app-shell">
        <span data-testid="inside">page</span>
      </BuilderTheme>,
    );
    expect(root()).toHaveClass('bldr-root');
    expect(root()).toHaveClass('app-shell');
  });
});

/**
 * FR-015: the editor's chrome and a site's design system are independent.
 *
 * They are two different theming systems that happen to both be "colours", and
 * conflating them is a mistake with a very specific cost: a person who switches
 * the EDITOR to dark to save their eyes would be changing the palette of the
 * SITE they are publishing, and would not find out until a visitor did.
 *
 * The separation is mechanical — two disjoint custom-property prefixes,
 * `--bldr-*` for the chrome and `--t-*` for the site — and this is where that
 * is asserted rather than assumed.
 */
describe('the editor theme and a site design system never touch (FR-015)', () => {
  it('paints the chrome with --bldr-* and never with --t-*', () => {
    const { container } = render(
      <BuilderTheme theme="dark" overrides={{ accent: '#0b5cff' }}>
        <span>chrome</span>
      </BuilderTheme>,
    );
    const root = container.querySelector('.bldr-root');
    const style = root?.getAttribute('style') ?? '';

    expect(style).toContain('--bldr-');
    /*
      Not one site token. A chrome override that emitted `--t-accent` would
      re-point the CANVAS from a control that promises to change the editor.
    */
    expect(style).not.toContain('--t-');
    expect(root?.getAttribute('data-bldr-theme')).toBe('dark');
  });

  it('serialises a site design system with --t-* and never with --bldr-*', () => {
    const css = designSystemToCssVars(defaultDesignSystem());

    expect(css).toContain('--t-');
    expect(css).not.toContain('--bldr-');
  });

  it('shares not one custom-property name between the two vocabularies', () => {
    const siteNames = new Set(TOKEN_NAMES.map((name) => tokenCssName(name)));
    const chrome = themeStyle({ accent: '#0b5cff', surface: '#ffffff' });

    /*
      The strong form: no NAME is in both. Prefixes could collide the day
      someone adds `--t-` to the chrome vocabulary for convenience, and this
      says so before a person's editor recolours their site.
    */
    for (const name of Object.keys(chrome)) {
      expect(siteNames.has(name)).toBe(false);
      expect(name.startsWith('--bldr-')).toBe(true);
    }
  });
});
