import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CHROME_TOKENS, lightChromeTheme } from '@craftkit/builder-theme';

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
