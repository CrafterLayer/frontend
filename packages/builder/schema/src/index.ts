// @craftkit/builder-schema — the constitution: every pure contract of the builder
// kernel. Zero runtime dependencies beyond zod; React appears as types only.

export {
  type JsonValue,
  type JsonObject,
  type JsonRecord,
  type JsonViolation,
  type JsonViolationKind,
  MAX_JSON_DEPTH,
  RESERVED_JSON_KEYS,
  canonicalizeJsonValue,
  findJsonViolation,
  isJsonValue,
} from './json/json-value';

export { jsonRecordZod, jsonValueZod } from './json/json-value-schema';

export {
  type Author,
  type Breakpoint,
  type BuilderDocument,
  type ContentDirection,
  type DataPath,
  type Node,
  type NodeId,
  type SlotName,
  type Surface,
  BREAKPOINTS,
  DEFAULT_SLOT,
  LATEST_SCHEMA_VERSION,
} from './document/types';

export { type BlockSchemaLookup, validateDocument } from './document/validate';

export { type Migration, type MigrationRunner, createMigrationRunner } from './document/migrations';

export {
  type BlockPropertyGroup,
  type BlockPropertyGroups,
  type BlockPropertyKind,
  type BlockPropertyTab,
  type BlockSchema,
  type SlotDecl,
  defineBlockSchema,
} from './blocks/define-block-schema';

export {
  type RawStyleLiteral,
  type RawStyleLiteralKind,
  findRawStyleLiterals,
} from './blocks/style-values';

export { blockPropsJsonSchema, commandArgsJsonSchema } from './json-schema';

export {
  type BuilderErrorCode,
  type BuilderErrorInit,
  BuilderError,
  builderError,
  isBuilderError,
} from './errors';

export { type Patch, type PatchOp, type Transaction } from './transactions';

export {
  type ClockPort,
  type DataSource,
  type IdPort,
  type PersistedSession,
  type PersistedSiteSession,
  type PersistenceAdapter,
  type SitePersistenceAdapter,
  type ResolveCtx,
} from './ports';

export {
  type CommandInput,
  type CommandRuntime,
  type RegisteredCommand,
  type RegisteredSiteCommand,
  type SiteCommandInput,
} from './commands';

export {
  type AiContextBlockCatalogEntry,
  type AiContextCommandCatalogEntry,
  type AiContextCompositionCatalogEntry,
  type AiContextProvider,
  type AiContextReadApi,
  type AiContextRegistryRead,
  type AiContextStateRead,
  type AiContextWidgetCatalogEntry,
  type BlockRenderComponent,
  type BlockRenderProps,
  type BlockSlotChildMetadata,
  type ContextFragment,
  type ContextFragmentInput,
  type ContextFragmentKind,
  type ContextFragmentTrust,
  type DataSourceDef,
  type ElementFocus,
  type EventBus,
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
  type KernelApi,
  type KernelEvents,
  type KernelState,
  type KeymapDef,
  type OverlayToolDef,
  type OverlayToolRenderer,
  type PanelContribution,
  type PanelProps,
  type ProjectionDef,
  type ProjectionPorts,
  type RegisteredBlock,
  type RegistryRead,
  type StateFacade,
  defineContextFragment,
} from './extensions/contribution-points';

export {
  type DeclarativeExtensionManifest,
  type ExtensionManifest,
  type TrustedBlockContribution,
  type TrustedExtensionManifest,
} from './extensions/manifests';

export { type Tier2ValidationResult, validateTier2Manifest } from './extensions/validate-tier2';

export {
  type CompositionDef,
  type DeclarativeSubTree,
  type DeclarativeWidgetTypeDef,
  type SchemaDescriptor,
  type SkinDef,
  type SkinState,
  SKIN_STATES,
} from './widgets/contract';

export { validateSkin } from './widgets/validate-skin';
export {
  RICH_TEXT_META_KEY,
  RICH_TEXT_META_VALUE,
  emptyRichText,
  isRichTextSchema,
  richText,
  richTextDocSchema,
  type RichTextBlockNode,
  type RichTextDoc,
  type RichTextInline,
  type RichTextListItem,
  type RichTextMark,
} from './rich-text/rich-text';

