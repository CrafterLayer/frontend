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
  STAGE_TOKENS,
  TOKEN_PREFIX,
  cssVarName,
  type ChromeTheme,
  type ChromeThemeOverride,
  type ChromeTokenName,
  type StageTokenName,
} from './contract';

export { lightChromeTheme, darkChromeTheme } from './themes';

export {
  buildStylesheet,
  definedTokenNames,
  metricsDeclarations,
  readingDeclarations,
  scaleDeclarations,
  themeDeclarations,
  themeStyle,
  themeStyleText,
  type StylesheetInput,
} from './css';

export {
  alpha,
  amber,
  family,
  green,
  ink,
  motion,
  red,
  shadow,
  slate,
  violet,
} from './tokens/primitives';

export {
  READING_ROLES,
  agentPanelMetrics,
  arabicReadingScale,
  coarsePointer,
  comfortable,
  compact,
  densities,
  fontSize,
  fontWeight,
  lineHeight,
  radius,
  readingScale,
  space,
  type AgentPanelMetrics,
  type CoarsePointerOverrides,
  type DensityName,
  type ReadingRole,
  type ReadingScale,
  type ReadingStep,
  type ShellMetrics,
} from './tokens/layout';
