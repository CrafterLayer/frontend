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
  CodeEditor,
  SourceImpactBar,
  type CodeEditorCompletion,
  type CodeEditorController,
  type CodeEditorDiff,
  type CodeEditorLanguage,
  type CodeEditorModuleLoader,
  type CodeEditorProps,
  type SourceImpact,
  type SourceImpactBarProps,
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
/*
  Free composition: the block, the CSS door it shares with the page root, and
  the utility vocabulary. The vocabulary is exported because it is the SOURCE
  the application's Tailwind directives are generated from — an app that cannot
  import it would have to restate the list, which is the drift this design
  exists to prevent.
*/
export {
  CUSTOM_CLASS_PREFIX,
  UTILITY_VOCABULARY,
  expandUtilityPattern,
  isCustomHookClass,
  hasUtilityClassOracle,
  setUtilityClassOracle,
  unknownUtilityClasses,
  utilitySourceDirectives,
  utilityVocabulary,
  type UtilityPattern,
  type UtilityClassOracle,
} from '@craftkit/builder-schema';
export {
  builderCustomCode,
  customCodeSchema,
  findCssRejection,
  scopeCustomCodeCss,
  type CssRejection,
  type CustomCodeBlockProps,
  type CustomCodeCssPolicy,
} from '@craftkit/builder-custom-code';
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
  type CarouselProps, type ChartProps,
  type ComparisonTableProps,
  type ContactProps, type CountdownProps,
  type ContentSectionProps,
  type CtaProps,
  type FaqProps,
  type FormSectionProps,
  type GalleryProps,
  type RichTextBlockProps,
  type FeaturesProps,
  type HeroProps,
  type LocationProps, type LogoCloudProps, type MenuSectionProps,
  type NewsletterProps,
  type PricingProps,
  type PortfolioGridProps,
  type ProductGridProps,
  type PromoBannerProps,
  type ProcessStepsProps,
  type StatsProps, type TableProps,
  type TeamProps,
  type TestimonialsProps, type TimelineProps,
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
  createLiveUtilities,
  darkTheme,
  lightTheme,
  renderStaticMarkup,
  resolveResponsiveProps,
  designSystemToCssVars,
  themeFromDesignSystem,
  themeToCssVars,
  useKernelSelector,
  type CanvasFrameProps,
  type DocumentViewProps,
  type LiveUtilities,
  type LiveUtilitiesOptions,
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
  AssetTableProvider,
  resolveImage,
  useAssetTable,
  type AssetTable,
  type AssetTableProviderProps,
  type ResolvedImage,
} from '@craftkit/builder-renderer';

// Shell (canvas + panels — B2a/B2b/B3a; inline editing — B3c). B3c adds the
// content components (in-place text surface, formatting bubble, block action
// bar) and the block-action helpers; the floating/anchor/session plumbing the
// canvas drives internally stays off the surface, the same policy that keeps
// createRectIndex and systemGeometryPorts internal.
export {
  AssetPicker,
  type AssetPickerProps,
  BuilderShell,
  ChromeButton,
  IconRail,
  StatusBar,
  TopBar,
  BUCKET_THRESHOLDS,
  BlockActionBar,
  CodePreviewFrame,
  DeviceBar,
  EditorCanvas,
  InsertionPicker,
  SelectionToolbar,
  GENERATION_STAGE_IDS,
  GENERATION_STAGE_LABELS,
  GenerationProgress,
  InlineTextSurface,
  Inspector,
  LayersTree,
  Palette,
  PreviewMode,
  DesignSystemPanel,
  SitePages,
  TokenSwatchGrid,
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
  type CodePreviewFrameProps,
  type CodePreviewFrameStatus,
  type DeviceBarProps,
  type DeviceState,
  type DragPayload,
  type DropTarget,
  type EditingBucket,
  type EditorCanvasProps,
  type FloatingHostPorts,
  type GenerationProgressProps,
  type GenerationStage,
  type GenerationStageId,
  type GenerationStageStatus,
  type GeometryPorts,
  type InlineTextSurfaceProps,
  type InsertionChoice,
  type InsertionPickerMode,
  type InsertionPickerOption,
  type InsertionPickerProps,
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
  type PreviewMount,
  type DesignSystemPanelProps,
  type SitePagesProps,
  type TokenSwatchGridProps,
  type RectIndex,
  type SelectionToolbarAction,
  type SelectionToolbarProps,
  type TextBubbleAction,
  type TextBubbleProps,
} from '@craftkit/builder-shell';

