/**
 * Code mode (agent-script DESIGN §A): the sandbox engine (engine.ts, owned by
 * script-engine) and the host side that turns a `script.run` step into
 * ordinary kernel steps before the door (script-host).
 */
export * from './engine';

export {
  scriptCardExamples,
  SCRIPT_CARD,
  SCRIPT_CARD_MAX_CHARS,
} from './api-card';
export { coalesceScriptSteps, scriptDefaultTitle, type CoalesceOptions, type CoalesceResult } from './coalesce';
export { directScript, directScriptReading, type DirectScriptReading } from './direct-scripts';
export {
  buildElementIndex,
  pageLocale,
  scriptNorm,
  SCRIPT_INDEX_MAX_PER_PAGE,
  SCRIPT_INDEX_MAX_TOTAL,
  SCRIPT_TEXT_MAX,
  type ElementIndex,
  type ElementIndexOptions,
  type ScriptSite,
} from './element-index';
export {
  expandScriptSteps,
  isScriptStep,
  SCRIPT_DEFAULT_PAGE_ID,
  scriptSeed,
  scriptToolNames,
  type ScriptExpansion,
  type ScriptExpansionOptions,
  type ScriptRunReport,
} from './expand-scripts';
export {
  parseHandleId,
  partHandleId,
  sectionHandleId,
  treeHandleId,
  type Handle,
  type HandleType,
} from './handles';
export { scriptPhotos } from './photos-index';
export { PREFERS_SCRIPT_TABLE, prefersScript } from './script-intent';
export { camelStyleKey, nearestStyleKeys, normalizeStyleKey, type StyleKeyResult } from './style-keys';
export {
  callsToSteps,
  scriptCallAt,
  scriptHostError,
  type CallMapResult,
  type MappedStep,
  type WriteMapContext,
} from './write-map';
