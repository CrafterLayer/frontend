// @craftkit/builder-renderer — rendering engines for the builder (layer 2).
// The kernel always arrives BY PROP; this package never imports builder-react.

export { CanvasFrame, type CanvasFrameProps } from './components/CanvasFrame';
export {
  DocumentView,
  type DocumentViewProps,
  type InlineEditSeam,
} from './components/DocumentView';
export { StaticDocument, type StaticDocumentProps } from './components/StaticDocument';
export type { SharedRegionView } from './components/DocumentView/DocumentView';
export { UnknownBlock, type UnknownBlockProps } from './components/UnknownBlock';
export {
  CustomCode,
  CustomCodeRegistryContext,
  useCustomCodeBlockLookup,
  type CustomCodeBlockLookup,
  type CustomCodeProps,
} from './components/CustomCode';
export { renderStaticMarkup, type RenderStaticOptions } from './render-static-markup';
export {
  createLiveUtilities,
  type LiveUtilities,
  type LiveUtilitiesOptions,
} from './tailwind/live-utilities';

export { resolveResponsiveProps, type RenderBreakpoint } from './resolve/responsive';
export {
  resolveImage,
  useAssetTable,
  type AssetTable,
  type ResolvedImage,
} from './assets/asset-table';
export { AssetTableProvider, type AssetTableProviderProps } from './assets/AssetTableProvider';
/*
  The palette a colour CONTROL can offer. Exported because the shell's picker
  needs to know which theme keys are colours, what to call each one to a person,
  and which are ink against which grounds — none of which a flat token map says.
  What a document stores is the ROLE; the hex is only ever for the swatch.
*/
export {
  COLOR_ROLES,
  isColorRole,
  paletteOf,
  type ColorRole,
  type PaletteEntry,
} from './resolve/palette';
export {
  designSystemToCssVars,
  themeFromDesignSystem,
  themeToCssVars,
  tokenCssName,
  type Theme,
  type TokenName,
} from './resolve/theme';
export { darkTheme, lightTheme } from './themes';
export { useKernelNode, useKernelSelector, useRegistryEpoch } from './subscribe';
export { RichText, safeHref, type RichTextProps } from './components/RichText';

/*
  Motion (013). The CSS baseline: reveals and scroll effects run on a view()
  timeline with no JavaScript, so the publish path and static output animate a
  document without loading any engine. `motionAttributes` turns a validated
  MotionSpec into DOM attributes — never inline style, so no timing literal
  ever reaches a document.
*/
export { MOTION_CLASS, buildMotionCss, motionAttributes } from './motion';
// behaviors additions (2026-09-30): the curated site-behaviour runtime a
// custom-code tree names with data-ck-behavior — mounted by CustomCode on the
// canvas, embedded by the exporter as one inline script plus BEHAVIOR_CSS.
export {
  BEHAVIOR_CSS,
  behaviorRuntimeScript,
  ensureBehaviorCss,
  hasBehaviors,
  mountBehaviors,
} from './behaviors';
// end behaviors additions
// static-export additions (2026-09-30): publish kernel/customCode pages as a
// static website — SEO head, compiled CSS, behaviour runtime, sitemap, robots, 404.
export {
  exportStaticSite,
  type ExportStaticSiteOptions,
  type StaticSiteFile,
  type StaticSitePageInput,
  type StaticSiteResult,
} from './export';
// end static-export additions
// ── P5-site-library (style-manager DESIGN.md) ──
// The site design library on the canvas and in the export (§2): the context a
// render reads the library and the named-style class transform from, and the
// library's stylesheet (palette variables, font imports, uploaded faces).
export {
  buildLibraryCss,
  fontImportRule,
  SiteDesignContext,
  siteFontImportUrl,
  SiteLibraryStyle,
  useSiteDesign,
  type SiteDesign,
  type SiteLibraryStyleProps,
} from './site-design';
// ── end P5-site-library ──
// ── P3-vocabulary-renderer (style-manager DESIGN.md) ──
// The class-transform hook (named-style expansion, §A.2/D6), the lazy Tabler
// icon set (§C.3: the export awaits loadTablerIcons() before a static render),
// and the canvas-only forced-state variants (§A.7).
export {
  CustomCodeClassTransformContext,
  useCustomCodeClassTransform,
  type CustomCodeClassTransform,
} from './components/CustomCode/class-transform-context';
export {
  loadTablerIcons,
  setTablerIconLoader,
  subscribeTablerIcons,
  tablerIconNode,
  tablerIconsFailed,
  tablerIconsLoaded,
  type TablerIconLoader,
  type TablerIconNode,
  type TablerIconSets,
  type TablerIconStyle,
} from './components/CustomCode/tabler-icons';
export {
  CANVAS_STATES,
  CANVAS_STATE_ATTRIBUTE,
  type CanvasState,
} from './tailwind/live-utilities';
// ── end P3-vocabulary-renderer ──
// ── P4-animation (style-manager DESIGN.md) ──
// Motion presets + effects as CSS (§B, §C), the canvas injection and Preview
// replay, the runtime's trigger selector, and the named-style transform (D6)
// a host passes as SiteDesignContext.classTransform.
export {
  buildMotionPresetsCss,
  hoverPresetCss,
  INLINE_AXIS_HOVERS,
  INLINE_AXIS_PRESETS,
  motionPresetCss,
  type MotionCssSelection,
} from './motion/presets-css';
export { buildEffectsCss, effectCss } from './motion/effects-css';
export { BEHAVIOR_RUNTIME_SELECTOR, ensureMotionCss, replayMotion } from './behaviors';
export {
  createNamedStyleTransform,
  namedStyleMap,
  type NamedStyleTransform,
} from './site-design/named-style-transform';
// ── end P4-animation ──
