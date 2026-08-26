import { describe, expect, it } from 'vitest';

import { lightTheme } from '../themes';
import { themeToCssVars, tokenCssName } from './theme';

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
