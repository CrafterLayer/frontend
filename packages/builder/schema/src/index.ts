// @craftkit/builder-schema — the constitution: every pure contract of the builder
// kernel. Zero runtime dependencies beyond zod; React appears as types only.

export {
  type JsonValue,
  type JsonObject,
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

export { blockPropsJsonSchema } from './json-schema';

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
  type PersistenceAdapter,
  type ResolveCtx,
} from './ports';

export { type CommandInput, type CommandRuntime, type RegisteredCommand } from './commands';

export {
  type AiContextBlockCatalogEntry,
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
  type DataSourceDef,
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
  siteDesignSystemSchema,
  siteFromDocument,
  sitePageSchema,
  validateSite,
  type BuilderSite,
  type PageId,
  type SharedRegion,
  type SharedRegionId,
  type SharedRegionKind,
  type SiteDesignSystem,
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
