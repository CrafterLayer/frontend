// @craftkit/builder — the preset and ONLY app-facing entrypoint (ADR 0003).
// Curated surface: composition, bindings, renderers, kernel access, manifests.

export { Builder, type BuilderProps } from './components/Builder';
export { Page, pageSchema } from './components/Page';
export { defaultBlocks } from './default-blocks';

// Rich text (B3b): the read path + schema helpers here; the EDITOR lives in
// the contained extension package (the only tiptap owner) and ships as a
// registerable manifest.
export { richTextExtension } from '@craftkit/builder-richtext';

// Code view (B4): the panel and the canonical-JSON projection ship as a
// registerable manifest. Its implementation is behind a lazy panel
// contribution, so an app that never opens the panel pays nothing for it
// (SC-006) — and the codec itself stays in the worker, off the render path.
export {
  codeViewExtension,
  createCodeViewWorkerClient,
  type CodeViewKernel,
  type CodeViewPanelProps,
  type TransformWorkerClient,
  type WorkerLike,
} from '@craftkit/builder-code-view';

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

// Shell (canvas + panels — B2a/B2b/B3a; inline editing — B3c). B3c adds the
// content components (in-place text surface, formatting bubble, block action
// bar) and the block-action helpers; the floating/anchor/session plumbing the
// canvas drives internally stays off the surface, the same policy that keeps
// createRectIndex and systemGeometryPorts internal.
export {
  BUCKET_THRESHOLDS,
  BlockActionBar,
  DeviceBar,
  EditorCanvas,
  InlineTextSurface,
  Inspector,
  LayersTree,
  Palette,
  PreviewMode,
  TextBubble,
  bucketForWidth,
  defineCanvasTool,
  performBlockAction,
  resolveBlockActions,
  type BlockAction,
  type BlockActionBarProps,
  type BlockActionId,
  type BlockActionResult,
  type CanvasDragHandle,
  type CanvasInlineEditHandle,
  type CanvasToolTarget,
  type DeviceBarProps,
  type DeviceState,
  type DragPayload,
  type DropTarget,
  type EditingBucket,
  type EditorCanvasProps,
  type FloatingHostPorts,
  type GeometryPorts,
  type InlineTextSurfaceProps,
  type InspectorProps,
  type LayersTreeProps,
  type NodeRect,
  type PaletteProps,
  type PreviewModeProps,
  type RectIndex,
  type TextBubbleAction,
  type TextBubbleProps,
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

// Contract authoring applications legitimately need (custom blocks/extensions).
// The Inline* types (B3c, 009 §11) let a block declare `inlineEditable` and let
// an extension contribute an inline editor via `inlineEditors`.
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
  type InlineEditableKind,
  type InlineEditorDef,
  type InlineEditorProps,
  type InlineFormatAction,
  type InlineRect,
  type InlineSelectionAnchor,
  type InlineSelectionAnchorReport,
  type InlineSelectionAnchorSource,
  type JsonValue,
  type Node,
  type NodeId,
  type RichTextDoc,
  type SlotName,
  type Surface,
  type Transaction,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';
