import { AiProviderError } from '../provider/errors';
import type { SiteStageProvider, StageOptions } from './stage-provider';
import type { RequestFor, ResponseFor, SiteStage, StageRequest } from './wire';

/**
 * The five stages over HTTP.
 *
 * ## One endpoint, five stages
 *
 * The stage is a FIELD on the body, not a path. That is the whole point of the
 * envelope: a server routes on `stage` and the client needs no new URL per
 * stage, no new configuration, and — crucially — no coordinated deploy when a
 * sixth stage arrives. A client that owned five paths would make every stage
 * addition a two-sided release.
 *
 * ## What it does NOT do
 *
 * It does not validate the answer. Every stage's validator lives beside its
 * request shape and runs in the orchestrator, so a wrong server produces a
 * rejected stage rather than a bad site — exactly as a wrong plan server
 * produces a rejected proposal rather than a document. A provider that
 * validated here would be a second door, and the day the two disagreed the
 * pipeline would trust the wrong one.
 */

export interface RemoteStageProviderOptions {
  /** Absolute URL of the stage endpoint. One POST per stage. */
  readonly endpoint: string;
  readonly headers?: Readonly<Record<string, string>>;
  /** Injected for tests and non-browser hosts; defaults to the ambient fetch. */
  readonly fetch?: typeof fetch;
  /**
   * Whole-request deadline for ONE stage.
   *
   * Per stage rather than per site: a site is five to eight calls and a single
   * budget across all of them would give the last stage whatever the first four
   * left over, which is a deadline that depends on how well the run went.
   */
  readonly timeoutMs?: number;
  readonly maxResponseBytes?: number;
  /** Development-only escape hatch for an explicitly configured HTTP endpoint. */
  readonly allowInsecureHttp?: boolean;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export class RemoteStageError extends AiProviderError {
  override readonly name = 'RemoteStageError';
  readonly stage: SiteStage;

  constructor(
    stage: SiteStage,
    message: string,
    details: {
      code: 'http-status' | 'network' | 'invalid-output' | 'response-limit';
      retryable: boolean;
      status?: number;
    },
  ) {
    super(message, details);
    this.stage = stage;
  }
}

function assertEndpoint(endpoint: string, allowInsecureHttp: boolean): void {
  const url = new URL(endpoint);
  if (url.protocol === 'https:') return;
  if (url.protocol === 'http:' && allowInsecureHttp) return;
  throw new AiProviderError(`The stage endpoint must be https (got ${url.protocol}).`, {
    code: 'endpoint-policy',
    retryable: false,
  });
}

export function createRemoteSiteStageProvider(
  options: RemoteStageProviderOptions,
): SiteStageProvider {
  const call = options.fetch ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  assertEndpoint(options.endpoint, options.allowInsecureHttp ?? false);

  return {
    async run<S extends SiteStage>(
      request: RequestFor<S>,
      stageOptions?: StageOptions,
    ): Promise<ResponseFor<S>> {
      const widened: StageRequest = request;
      const stage = widened.stage;

      /*
        Two signals, one abort. The caller's cancellation and this stage's own
        deadline both have to reach the same fetch, and a provider that honoured
        only its timeout would leave a stopped run's request in flight — paid
        for, and its answer discarded.
      */
      const deadline = new AbortController();
      const timer = setTimeout(() => {
        deadline.abort();
      }, timeoutMs);
      const onCallerAbort = (): void => {
        deadline.abort();
      };
      stageOptions?.signal?.addEventListener('abort', onCallerAbort, { once: true });

      try {
        const response = await call(options.endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...options.headers },
          body: JSON.stringify(request),
          signal: deadline.signal,
        });

        if (!response.ok) {
          throw new RemoteStageError(stage, `The ${stage} stage failed on the server.`, {
            code: 'http-status',
            /* 5xx is worth one more try; a 4xx is the request being wrong. */
            retryable: response.status >= 500,
            status: response.status,
          });
        }

        const text = await response.text();
        if (text.length > maxBytes) {
          throw new RemoteStageError(stage, `The ${stage} stage returned too much data.`, {
            code: 'response-limit',
            retryable: false,
          });
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new RemoteStageError(
            stage,
            `The ${stage} stage returned something that is not JSON.`,
            {
              code: 'invalid-output',
              retryable: true,
            },
          );
        }

        /*
          The one thing checked here: that the answer is FOR the stage that was
          asked. Everything else is the validator's, but a response whose stage
          does not match cannot even reach the right validator — it would be
          handed to one that expects different fields entirely.
        */
        const answered = (parsed as { stage?: unknown }).stage;
        if (answered !== stage) {
          throw new RemoteStageError(
            stage,
            `Asked for the ${stage} stage and got "${String(answered)}".`,
            { code: 'invalid-output', retryable: true },
          );
        }

        return parsed as ResponseFor<S>;
      } catch (cause: unknown) {
        /* A caller's own cancellation rethrows as the platform AbortError. */
        if (stageOptions?.signal?.aborted === true) throw cause;
        if (cause instanceof AiProviderError) throw cause;
        if (cause instanceof Error && cause.name === 'AbortError') {
          throw new RemoteStageError(stage, `The ${stage} stage took too long.`, {
            code: 'network',
            retryable: true,
          });
        }
        throw new RemoteStageError(stage, `The ${stage} stage could not be reached.`, {
          code: 'network',
          retryable: true,
        });
      } finally {
        clearTimeout(timer);
        stageOptions?.signal?.removeEventListener('abort', onCallerAbort);
      }
    },
  };
}
