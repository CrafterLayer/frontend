// @craftkit/builder — the preset and ONLY app-facing entrypoint (ADR 0003).
// Curated surface: composition, bindings, renderers, kernel access, manifests.

export { Builder, type BuilderProps } from './components/Builder';
export { Page, pageSchema } from './components/Page';
export { defaultBlocks } from './default-blocks';

// Rich text (B3b): the read path + schema helpers here; the EDITOR lives in
// the contained extension package (the only tiptap owner) and ships as a
// registerable manifest.
export { richTextExtension } from '@craftkit/builder-richtext';

// The first content extension ships with the preset (starter-kit style).
export {
  blocksMarketing,
  type CtaProps,
  type RichTextBlockProps,
  type FeaturesProps,
  type HeroProps,
  type PricingProps,
  type TestimonialsProps,
} from '@craftkit/builder-blocks-marketing';

// React bindings
export {
  BuilderProvider,
  Slot,
  useBuilder,
  useDispatch,
  useNode,
  useRegistryVersion,
  useSelection,
  type BuilderProviderProps,
  type SlotProps,
} from '@craftkit/builder-react';

// Renderers & theming
export {
  CanvasFrame,
  DocumentView,
  RichText,
  StaticDocument,
  UnknownBlock,
  darkTheme,
  lightTheme,
  renderStaticMarkup,
  resolveResponsiveProps,
  themeToCssVars,
  useKernelSelector,
  type CanvasFrameProps,
  type DocumentViewProps,
  type RenderBreakpoint,
  type RenderStaticOptions,
  type RichTextProps,
  type StaticDocumentProps,
  type Theme,
  type TokenName,
} from '@craftkit/builder-renderer';

// Shell (canvas + panels — B2a/B2b/B3a)
export {
  BUCKET_THRESHOLDS,
  DeviceBar,
  EditorCanvas,
  Inspector,
  LayersTree,
  Palette,
  PreviewMode,
  bucketForWidth,
  defineCanvasTool,
  type CanvasDragHandle,
  type CanvasToolTarget,
  type DeviceBarProps,
  type DeviceState,
  type DragPayload,
  type DropTarget,
  type EditingBucket,
  type EditorCanvasProps,
  type GeometryPorts,
  type InspectorProps,
  type LayersTreeProps,
  type NodeRect,
  type PaletteProps,
  type PreviewModeProps,
  type RectIndex,
} from '@craftkit/builder-shell';

// Kernel access (creation + command authoring + helpers)
export {
  createBuilder,
  defineCommand,
  emptyDocument,
  insertedNodeId,
  openDocument,
  type BuilderKernel,
  type CoreCommandName,
  type CoreCommands,
  type CreateBuilderOptions,
  type OpenDocumentOptions,
} from '@craftkit/builder-core';

// Contract authoring applications legitimately need (custom blocks/extensions)
export {
  defineBlockSchema,
  emptyRichText,
  isRichTextSchema,
  richText,
  type Author,
  type BlockRenderProps,
  type BlockSchema,
  type Breakpoint,
  type BuilderDocument,
  type BuilderError,
  type ContentDirection,
  type FieldProps,
  type FieldTypeDef,
  type JsonValue,
  type Node,
  type NodeId,
  type RichTextDoc,
  type SlotName,
  type Surface,
  type Transaction,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';