/*
  Free composition (the assistant's escape hatch): the layer-0 CONTRACT only —
  the node vocabulary, the two ceilings, and the walks that the AI door and the
  Inspector share. Rendering is the renderer's concern; this file states only
  what may be STORED, and states it strictly.

  Named `custom-code` rather than `composition` because this registry already
  calls page templates "compositions" (`CompositionDef`, `registry.compositions`
  — see ./widgets/contract). Two meanings for one word in one export surface is
  a bug waiting on a reader's assumption.
*/
export {
  CUSTOM_CODE_ATTRIBUTES,
  CUSTOM_CODE_MAX_DEPTH,
  CUSTOM_CODE_MAX_NODES,
  CUSTOM_CODE_META_KEY,
  CUSTOM_CODE_META_VALUE,
  CUSTOM_CODE_ICON_NAME,
  CUSTOM_CODE_TAGS,
  CUSTOM_CODE_REGION_JS_MAX,
  CUSTOM_CSS_META_VALUE,
  CUSTOM_JS_META_VALUE,
  customCodeClassNames,
  customCodeComponentTypes,
  customCodeIconGaps,
  customCodeIconNames,
  customCodeTree,
  customCodeTreeSchema,
  customCss,
  customJs,
  emptyCustomCodeTree,
  isCustomCodeTag,
  isCustomCodeTreeSchema,
  isCustomCssSchema,
  isCustomJsSchema,
  type CustomCodeAttribute,
  type CustomCodeComponent,
  type CustomCodeElement,
  type CustomCodeIcon,
  type CustomCodeIconGap,
  type CustomCodeNode,
  type CustomCodeRoot,
  type CustomCodeTag,
} from './custom-code/custom-code-tree';
// design-code additions (2026-09-28): the per-tag attribute policy, the svg
// family and the case-folding spellings the renderer and the AI readers share.
export {
  CUSTOM_CODE_SVG_ATTRIBUTES,
  CUSTOM_CODE_SVG_TAGS,
  customCodeAttributeProblem,
  customCodeAttributeSpelling,
  customCodeSrcsetUrls,
  customCodeTagSpelling,
  customCodeTreeProblems,
  isCustomCodeSvgTag,
  safeCustomCodeUrl,
} from './custom-code/custom-code-tree';
// end design-code additions
/*
  The custom-CSS refusal list sits beside the `customCss()` declaration it
  polices rather than in the custom-code extension, because the AI plan door
  must refuse a stylesheet BEFORE it is applied and a headless plan package
  cannot depend on a React extension. See ./custom-code/custom-css.
*/
export {
  CUSTOM_CSS_FONT_HOSTS,
  CUSTOM_CSS_FONT_IMPORT,
  customCssPropertyNames,
  findCssRejection,
  normalizeCssForInspection,
  type CssRejection,
} from './custom-code/custom-css';
export {
  customCodeNodeAtPath,
  formatCustomCodePath,
  parseCustomCodePath,
  replaceCustomCodeNodeAtPath,
  type CustomCodePath,
} from './custom-code/custom-code-path';
export { LUCIDE_VERSION, isLucideIconName, lucideIconNames } from './custom-code/lucide-icon-names';
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
} from './custom-code/utility-vocabulary';

/*
  Asset library (013): the layer-0 CONTRACT only — identity, metadata, the
  one-method port, and the law that every reference must resolve to a held
  asset. Selection lives at layer 2; the library's contents are site data.
  The agent can only ever emit an assetId, so an invented address is a
  validation failure rather than a broken image.
*/
export {
  type AssetEntry,
  type AssetEntryValidationIssue,
  type AssetEntryValidationResult,
  type AssetId,
  type AssetLibraryPort,
  type AssetRef,
  type AssetReferenceIssue,
  type CollectedAssetRef,
  type ImageProp,
  assetEntrySchema,
  assetRefSchema,
  collectAssetRefs,
  imagePropSchema,
  isAssetRef,
  validateAssetEntry,
  validateAssetReferences,
} from './assets';

/*
  Motion (013): the vocabulary, at layer 0 so the planner can EMIT motion and
  have it refused at the door, and so a document carrying motion round-trips
  whether or not any animation engine is loaded. Scales are named STEPS — a
  raw millisecond count is a literal in exactly the way '16px' is. The engine
  that renders these steps is a contained extension; this is only the contract.
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
  type MotionValidationIssue,
  type MotionValidationResult,
  type RevealEffect,
  type ScrollEffect,
} from './motion';

/*
  The page's design tokens (013). They live at layer 0 because the AI planner
  is layer 2, the renderer is layer 2, and ADR 0003 forbids sideways edges —
  so the planner could not otherwise import the vocabulary it generates. The
  renderer re-exports all of it, so no existing import broke.
*/
export {
  tokenCssName,
  type ColorToken,
  type MeasurementToken,
  type Theme,
  type TokenName,
} from './theme';

