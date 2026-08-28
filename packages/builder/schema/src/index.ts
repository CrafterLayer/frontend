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

export { type BlockSchema, type SlotDecl, defineBlockSchema } from './blocks/define-block-schema';

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
  type AiContextProvider,
  type BlockRenderComponent,
  type BlockRenderProps,
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
