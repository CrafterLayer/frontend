// @craftkit/builder-renderer — rendering engines for the builder (layer 2).
// The kernel always arrives BY PROP; this package never imports builder-react.

export { CanvasFrame, type CanvasFrameProps } from './components/CanvasFrame';
export {
  DocumentView,
  type DocumentViewProps,
  type InlineEditSeam,
} from './components/DocumentView';
export { StaticDocument, type StaticDocumentProps } from './components/StaticDocument';
export { UnknownBlock, type UnknownBlockProps } from './components/UnknownBlock';
export { renderStaticMarkup, type RenderStaticOptions } from './render-static-markup';

export { resolveResponsiveProps, type RenderBreakpoint } from './resolve/responsive';
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
export { themeToCssVars, tokenCssName, type Theme, type TokenName } from './resolve/theme';
export { darkTheme, lightTheme } from './themes';
export { useKernelNode, useKernelSelector, useRegistryEpoch } from './subscribe';
export { RichText, safeHref, type RichTextProps } from './components/RichText';