/*
  Block prop defaults (013 repair). A schema declaring `.default('lg')` did not
  actually produce 'lg' on the render path: nothing ever parsed props against
  the schema, so an omitted prop reached the block as `undefined` and was
  interpolated into a class name matching no rule. Measured in the browser on
  the playground's own landing page, that was eight dead classes and a hero with
  0px block padding.
*/
export { blockPropDefaults, withBlockPropDefaults } from './blocks/prop-defaults';

/*
  The SITE (013). The unit of work becomes a site: an ordered page set, its
  shared regions, one design system, and one asset table — validated as a whole
  at the layer that already owns documents.

  Each page nests a `BuilderDocument` VERBATIM at the current page format, which
  is what "the site wraps pages" means concretely: a page lifted out of a site
  is still a valid document, and every proof B0–B4 bought keeps holding without
  being re-derived at a new shape.
*/
export {
  LATEST_SITE_VERSION,
  builderSiteSchema,
  migrateSite,
  pageIdSchema,
  sharedRegionIdSchema,
  sharedRegionKindSchema,
  sharedRegionSchema,
  siteFromDocument,
  sitePageSchema,
  validateSite,
  type BuilderSite,
  type PageId,
  type SharedRegion,
  type SharedRegionId,
  type SharedRegionKind,
  siteNestedDocumentSchema,
  type SitePage,
  type SiteValidationIssue,
  type SiteValidationResult,
} from './site';

/*
  Contrast, at layer 0 because the planner has to reason about it WHILE it
  chooses a palette, not after. `luminanceForRatio` inverts the WCAG formula so
  a colour can be built to clear a ratio instead of measured and retried — the
  retry loop is unbounded, and its successes drift every generated palette
  toward the same safe grey.
*/
export {
  CONTRAST_LARGE_TEXT,
  CONTRAST_NORMAL_TEXT,
  checkContrast,
  contrastRatio,
  luminanceForRatio,
  parseHex,
  relativeLuminance,
  type ContrastCheck,
  type Rgb,
} from './theme';

/*
  The generated DESIGN SYSTEM (013): a token map plus the provenance around it
  — the name, the type pairing, the seed that reproduces it, and the pairings
  it AUTHORIZES.

  The vocabulary is also published at runtime. `tokens.ts` states it as types,
  which vanish at build, so a validator that must reject an unknown token key
  had nothing to check against. The lists below are derived from maps declared
  `satisfies Record<Token, true>`, which makes the compiler refuse a missing or
  extra name — one vocabulary, enforced, rather than a type union and a
  hand-copied array that drift the first time a token is added.
*/
/*
  The smallest valid document, moved down from the kernel so the SITE commands
  can mint a page without importing `create-builder.ts` — which imports the
  command directory they live in. See the file for the cycle it breaks.
*/
export { emptyDocument } from './document/empty-document';

export {
  COLOR_TOKENS,
  MEASUREMENT_TOKENS,
  TOKEN_NAMES,
  isColorToken,
  isTokenName,
  validateDesignSystem,
  designSystemSchema,
  /*
    The starter VALUES, now at layer 0 beside the types that moved here first.
    A site stores its own design system and `siteFromDocument` has to give a
    lifted page a real one — which it cannot do from a layer above. The renderer
    re-exports these rather than declaring a second set.
  */
  darkTheme,
  defaultDesignSystem,
  lightTheme,
  type DesignPairing,
  type DesignSystem,
  type DesignSystemIssue,
  type DesignSystemIssueCode,
  type DesignSystemValidationResult,
  type DesignTypography,
  type PairingSize,
} from './theme';

