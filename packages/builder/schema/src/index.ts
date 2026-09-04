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
  CUSTOM_CSS_META_VALUE,
  customCodeClassNames,
  customCodeComponentTypes,
  customCodeIconNames,
  customCodeTree,
  customCodeTreeSchema,
  customCss,
  emptyCustomCodeTree,
  isCustomCodeTag,
  isCustomCodeTreeSchema,
  isCustomCssSchema,
  type CustomCodeAttribute,
  type CustomCodeComponent,
  type CustomCodeElement,
  type CustomCodeIcon,
  type CustomCodeNode,
  type CustomCodeRoot,
  type CustomCodeTag,
} from './custom-code/custom-code-tree';
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
  unknownUtilityClasses,
  utilitySourceDirectives,
  utilityVocabulary,
  type UtilityPattern,
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
