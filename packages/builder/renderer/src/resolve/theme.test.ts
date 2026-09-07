import { describe, expect, it } from 'vitest';

import { TOKEN_NAMES, defaultDesignSystem, type DesignSystem } from '@craftkit/builder-schema';
import { fivePageSite } from '@craftkit/builder-schema/testing';

import { lightTheme } from '../themes';
import {
  designSystemToCssVars,
  themeFromDesignSystem,
  themeToCssVars,
  tokenCssName,
} from './theme';

describe('theme tokens', () => {
  it('maps camelCase token names to --t- kebab custom properties', () => {
    expect(tokenCssName('surfaceInverse')).toBe('--t-surface-inverse');
    expect(tokenCssName('accent')).toBe('--t-accent');
  });

  it('serializes a complete theme into one :root rule', () => {
    const css = themeToCssVars(lightTheme);
    expect(css.startsWith(':root {')).toBe(true);
    expect(css).toContain('--t-surface: #ffffff;');
    expect(css).toContain('--t-accent-text: #ffffff;');
    // Every token appears exactly once.
    expect(css.match(/--t-/g)).toHaveLength(Object.keys(lightTheme).length);
  });
});

/* ── The SITE's design system paints the pages (T016, T017, FR-012) ───────── */

describe('a site token change reaches every page with no page regeneration', () => {
  const systemWith = (accent: string): DesignSystem => {
    const base = defaultDesignSystem();
    return { ...base, tokens: { ...base.tokens, accent } };
  };

  it('paints from the SITE design system, not from a named module theme', () => {
    const site = fivePageSite();
    const css = designSystemToCssVars(site.designSystem);

    /*
      Every token the vocabulary declares, or a page paints a colour the design
      system never chose and nobody validated.
    */
    for (const name of TOKEN_NAMES) {
      expect(css).toContain(`${tokenCssName(name)}:`);
    }
  });

  it('changes ONE rule when a token changes, and no page document at all', () => {
    const site = fivePageSite();
    const before = JSON.stringify(site.pages);

    const recoloured = { ...site, designSystem: systemWith('#0b5cff') };
    const css = designSystemToCssVars(recoloured.designSystem);

    /*
      FR-012 in one assertion pair: the new colour is in the rule, and every page
      document is byte-identical. A design system that had to be baked into the
      pages would make a palette change N document writes and N undo steps.
    */
    expect(css).toContain('#0b5cff');
    expect(JSON.stringify(recoloured.pages)).toBe(before);
    expect(recoloured.pages).toHaveLength(5);
  });

  it('inherits to every page because the rule sits ABOVE them', () => {
    /*
      Not a DOM test — a statement about where the rule goes. `:root` is one
      selector, and custom properties inherit, so "reaches every page" is a
      property of the SELECTOR rather than of how many pages there are.
    */
    expect(designSystemToCssVars(defaultDesignSystem()).startsWith(':root {')).toBe(true);
  });

  it('lets a caller re-point one role without inventing a design system', () => {
    const system = defaultDesignSystem();
    const theme = themeFromDesignSystem(system, { accent: '#c2185b' });

    expect(theme.accent).toBe('#c2185b');
    expect(theme.surface).toBe(system.tokens.surface);
    /*
      Beside, never folded in: a stored site must not quietly acquire colours
      nobody generated or checked for it.
    */
    expect(system.tokens.accent).not.toBe('#c2185b');
  });
});
