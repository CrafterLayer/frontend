import type { SiteStageProvider, StageOptions } from '../pipeline/stage-provider';
import type { RequestFor, ResponseFor, SiteStage, StageRequest } from '../pipeline/wire';

/**
 * A stage provider a test drives by hand.
 *
 * The offline provider answers everything correctly, which is exactly what
 * makes it useless for the cases that matter: a stage that fails, a stage that
 * fails ONCE and succeeds on the retry, a stage that never returns so a
 * cancellation has something to cancel. Those are properties of the
 * orchestrator, and the only honest way to test them is to script the answers.
 */

export interface ScriptedStage {
  /** Fail this many times before answering. `Infinity` never answers correctly. */
  readonly failFirst?: number;
  /** What to throw. A `StageRejectedError` exercises the repair path. */
  readonly error?: () => Error;
  /** The answer, when it answers. Omit to fall through to the fallback. */
  readonly response?: (request: StageRequest) => unknown;
  /** Never settle, so a caller's abort is the only way out. */
  readonly hang?: boolean;
}

export interface ScriptedStageProviderOptions {
  readonly stages?: Partial<Record<SiteStage, ScriptedStage>>;
  /** Answers anything the script does not. Usually the offline provider. */
  readonly fallback?: SiteStageProvider;
}

export interface ScriptedStageProvider extends SiteStageProvider {
  /** How many times each stage was asked, including repairs. */
  calls(): Readonly<Record<string, number>>;
}

export function createScriptedSiteStageProvider(
  options: ScriptedStageProviderOptions = {},
): ScriptedStageProvider {
  const counts = new Map<SiteStage, number>();
  const failures = new Map<SiteStage, number>();

  return {
    calls: () => Object.fromEntries(counts),

    async run<S extends SiteStage>(
      request: RequestFor<S>,
      stageOptions?: StageOptions,
    ): Promise<ResponseFor<S>> {
      const widened: StageRequest = request;
      const stage = widened.stage;
      counts.set(stage, (counts.get(stage) ?? 0) + 1);

      const script = options.stages?.[stage];

      if (script?.hang === true) {
        return new Promise<ResponseFor<S>>((_resolve, reject) => {
          const abort = (): void => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          };
          if (stageOptions?.signal?.aborted === true) {
            abort();
            return;
          }
          stageOptions?.signal?.addEventListener('abort', abort, { once: true });
        });
      }

      const failed = failures.get(stage) ?? 0;
      if (script !== undefined && failed < (script.failFirst ?? 0)) {
        failures.set(stage, failed + 1);
        throw script.error?.() ?? new Error(`scripted failure at ${stage}`);
      }

      if (script?.response !== undefined) {
        return script.response(widened) as ResponseFor<S>;
      }
      if (options.fallback === undefined) {
        throw new Error(`No script and no fallback for the ${stage} stage.`);
      }
      return options.fallback.run(request, stageOptions);
    },
  };
}
