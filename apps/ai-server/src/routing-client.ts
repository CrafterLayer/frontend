import type Anthropic from '@anthropic-ai/sdk';

/**
 * The hybrid: one picker, two backends.
 *
 * A slug that starts with `cli:` is the person's own Claude subscription,
 * reached through the local `claude` CLI (`cli-client.ts`); every other slug
 * is OpenRouter. Both sit behind the same `client.messages.stream` seam, so
 * `claude.ts` and `handler.ts` do not know there are two.
 *
 * Optionally, when a free OpenRouter model is overloaded (429) or the wire to
 * it breaks (502), the same request is handed to a `cli:` fallback — and it
 * SAYS so, in the panel's own narration line and in the server log. A model
 * picker that silently changed who answered would be a lie.
 */

export const CLI_MODEL_PREFIX = 'cli:';

export function isCliModel(slug: string): boolean {
  return slug.startsWith(CLI_MODEL_PREFIX);
}

/** `cli:haiku` ⇒ `haiku`; a bare `cli:` ⇒ the CLI's own default. */
function cliModelOf(slug: string): string | undefined {
  const model = slug.slice(CLI_MODEL_PREFIX.length);
  return model === '' ? undefined : model;
}

export interface RoutingClientOptions {
  readonly openrouter: Anthropic;
  /** Builds a CLI client for one model; a fresh one per request is cheap, it holds no state. */
  readonly cli: (model: string | undefined) => Anthropic;
  /** A `cli:` slug to run instead when OpenRouter fails retryably. Omitted ⇒ no fallback. */
  readonly fallback?: string;
  readonly onLog?: (line: string) => void;
}

interface StreamParams {
  readonly model?: string;
}

interface StreamRequestOptions {
  readonly signal?: AbortSignal;
  readonly headers?: Readonly<Record<string, string>>;
}

interface StreamLike {
  on: (event: string, listener: (delta: string) => void) => unknown;
  finalMessage: () => Promise<Anthropic.Message>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Only the failures that "try again" would cure: a rate limit, an unreachable
 * or overloaded provider, a stream that broke mid-plan. A bad slug or a bad
 * key (4xx, 500) is for the owner to fix, and a hung-up client is not a
 * failure at all.
 */
function isRetryableOpenRouterFailure(cause: unknown): cause is Error & { httpStatus: number } {
  if (!(cause instanceof Error) || cause.name !== 'OpenRouterBackendError') return false;
  const status = (cause as Error & { httpStatus?: unknown }).httpStatus;
  return status === 429 || status === 502;
}

function isAbort(cause: unknown): boolean {
  return isRecord(cause) && cause['name'] === 'AbortError';
}

/** A `client.messages.stream(...)`-shaped router over the OpenRouter and CLI shims. */
export function createRoutingClient(options: RoutingClientOptions): Anthropic {
  const onLog = options.onLog ?? ((): void => undefined);

  const stream = (params: StreamParams, requestOptions: StreamRequestOptions = {}) => {
    const listeners = new Map<string, (delta: string) => void>();
    /*
      A backend may narrate before the caller has registered its listener —
      `claude.ts` calls `stream()` and then `on()`. Nothing is dropped: what
      arrives early waits for the listener.
    */
    let early: string[] = [];
    const report = (delta: string): void => {
      const listener = listeners.get('thinking');
      if (listener === undefined) early.push(delta);
      else listener(delta);
    };
    const follow = (inner: StreamLike): Promise<Anthropic.Message> => {
      inner.on('thinking', report);
      return inner.finalMessage();
    };
    const runCli = (slug: string): Promise<Anthropic.Message> => {
      const model = cliModelOf(slug);
      const inner = options
        .cli(model)
        .messages.stream(
          { ...params, ...(model === undefined ? {} : { model }) } as never,
          requestOptions,
        ) as unknown as StreamLike;
      return follow(inner);
    };

    const done = (async (): Promise<Anthropic.Message> => {
      const model = params.model;
      if (model !== undefined && isCliModel(model)) return runCli(model);

      const primary = options.openrouter.messages.stream(
        params as never,
        requestOptions,
      ) as unknown as StreamLike;
      try {
        return await follow(primary);
      } catch (cause) {
        const fallback = options.fallback;
        if (fallback === undefined || isAbort(cause) || requestOptions.signal?.aborted === true)
          throw cause;
        if (!isRetryableOpenRouterFailure(cause)) throw cause;
        onLog(
          `falling back to ${fallback} after ${model ?? 'the OpenRouter model'} failed: ${cause.message}`,
        );
        report(`${model ?? 'The free model'} is unavailable right now; switching to ${fallback}\n`);
        return runCli(fallback);
      }
    })();

    return {
      on: (event: string, listener: (delta: string) => void) => {
        listeners.set(event, listener);
        if (event === 'thinking') {
          for (const delta of early) listener(delta);
          early = [];
        }
      },
      finalMessage: () => done,
    };
  };

  return { messages: { stream } } as unknown as Anthropic;
}
