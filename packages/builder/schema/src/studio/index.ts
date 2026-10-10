/*
  Pixi Studio — the shared, headless half (pixi-studio DESIGN.md §A.1, D14):
  the script/sound library data model and its zod schemas, param helpers, the
  door's script lint, library detection for the export, search, the scene API
  reference and the bilingual labels. Pure: no DOM, no Pixi.
*/

export {
  SCRIPT_AUTHORS,
  SCRIPT_KINDS,
  SCRIPT_PARAM_GROUPS,
  SCRIPT_PARAM_TYPES,
  SCRIPT_TIERS,
  SOUND_BUSES,
  STUDIO_LIB_KEYS,
  STUDIO_PIXI_BOUND_KEYS,
  type Bilingual,
  type CkScriptsBundle,
  type CustomCodeJsMeta,
  type CustomCodeJsParams,
  type ScriptAuthor,
  type ScriptEntry,
  type ScriptKind,
  type ScriptParamGroup,
  type ScriptParamOption,
  type ScriptParamSpec,
  type ScriptParamType,
  type ScriptParamValue,
  type ScriptReducedMotion,
  type ScriptRef,
  type ScriptTier,
  type ScriptTrust,
  type ScriptVersion,
  type SoundBus,
  type SoundEntry,
  type SoundRecipeRef,
  type SoundSource,
  type StudioLibKey,
} from './types';
export {
  bilingualSchema,
  ckScriptsBundleSchema,
  customCodeJsMetaSchema,
  customCodeJsParamsSchema,
  isHexColour,
  isPaletteParamValue,
  isScriptThumbnail,
  jsParamsJsonLength,
  paramDefaultProblem,
  SCRIPT_PARAM_KEY_PATTERN,
  scriptEntrySchema,
  scriptParamSpecSchema,
  scriptParamSpecsSchema,
  scriptRefSchema,
  scriptVersionSchema,
  soundEntrySchema,
  soundSourceSchema,
  STUDIO_CODE_MAX,
  STUDIO_ID_PATTERN,
  STUDIO_LIMITS,
  STUDIO_TAG_PATTERN,
  studioIdSchema,
  studioTagsSchema,
  zzfxParamsSchema,
} from './schemas';
export {
  inferParamSpec,
  paramDefaults,
  paramsDiffFromDefaults,
  readParamsLiteral,
  validateParamValues,
  type ParamValueIssue,
  type ParamValueIssueCode,
  type ParamValuesResult,
} from './params';
export {
  describeScriptIssues,
  scriptCodeErrors,
  scriptCodeIssues,
  type ScriptCodeIssue,
  type ScriptCodeIssueOptions,
  type ScriptIssueCode,
  type ScriptIssueSeverity,
} from './lint';
export { declaredLibs, scanLibKeys, type DeclaredLibs, type LibKeyScan } from './detect';
export { fnv1a64 } from './hash';
export {
  normaliseSearch,
  searchScripts,
  type ScriptSearchOptions,
  type SearchableScript,
} from './search';
export { apiMembersOf, CK_API_REFERENCE, type CkApiMember } from './api-reference';
export {
  humaniseKey,
  SCRIPT_KIND_LABELS,
  SCRIPT_PARAM_GROUP_LABELS,
  SCRIPT_TIER_LABELS,
  STUDIO_PARAM_LABELS,
  STUDIO_TAG_LABELS,
  studioParamLabel,
  studioTagLabel,
} from './labels';
export {
  buildCkScriptsBundle,
  CKSCRIPTS_FORMAT,
  ckScriptsChecksumKey,
  freeLibraryId,
  parseCkScriptsBundle,
  planBundleImport,
  type BundleImportPlan,
  type CkScriptsParseResult,
} from './bundle';
export {
  customCodeJsMeta,
  customCodeJsParams,
  isCustomCodeJsMetaSchema,
  isCustomCodeJsParamsSchema,
  JS_META_META_VALUE,
  JS_PARAMS_META_VALUE,
  STUDIO_META_KEY,
} from './props';
