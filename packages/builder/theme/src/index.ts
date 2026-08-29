// @craftkit/builder-theme — the builder's CHROME design system (layer 2).
//
// Chrome, not content: this themes the editor around the page. The page itself
// is themed by @craftkit/builder-renderer, and the two are deliberately
// separate — an author editing a dark website must not be forced into a dark
// editor, and a dark editor must never repaint their light page.
//
// Import `@craftkit/builder-theme/css` once at an application's entry to define
// every token; override any of them at runtime with `themeStyle`.

export {
  CHROME_TOKENS,
  RUNTIME_WRITTEN_TOKENS,
  TOKEN_PREFIX,
  cssVarName,
  type ChromeTheme,
  type ChromeThemeOverride,
  type ChromeTokenName,
} from './contract';

export { lightChromeTheme, darkChromeTheme } from './themes';

export {
  buildStylesheet,
  definedTokenNames,
  metricsDeclarations,
  scaleDeclarations,
  themeDeclarations,
  themeStyle,
  themeStyleText,
  type StylesheetInput,
} from './css';

export { alpha, amber, family, green, ink, red, shadow, slate, violet } from './tokens/primitives';

export {
  comfortable,
  compact,
  densities,
  fontSize,
  fontWeight,
  lineHeight,
  motion,
  radius,
  space,
  type DensityName,
  type ShellMetrics,
} from './tokens/layout';
