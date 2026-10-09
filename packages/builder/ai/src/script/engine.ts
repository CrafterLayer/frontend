/**
 * The script ENGINE surface (package `script-engine`, DESIGN §A.2): the
 * host↔sandbox contract, limits, error texts, code normalization, result
 * truncation and the runners a browser bundle may reach.
 *
 * Importing this barrel loads no engine bytes: the runners import QuickJS and
 * the sandbox lazily, and the browser runner is exported as a TYPE only (it is
 * reached through `defaultScriptRunner`'s dynamic import). The Node runner
 * ships on the subpath `@craftkit/builder-ai/script-node` (`./node.ts`).
 */

export * from './types';
export { DEFAULT_SCRIPT_LIMITS, resolveScriptLimits } from './limits';
export {
  didYouMean,
  finalizeScriptRun,
  isScriptErrorCode,
  levenshtein,
  rawScriptFailure,
  scriptError,
  scriptErrorMessage,
  type RawScriptError,
  type RawScriptRunResult,
  type ScriptErrorDetail,
} from './errors';
export {
  normalizeScriptCode,
  normalizeScriptSource,
  type NormalizedScript,
} from './normalize-code';
export { scriptResultText, TRUNCATION_MARKER, truncateResult, truncateText } from './truncate';
export {
  createInlineScriptRunner,
  loadQuickJSModule,
  type InlineScriptRunnerOptions,
} from './runner-inline';
export type {
  BrowserScriptRunnerOptions,
  ScriptWorkerEvent,
  ScriptWorkerLike,
} from './runner-browser';
export {
  canUseBrowserWorker,
  createUnavailableScriptRunner,
  defaultScriptRunner,
  resetDefaultScriptRunner,
} from './default-runner';
