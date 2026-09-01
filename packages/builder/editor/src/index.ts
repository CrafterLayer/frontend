// @craftkit/builder — the preset and ONLY app-facing entrypoint (ADR 0003).
// Curated surface: composition, bindings, renderers, kernel access, manifests.

// The chrome design system. Importing it here is what makes an application that
// imports only `@craftkit/builder` get a THEMED editor rather than one running
// on twenty stylesheets' fallback values — which is what it did before this
// package existed. Overriding is a runtime act: hand `themeStyle({...})` to any
// ancestor and everything beneath it re-themes, floating chrome included.
import '@craftkit/builder-theme/css';

export {
  CHROME_TOKENS,
  TOKEN_PREFIX,
  buildStylesheet,
  comfortable,
  compact,
  cssVarName,
  darkChromeTheme,
  densities,
  lightChromeTheme,
  themeStyle,
  themeStyleText,
  type ChromeTheme,
  type ChromeThemeOverride,
  type ChromeTokenName,
  type DensityName,
  type ShellMetrics,
} from '@craftkit/builder-theme';

/*
  Motion (013): the vocabulary comes from the schema so an application can
  author or validate a MotionSpec, and the renderer's helpers turn one into DOM
  attributes. The stylesheet is a separate door — `@craftkit/builder/motion.css`
  — because Tailwind and the browser both need to SEE the CSS, and a TypeScript
  re-export would hide it.
*/
export {
  MOTION_DELAYS,
  MOTION_DURATIONS,
  MOTION_EASINGS,
  MOTION_PROP,
  MOTION_STAGGERS,
  REVEAL_EFFECTS,
  SCROLL_EFFECTS,
  motionSpecSchema,
  validateDocumentMotion,
  validateMotionSpec,
  type MotionDelay,
  type MotionDuration,
  type MotionEasing,
  type MotionSpec,
  type MotionStagger,
  type RevealEffect,
  type ScrollEffect,
} from '@craftkit/builder-schema';
export { MOTION_CLASS, buildMotionCss, motionAttributes } from '@craftkit/builder-renderer';

/*
  The animation ENGINE is reached only through a dynamic door. Re-exporting the
  component statically here would put `motion` in every application's main
  bundle, and containment would hold on paper while every published page paid
  for an engine it does not use. `needsMotionEngine` answers cheaply, and it
  answers "no" for everything the CSS baseline already handles.
*/
export {
  loadMotionStage,
  needsMotionEngine,
  type MotionStageProps,
} from '@craftkit/builder-motion';

export { Builder, type BuilderProps } from './components/Builder';
export { BuilderTheme, type BuilderThemeProps } from './components/BuilderTheme';
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
/*
  Visual effects adapted from Aceternity UI (MIT), and the curated primitive
  catalog. Both ship as registerable manifests, so an application composes them
  the same way it composes the marketing pack.
*/
export {
  builderAceternity,
  auroraBackgroundSchema,
  cloudShaderSchema,
  spotlightSurfaceSchema,
  type AuroraBackgroundProps,
  type CloudShaderProps,
  type SpotlightSurfaceProps,
} from '@craftkit/builder-aceternity';
export {
  builderMagicUi,
  dotPatternSurfaceSchema,
  marqueeItemSchema,
  marqueeSchema,
  shimmerButtonSchema,
  shineBorderSchema,
  type DotPatternSurfaceProps,
  type MarqueeItem,
  type MarqueeProps,
  type ShimmerButtonProps,
  type ShineBorderProps,
} from '@craftkit/builder-magicui';
export {
  accordionItemSchema,
  accordionSchema,
  builderPrimitives,
  type AccordionItemProps,
  type AccordionProps,
} from '@craftkit/builder-primitives';
export {
  builderShadcn,
  avatarGroupSchema,
  breadcrumbsSchema,
  buttonSchema,
  cardSchema,
  dialogSchema,
  paginationSchema,
  progressSchema,
  separatorSchema,
  badgeSchema,
  shadcnAlertSchema,
  tabsSchema,
  tabPanelSchema,
  type AvatarGroupProps,
  type BreadcrumbsProps,
  type ButtonProps,
  type BadgeProps,
  type CardProps,
  type DialogProps,
  type PaginationProps,
  type ProgressProps,
  type SeparatorProps,
  type ShadcnAlertProps,
  type TabPanelProps,
  type TabsProps,
} from '@craftkit/builder-shadcn';

export {
  blocksMarketing,
  marketingTemplates,
  type AnnouncementBarProps,
  type BentoGridProps,
  type BlogGridProps,
  type CarouselProps,
  type ComparisonTableProps,
  type ContactProps,
  type ContentSectionProps,
  type CtaProps,
  type FaqProps,
  type FormSectionProps,
  type GalleryProps,
  type RichTextBlockProps,
  type FeaturesProps,
  type HeroProps,
  type LogoCloudProps,
  type NewsletterProps,
  type PricingProps,
  type PortfolioGridProps,
  type ProductGridProps,
  type PromoBannerProps,
  type ProcessStepsProps,
  type StatsProps,
  type TeamProps,
  type TestimonialsProps,
  type VideoSectionProps,
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
  paletteOf,
  isColorRole,
  type ColorRole,
  type PaletteEntry,
  type Theme,
  type TokenName,
} from '@craftkit/builder-renderer';

// Shell (canvas + panels — B2a/B2b/B3a; inline editing — B3c). B3c adds the
// content components (in-place text surface, formatting bubble, block action
// bar) and the block-action helpers; the floating/anchor/session plumbing the
// canvas drives internally stays off the surface, the same policy that keeps
// createRectIndex and systemGeometryPorts internal.
export {
  BuilderShell,
  ChromeButton,
  IconRail,
  StatusBar,
  TopBar,
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
  type ChromeButtonProps,
  type ChromeButtonSize,
  type ChromeButtonVariant,
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
  type IconRailProps,
  type PaletteProps,
  type ChangeDoor,
  type RailItem,
  type RecentChange,
  type StatusBarProps,
  type StatusBarTool,
  type TopBarDevice,
  type TopBarProps,
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
  // The deterministic PORTS an application supplies when it needs its own
  // clock or id source — the assistant's preflight runs on a scratch kernel and
  // must never borrow the live one's, because a shared id source hands out ids
  // the real document then claims. Law D says ports are injected, never
  // ambient, so the app has to be able to name them; this is the only door it
  // has to the family.
  systemClock,
  systemIds,
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
  type BlockSlotChildMetadata,
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
  type SlotDecl,
  type SlotName,
  type Surface,
  type Transaction,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

/*
  The AI engine, re-exported so an application reaches it through the preset.

  ADR 0003 lets a non-builder member depend on `@craftkit/builder` and nothing
  deeper, and the playground was importing `@craftkit/builder-ai` directly —
  which `check:workspace` refuses. `export *` rather than a hand-copied list,
  because a curated re-export is a second surface to keep in step with the
  first, and it drifts the moment the engine gains an export.
*/
export * from '@craftkit/builder-ai';