// Kernel access (creation + command authoring + helpers)
export {
  createBuilder,
  // The SITE kernel (013): a whole site behind one door, with each page
  // reachable as an ordinary `BuilderKernel`.
  createSiteBuilder,
  projectAfterChanges,
  prepareCodeChangesRebase,
  type ApplyCodeChangesArgs,
  type CodeFileChange,
  defineCommand,
  // The SITE door (013). An app that builds a whole site — pages, shared
  // regions, one design system — reaches these commands the same way it reaches
  // the page ones: through this module, never by importing `builder-core`.
  defineSiteCommand,
  emptyDocument,
  insertedNodeId,
  isSiteCommandName,
  // The site's load path, and the lift that turns a document a person already
  // has into a one-page site byte for byte (FR-007).
  liftDocumentSession,
  openDocument,
  openSite,
  siteCommands,
  type BuilderKernel,
  type BuilderSiteKernel,
  type CoreCommandName,
  type CoreCommands,
  type CreateBuilderOptions,
  type CreateSiteBuilderOptions,
  type OpenDocumentOptions,
  type OpenSiteOptions,
  type SiteCommandName,
  type SiteCommands,
  type SiteGroupStep,
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
  // The typed error constructor and its guard. An application that implements a
  // PORT — a persistence adapter of its own, say — must be able to reject in the
  // builder's OWN dialect: callers branch on `code`, and an adapter that invents
  // a second error shape for `persist/seq-conflict` breaks every one of them.
  builderError,
  defineBlockSchema,
  emptyRichText,
  isBuilderError,
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
  // The persistence PORT itself. `openDocument` is already exported and takes an
  // adapter as its first argument, so an application could name the door but not
  // the thing it had to build to walk through it. The SITE pair is here for the
  // same reason: `openSite` is exported above.
  type PersistedSession,
  type PersistedSiteSession,
  type PersistenceAdapter,
  type SitePersistenceAdapter,
  type RichTextDoc,
  /*
    The SITE contract (013). An application that boots on a site has to be able
    to name the shape it stores, seed one from a document it already has, and
    validate what it read — all three without reaching past this door (ADR 0003).
  */
  /*
    The document format version. Already on the headless door; an application
    that constructs a document of its own — a fixture, a template, a page inside
    a site it is seeding — has to stamp the same number, and guessing `1` is how
    a fixture silently stops migrating.
  */
  LATEST_SCHEMA_VERSION,
  LATEST_SITE_VERSION,
  codeFileHash,
  codeProjectSchema,
  migrateSite,
  siteFromDocument,
  validateSite,
  /*
    And the design system a site carries. `defaultDesignSystem()` is what
    `siteFromDocument` installs, so an application constructing a site of its own
    — a fixture, a test, a template — needs the same starter rather than a second
    set of values that drift from it.
  */
  contrastRatio,
  defaultDesignSystem,
  validateDesignSystem,
  type DesignPairing,
  type DesignSystem,
  type BuilderSite,
  type CodePageReference,
  type CodeFile,
  type CodeProject,
  type PersistenceAck,
  type RunRecord,
  type RunUnitRecord,
  runRecordSchema,
  selectionTargetSchema,
  type CompileDiagnostic,
  sourceHandleSchema,
  artifactFileSchema,
  type InsertionAnchor,
  type PageId,
  type SharedRegion,
  type SelectionCapability,
  type SelectionTarget,
  type SourceHandle,
  type SharedImpactApproval,
  type AssetEntry,
  type AssetId,
  type AssetLibraryPort,
  type ArtifactFile,
  type AssetRef,
  type ImageProp,
  type JsonRecord,
  imagePropSchema,
  type SharedRegionId,
  type SharedRegionKind,
  type SitePage,
  type SiteValidationIssue,
  type SiteValidationResult,
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
export {
  buildElementRecipe, ELEMENT_RECIPE_CATALOG, ELEMENT_RECIPE_IDS, elementRecipeContentSchema,
  type ElementRecipeContent, type ElementRecipeId, type ElementRecipePalette,
} from '@craftkit/builder-schema';

/*
  The SITE codec, re-exported for the same reason the engine is.

  ADR 0003 lets an application depend on `@craftkit/builder` and nothing deeper,
  so a host that has to commit a generated site — diff a draft against the live
  one, fingerprint what it started from — can only reach the codec through here.
  The engine itself cannot: `@craftkit/builder-ai` and `@craftkit/builder-transforms`
  are both layer 2, which is why `commitGeneratedSite` takes the diff and the
  fingerprint as ports rather than computing them.

  Curated rather than `export *`: the DOCUMENT half of this codec is already
  reachable through the code-view extension's registered projection, and adding a
  second way to reach the same functions would leave a reader guessing which one
  a call site meant.
*/
export {
  SITE_MANIFEST_PROJECTION_ID,
  SITE_MANIFEST_VERSION,
  parseSite,
  parseSiteManifest,
  parseSitePage,
  parseSiteRegion,
  projectSite,
  projectSiteManifest,
  projectSitePage,
  projectSiteRegion,
  type SiteProjectionText,
  projectPageRoutes,
  resolveDocumentPageLinks,
  resolvePageHref,
  resolvePageLinks,
  type ResolvedPageRoute,
  projectSitemap,
  type ProjectSitemapOptions,
  type SitemapPageProjection,
  type SitemapProjection,
  type SitemapSharedReference,
  type SitemapThumbnail,
} from '@craftkit/builder-transforms';

export {
  createInsertionAnchor,
  createSelectionController,
  intersectSelectionCapabilities,
  reconcileSelection,
  revalidateInsertionAnchor,
  type InsertionAnchorFailureReason,
  type InsertionAnchorResolver,
  type InsertionAnchorResult,
  type ResolvedInsertionOwner,
  type ResolvedSelectionIdentity,
  type SelectionController,
  type SelectionIdentityResolver,
  type SelectionInvalidReason,
  type SelectionReconciliation,
  type SelectionSnapshot,
} from '@craftkit/builder-shell';
// static-export additions (2026-09-30): the renderer's static site exporter,
// re-exported so the playground's "Publish site" reaches it through this door.
export {
  exportStaticSite,
  type ExportStaticSiteOptions,
  type StaticSiteFile,
  type StaticSitePageInput,
  type StaticSiteResult,
} from '@craftkit/builder-renderer';
// end static-export additions
// ── P11-integration (style-manager DESIGN.md) ──
// The site design library on the canvas: the context a render reads the
// library and the named-style transform from, its stylesheet, and the
// transform itself (D6), so the playground provides them through this door.
export {
  buildLibraryCss,
  createNamedStyleTransform,
  CustomCodeClassTransformContext,
  SiteDesignContext,
  SiteLibraryStyle,
  type CustomCodeClassTransform,
  type NamedStyleTransform,
  type SiteDesign,
} from '@craftkit/builder-renderer';
export { replayMotion } from '@craftkit/builder-renderer';
export type {
  NamedStyle,
  PaletteColor,
  SavedTemplate,
  SiteLibrary,
  StyleBucket,
  StyleState,
} from '@craftkit/builder-schema';
// The style manager, the manual editor and the design-system surfaces (§A, §E, §G).
export {
  ASSET_MANAGER_LABELS_AR,
  ASSET_MANAGER_LABELS_EN,
  AssetManager,
  CLASS_MANAGER_LABELS_AR,
  CLASS_MANAGER_LABELS_EN,
  ClassManager,
  commitSiteSteps,
  createElementClipboard,
  createElementSelection,
  DESIGN_LIBRARY_TRANSFER_LABELS_AR,
  DESIGN_LIBRARY_TRANSFER_LABELS_EN,
  DESIGN_SYSTEM_PANEL_LABELS_AR,
  DESIGN_SYSTEM_PANEL_LABELS_EN,
  DesignLibraryTransfer,
  detectShortcutPlatform,
  EDITOR_SHORTCUTS,
  ELEMENT_ACTION_LABELS_AR,
  ELEMENT_ACTION_LABELS_EN,
  ELEMENT_NAME_WORDS_AR,
  ELEMENT_NAME_WORDS_EN,
  ELEMENT_QUICK_BAR_LABELS_AR,
  ELEMENT_QUICK_BAR_LABELS_EN,
  ElementQuickBar,
  findCanvasElement,
  FONT_PICKER_LABELS_AR,
  FONT_PICKER_LABELS_EN,
  FontPicker,
  HISTORY_LIST_LABELS_AR,
  HISTORY_LIST_LABELS_EN,
  HistoryList,
  ICON_BROWSER_LABELS_AR,
  ICON_BROWSER_LABELS_EN,
  IconBrowser,
  IMAGE_CROPPER_LABELS_AR,
  IMAGE_CROPPER_LABELS_EN,
  ImageCropper,
  LAYERS_TREE_LABELS_AR,
  LAYERS_TREE_LABELS_EN,
  LIBRARY_PANEL_LABELS_AR,
  LIBRARY_PANEL_LABELS_EN,
  LibraryPanel,
  makeSymbolSteps,
  PALETTE_RAMP_EDITOR_LABELS_AR,
  PALETTE_RAMP_EDITOR_LABELS_EN,
  paletteSwatches,
  PaletteRampEditor,
  primaryTarget,
  resolveEditorShortcut,
  resolveElementTarget,
  runEditorAction,
  SHORTCUTS_DIALOG_LABELS_AR,
  SHORTCUTS_DIALOG_LABELS_EN,
  ShortcutsDialog,
  siteCommitFor,
  STYLE_PANEL_LABELS_AR,
  STYLE_PANEL_LABELS_EN,
  StylePanel,
  SYMBOLS_PANEL_LABELS_AR,
  SYMBOLS_PANEL_LABELS_EN,
  SymbolsPanel,
  themeColorSwatches,
  TREE_TEXT_ACTION_LABELS_AR,
  TREE_TEXT_ACTION_LABELS_EN,
  useEditorShortcuts,
  useSiteSnapshot,
  type AssetManagerProps,
  type ClassManagerProps,
  type DesignLibraryTransferProps,
  type EditorActionDeps,
  type EditorDevice,
  type EditorShortcutAction,
  type ElementClipboard,
  type ElementNameWords,
  type ElementQuickBarProps,
  type ElementSelection,
  type ElementTarget,
  type HistoryListProps,
  type LayersSaveTemplateRequest,
  type LibraryPanelProps,
  type ShortcutsDialogProps,
  type SiteCommit,
  type SiteDoor,
  type StylePanelProps,
  type StyleSource,
  type SymbolsPanelProps,
} from '@craftkit/builder-shell';
// ── end P11-integration ──
// ── fix pass (style-manager DESIGN.md P11) ──
export type { InspectorFocusRequest, InspectorStyleContext } from '@craftkit/builder-shell';
export { TOP_BAR_LABELS_AR, TOP_BAR_LABELS_EN, type TopBarLabels } from '@craftkit/builder-shell';
export type { LibrarySectionEntry, LibraryTab } from '@craftkit/builder-shell';
export type { StyleSectorId } from '@craftkit/builder-schema';
// A host installs the resolver so component props inside a tree are judged by their block's schema.
export {
  getCustomCodeComponentSchemaResolver,
  setCustomCodeComponentSchemaResolver,
  type CustomCodeComponentSchemaResolver,
} from '@craftkit/builder-schema';
// ── end fix pass ──
// arabic-editor additions: the editor UI's one typed catalogue (en/ar), its
// direction and Latin digits, and the label sets the host passes to surfaces.
export {
  BLOCK_NAMES_AR,
  EDITOR_CANVAS_LABELS_AR,
  EDITOR_CANVAS_LABELS_EN,
  EDITOR_CATALOGUES,
  EDITOR_LOCALES,
  INSPECTOR_LABELS_AR,
  INSPECTOR_LABELS_EN,
  PALETTE_LABELS_AR,
  PALETTE_LABELS_EN,
  SITE_PAGES_LABELS_AR,
  SITE_PAGES_LABELS_EN,
  STATUS_BAR_LABELS_AR,
  STATUS_BAR_LABELS_EN,
  blockNameKey,
  editorCatalogue,
  editorDirection,
  formatEditorNumber,
  inspectorLabelsFor,
  isEditorLocale,
  latinDigitsLocale,
  localBlockName,
  localHistoryLabel,
  logicalArrowKey,
  resolveChromeDir,
  schemaName,
  schemaOption,
  type EditorCanvasLabels,
  type EditorCatalogue,
  type EditorDirection,
  type EditorLocale,
  type EditorStrings,
  type InspectorChromeLabels,
  type InspectorLabels,
  type PaletteLabels,
  type SitePagesLabels,
  type StatusBarLabels,
} from '@craftkit/builder-shell';
// end arabic-editor additions
// ── block-parts (2026-10-06) ── P3-inspector-fields additions
// The Inspector's field services and its field resolution: a host mounts
// FieldServicesProvider around composed rows, and the playground's
// field-kinds registry gate resolves every registered prop through the same
// resolver the Inspector uses.
export {
  FieldServicesProvider,
  defaultFieldFor,
  partBindingFor,
  propsShapeOf,
  repeaterSchemaInfo,
  resolveField,
  richTextPlainText,
  unwrapSchema,
  useFieldServices,
  type DefaultControl,
  type FieldPage,
  type FieldResolutionContext,
  type FieldServices,
  type FieldServicesProviderProps,
  type PartBinding,
  type ResolvedField,
} from '@craftkit/builder-shell';
export {
  blockPartsOf,
  type BlockParts,
  type BlockPropertyGroup,
  type BlockPropertyKind,
} from '@craftkit/builder-schema';
// ── /block-parts ──
// script-wiring additions (2026-10-08): code mode (agent-script DESIGN §A.9/§A.13) — what a host
// needs to hand a run its site and read its script reports. The rest arrives via `export *` above.
export {
  SCRIPT_TOOL_NAME,
  scriptCrossPage,
  type AiAgentScriptSite,
  type AiPlanSite,
  type ScriptCrossPage,
  type ScriptPage,
  type ScriptRunReport,
  type ScriptSite,
} from '@craftkit/builder-ai';
// end script-wiring additions
// library-playground additions (2026-10-08): the Library's template cards (agent-script DESIGN §B.5)
// — the catalog the host passes as `templateCards`, and the shell card that renders it. The page-kit
// helpers (`readPageKit`, `writePageKit`) and `PHOTO_CATALOG` arrive via `export *` from builder-ai.
export {
  marketingTemplateCatalog,
  type MarketingTemplateCard,
} from '@craftkit/builder-blocks-marketing';
export {
  TEMPLATE_CARD_LABELS_AR,
  TEMPLATE_CARD_LABELS_EN,
  TemplateCard,
  type LibraryPageKit,
  type TemplateCardInfo,
  type TemplateCardLabels,
  type TemplateCardProps,
} from '@craftkit/builder-shell';
// end library-playground additions
// pixi-studio:runtime-wiring additions (2026-10-10): the Script Studio's sandboxed preview
// (DESIGN §D.3) and the `ck` scene/sound types, so the playground reaches them through this door.
export {
  STUDIO_PREVIEW_MESSAGES,
  STUDIO_PREVIEW_REGION_ID,
  buildStudioPreviewHtml,
  studioPreviewCsp,
  type CkAudioBands,
  type CkSceneContext,
  type CkSceneOptions,
  type CkScriptApi,
  type CkScriptParamValue,
  type CkSoundApi,
  type StudioPreviewOptions,
  type StudioPreviewTrust,
} from '@craftkit/builder-renderer';
// end pixi-studio:runtime-wiring additions