/*
  Utility classes a document may hold (013). Allowed, because the bridge binds
  Tailwind's `--spacing` to `--t-space-unit`: `p-4` is four STEPS of the site's
  rhythm, not sixteen pixels. Exactly two families are refused — arbitrary
  values in brackets, and Tailwind's own colour palette — because those are the
  only ones the design system cannot reach.
*/
export {
  findRejectedUtilities,
  isStorableUtilityClass,
  splitUtilities,
  type UtilityRejection,
  type UtilityRejectionCode,
} from './blocks/utility-classes';
export * from './code';
export * from './editing';
export * from './runtime';
export * from './agent';
// behaviors additions (2026-09-30): the closed data-ck-behavior enum the
// renderer's mountBehaviors runs, and the params that tune it.
export {
  CUSTOM_CODE_BEHAVIORS,
  CUSTOM_CODE_BEHAVIOR_PARAMS,
  isCustomCodeBehavior,
  type CustomCodeBehavior,
} from './custom-code/custom-code-tree';
// end behaviors additions
// seo additions (2026-09-30): the pure SEO core (DESIGN D.1-D.2) — page/site
// SEO data on the page root, width-fitted meta, Arabic slugs, content
// extraction, the JSON-LD @graph, the export head, sitemap/robots and vague
// link text. NOTE: `pageSeoSchema` / `PageSeo` here are the PAGE-ROOT SEO
// shape; this explicit export shadows the code-page `pageSeoSchema` that
// `export * from './code'` also carries (no consumer imported that one by
// name; code pages keep using it internally via ./code/types).
export * from './seo';
export { pageSeoSchema, type PageSeo } from './seo';
// end seo additions
// ── P2-tree-commands (style-manager DESIGN.md) ──
// Pure, immutable path-addressed operations over one custom-code tree (§D.2);
// the custom-code extension's tree commands wrap them behind the door.
export {
  adjustAfterRemoval,
  cloneTreeNode,
  duplicateNodeAt,
  extractNodeAt,
  formatTextRange,
  insertNodeAt,
  moveNode,
  patchNodeAt,
  removeNodeAt,
  setNodeAt,
  similarSiblings,
  treeNodeAt,
  unwrapNodeAt,
  wrapNodesAt,
  TREE_TEXT_MARKS,
  type TreeNodePatch,
  type TreeOpErrorCode,
  type TreeOpFailure,
  type TreeOpResult,
  type TreeTextMark,
  type TreeTextMarkExtras,
  type TreeWrapper,
} from './custom-code/custom-code-tree-ops';
// ── end P2-tree-commands ──
// ── P5-site-library (style-manager DESIGN.md) ──
// The optional site design library (§2, D5/D6): palette, named styles,
// symbols, saved templates, fonts and site motion settings, plus the readers
// that say where an entry is used.
export {
  applySymbolOverrides,
  DETACHED_SYMBOL_BLOCK_TYPE,
  expandNamedStyleMarkers,
  hasNamedStyleMarker,
  isLibraryId,
  isPaletteColorValue,
  isUploadedFontUrl,
  LIBRARY_ID_PATTERN,
  LIBRARY_LIMITS,
  libraryIdSchema,
  NAMED_STYLE_MARKER_PREFIX,
  namedStyleClassProblem,
  namedStyleIdOf,
  namedStyleMarker,
  namedStyleSchema,
  paletteColorSchema,
  paletteVariable,
  savedTemplateSchema,
  SITE_FONT_FAMILY,
  siteFontSchema,
  siteLibrarySchema,
  siteLibrarySettingsSchema,
  siteSymbolSchema,
  SYMBOL_INSTANCE_BLOCK_TYPE,
  symbolOverrideSchema,
  symbolOverridesSchema,
  UPLOADED_FONT_PREFIX,
  validateSiteLibrary,
  type LibraryId,
  type NamedStyle,
  type PaletteColor,
  type SavedTemplate,
  type SiteFont,
  type SiteFontScript,
  type SiteFontSource,
  type SiteLibrary,
  type SiteLibrarySettings,
  type SiteLibraryValidationResult,
  type SiteSymbol,
  type SymbolOverride,
} from './site/library';
export {
  describeLibraryUsage,
  describeLibraryUsages,
  findAssetUsages,
  findNamedStyleUsages,
  findPaletteUsages,
  findSymbolInstances,
  holdsClassToken,
  isSymbolInstance,
  libraryHosts,
  namedStyleUsageCounts,
  referencedSymbolIds,
  symbolCycle,
  walkLibraryValues,
  type LibraryHost,
  type LibraryUsage,
  type LibraryUsageOwner,
  type LibraryWalkVisitor,
} from './site/library-usage';
// ── end P5-site-library ──
// ── P3-vocabulary-renderer (style-manager DESIGN.md) ──
// The widened door (§D.1): forms, dialog, allowlisted iframes, audio, the svg
// text/filter family, motion attributes (§B.2), effect hooks (§C.1), Tabler
// icon names, editor metadata, the region css cap and the component-props
// resolver.
export {
  CUSTOM_CODE_AUTOCOMPLETE_TOKENS,
  CUSTOM_CODE_FORM_TAGS,
  CUSTOM_CODE_IFRAME_ALLOW,
  CUSTOM_CODE_IFRAME_REFERRER_POLICY,
  CUSTOM_CODE_IFRAME_SANDBOX,
  CUSTOM_CODE_IFRAME_SOURCES,
  CUSTOM_CODE_INPUT_TYPES,
  CUSTOM_CODE_LABEL_MAX,
  CUSTOM_CODE_REGION_CSS_MAX,
  CUSTOM_CODE_REL_TOKENS,
  CUSTOM_CODE_SVG_TEXT_TAGS,
  getCustomCodeComponentSchemaResolver,
  isAllowedIframeSrc,
  isCustomCodeIconName,
  parseCustomCodeIconName,
  setCustomCodeComponentSchemaResolver,
  type CustomCodeComponentSchemaResolver,
  type CustomCodeIconRef,
  type CustomCodeIconSet,
} from './custom-code/custom-code-tree';
export {
  CUSTOM_CODE_ENTRANCE_PRESETS,
  CUSTOM_CODE_HOVER_PRESETS,
  CUSTOM_CODE_LOOP_PRESETS,
  CUSTOM_CODE_MOTION_ATTRIBUTES,
  CUSTOM_CODE_MOTION_DELAYS,
  CUSTOM_CODE_MOTION_DISTANCES,
  CUSTOM_CODE_MOTION_EASES,
  CUSTOM_CODE_MOTION_NAME_ATTRIBUTES,
  CUSTOM_CODE_MOTION_ONCE,
  CUSTOM_CODE_MOTION_PARAMS,
  CUSTOM_CODE_MOTION_PRESETS,
  CUSTOM_CODE_MOTION_SPEEDS,
  CUSTOM_CODE_MOTION_STAGGERS,
  CUSTOM_CODE_MOTION_TRIGGERS,
  CUSTOM_CODE_MOTION_TRIGGER_TABLE,
  CUSTOM_CODE_SCROLL_PRESETS,
  CUSTOM_CODE_STAGGER_PRESETS,
  CUSTOM_CODE_TEXT_PRESETS,
  isHoverPreset,
  isMotionPreset,
  isMotionTrigger,
  motionPresetGroup,
  motionTriggerProblem,
  motionTriggersFor,
  type CustomCodeHoverPreset,
  type CustomCodeMotionEase,
  type CustomCodeMotionGroup,
  type CustomCodeMotionPreset,
  type CustomCodeMotionTrigger,
} from './custom-code/motion-vocabulary';
export {
  CUSTOM_CODE_EFFECTS,
  CUSTOM_CODE_EFFECT_PREFIX,
  customCodeEffectClass,
  customCodeEffectOfClass,
  isCustomCodeEffect,
  isCustomCodeEffectNamespace,
  type CustomCodeEffect,
} from './custom-code/effects-vocabulary';
export {
  TABLER_VERSION,
  isTablerIconName,
  tablerFilledIconNames,
  tablerOutlineIconNames,
} from './custom-code/tabler-icon-names';
// ── end P3-vocabulary-renderer ──
// ── P1-style-engine (style-manager DESIGN.md) ──
// The headless class-patch engine (§A.2–A.4): intents → className, the §A.4
// catalogue, named-style expansion, copy/paste style and ckTwMerge.
export * from './style';
// ── end P1-style-engine ──
// ── P12-fix-pass (style-manager DESIGN.md) ──
// The HTML content model the tree door enforces (void tags, phrasing-only
// parents, no interactive content inside a link or a button).
export {
  CUSTOM_CODE_VOID_TAGS,
  customCodeTagAccepts,
  customCodeTagHoldsContent,
} from './custom-code/custom-code-tree';
// ── end P12-fix-pass ──
// ── fix pass: tree asset references (style-manager DESIGN.md P11) ──
export {
  CUSTOM_CODE_ASSET_PREFIX,
  customCodeAssetId,
  customCodeAssetSrc,
} from './custom-code/asset-reference';
// ── end fix pass ──
// ── schema-media additions — media-motion (2026-10-06) ──
// The media and motion vocabulary (DESIGN §C.2, §D.2, §E): media behaviours,
// timeline recipes, scenes, engine markers and their params; and the pure
// media recipes (D10) the agent tools and the shell's Insert presets share.
export {
  CAROUSEL_INDICATORS,
  CUSTOM_CODE_ENGINE_KINDS,
  CUSTOM_CODE_ENGINE_MARKERS,
  CUSTOM_CODE_ENGINE_OF_MARKER,
  CUSTOM_CODE_ENGINE_PARAMS,
  CUSTOM_CODE_ENGINE_PARAM_OWNERS,
  CUSTOM_CODE_MEDIA_ATTRIBUTES,
  CUSTOM_CODE_MEDIA_BEHAVIORS,
  CUSTOM_CODE_MEDIA_BEHAVIOR_PARAMS,
  CUSTOM_CODE_MEDIA_BEHAVIOR_PARAM_OWNERS,
  CUSTOM_CODE_MEDIA_BEHAVIOR_TAGS,
  CUSTOM_CODE_MEDIA_PARAMS,
  CUSTOM_CODE_MEDIA_PART_ATTRIBUTES,
  CUSTOM_CODE_SCENE_INFO,
  CUSTOM_CODE_SCENES,
  CUSTOM_CODE_TIMELINE_RECIPE_INFO,
  CUSTOM_CODE_TIMELINE_RECIPES,
  customCodeEnginesOf,
  isCustomCodeEngineMarker,
  isCustomCodeMediaBehavior,
  isCustomCodeScene,
  // gsap-pixi additions (2026-10-08)
  HOSTED_SCENES,
  isHostedScene,
  SCENE_HOST_TAGS,
  type HostedScene,
  isCustomCodeTimelineRecipe,
  MEDIA_SWITCH_VALUES,
  SCENE_DENSITIES,
  SCENE_PALETTES,
  TIMELINE_DEPTHS,
  TIMELINE_REUSED_MOTION_PARAMS,
  TOGGLE_OPTIONS,
  type CarouselIndicator,
  type CustomCodeEngineKind,
  type CustomCodeEngineMarker,
  type CustomCodeEngineParam,
  type CustomCodeMediaBehavior,
  type CustomCodeMediaParam,
  type CustomCodeScene,
  type CustomCodeTimelineRecipe,
  type MediaBilingual,
  type MediaVocabularyInfo,
  type SceneDensity,
  type ScenePalette,
  type TimelineDepth,
  type ToggleOption,
} from './custom-code/media-vocabulary';
export * from './media-recipes';
// ── end schema-media additions ──
// ── block-parts (2026-10-06) ──
// Named inner elements of registered blocks (block-parts DESIGN §2.1–§2.5):
// the declaration and its registration gate, the renderer helper, the
// partStyles prop, nested prop paths and the pure part-edit planners.
export {
  bindPathOf,
  bindPatternOf,
  blockPartsOf,
  formatPropPath,
  hasPartInstance,
  PART_NAME_PATTERN,
  parsePropPath,
  partInstances,
  partStyleKey,
  propSchemaAt,
  unwrapPropSchema,
  validateBlockParts,
  type BlockPartDecl,
  type BlockPartKind,
  type BlockParts,
  type PartBind,
  type PartInstance,
  type PartRef,
  type PartValueSlot,
} from './blocks/block-parts';
export { getAtPropPath, setAtPropPath, type PropPath } from './blocks/prop-path';
export {
  isPartStylesSchema,
  PART_DIRECTIONS,
  PART_STYLE_CLASS_MAX,
  PART_STYLE_KEY_PATTERN,
  PART_STYLES_META_KEY,
  PART_STYLES_META_VALUE,
  partStylesKeyOf,
  partStylesProp,
  readPartStyles,
  type PartStyle,
} from './blocks/part-styles';
export {
  blockPartProps,
  // ── block-parts (2026-10-06) ──
  forwardedPartProps,
  mergePartClasses,
  PART_OWNER_ATTRIBUTE,
  PART_OWN_CLASSES_ATTRIBUTE,
  // ── /block-parts ──
  type PartAttributeOptions,
  type PartAttributes,
  type PartRenderContext,
} from './blocks/part-attributes';
export {
  planPartDir,
  planPartListOp,
  planPartStyle,
  planPartValue,
  type PartListOp,
  type PartPlan,
  type PartStep,
} from './blocks/part-edits';
export type { PartFocus } from './extensions/contribution-points';
// ── /block-parts ──
