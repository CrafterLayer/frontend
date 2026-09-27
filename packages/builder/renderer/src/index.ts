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
