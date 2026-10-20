import type Anthropic from '@anthropic-ai/sdk';
import { CODEX_DEFAULT_MODEL, CodexBackendError } from './codex-config';

/**
 * The hybrid: one picker, explicit provider routes.
 *
 * A slug that starts with `cli:` is the person's own Claude subscription,
 * reached through the local `claude` CLI; `codex:` uses the Codex subscription
 * and `api:` uses Anthropic's API. Every other slug is OpenRouter. All sit
 * behind the same `client.messages.stream` seam.
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

/**
 * `api:claude-haiku-5-5`: the Anthropic Messages API, billed to ANTHROPIC_API_KEY.
 * The picker's other half of the subscription/API switch — the same model as a
 * `cli:` entry, paid the other way.
 */
export const API_MODEL_PREFIX = 'api:';

export function isApiModel(slug: string): boolean {
  return slug.startsWith(API_MODEL_PREFIX);
}

export function isCodexModel(slug: string): boolean {
  return slug.startsWith('codex:');
}

export function isLocalModel(slug: string): boolean {
  return isCliModel(slug) || isApiModel(slug) || isCodexModel(slug);
}

/**
 * The request as the Messages API will take it. The plan schemas are open where
 * kits differ (a brief's `slots`) and carry more optional fields than the API's
 * grammar compiler allows (measured 2026-10-12: 26 against a limit of 24), so
 * strict decoding answers 400 before the model writes a word. The schema goes
 * into the system prompt as text instead — the path OpenRouter models without
 * structured outputs already take, and `claude.ts` parses either.
 */
export function apiParams(params: Record<string, unknown>, model: string): Record<string, unknown> {
  const outputConfig = params['output_config'] as
    { format?: { schema?: unknown }; [key: string]: unknown } | undefined;
  const schema = outputConfig?.format?.schema;
  if (outputConfig === undefined || schema === undefined) return { ...params, model };
  const rest = Object.fromEntries(Object.entries(outputConfig).filter(([key]) => key !== 'format'));
  const system = Array.isArray(params['system']) ? (params['system'] as unknown[]) : [];
  return {
    ...params,
    model,
    system: [
      ...system,
      {
        type: 'text',
        text:
          '# Required output format\n' +
          'Reply with RAW JSON ONLY — the first character of your reply must be "{" and the last must be "}". ' +
          'No markdown code fences, no explanation before or after. Conform exactly to this JSON Schema:\n' +
          JSON.stringify(schema),
      },
    ],
    ...(Object.keys(rest).length === 0 ? { output_config: undefined } : { output_config: rest }),
  };
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
  /** The Messages API client for `api:` slugs. Omitted ⇒ an `api:` request fails naming the missing key. */
  readonly api?: Anthropic;
  /** One shared Codex client owns the concurrency limit across every codex: model. */
  readonly codex?: Anthropic;
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
    /*
      The answer's text as it is written (a page plan's drafts), from whichever
      inner stream is live. Never early: text only arrives after `stream()`
      has returned and the caller has subscribed.
    */
    const text = (delta: string): void => {
      listeners.get('text')?.(delta);
    };
    const follow = (inner: StreamLike): Promise<Anthropic.Message> => {
      inner.on('thinking', report);
      inner.on('text', text);
      // The Messages API's first event (message_start): its prefix is cached now (cache-gate.ts).
      inner.on('streamEvent', () => {
        listeners.get('streamEvent')?.('');
      });
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
    const runApi = (slug: string): Promise<Anthropic.Message> => {
      if (options.api === undefined) {
        return Promise.reject(
          new Error(
            `${slug} needs ANTHROPIC_API_KEY in apps/ai-server/.env; set it and restart the server.`,
          ),
        );
      }
      const model = slug.slice(API_MODEL_PREFIX.length);
      const started = Date.now();
      onLog(`api run: ${model} on the Anthropic API (billed to the key)`);
      const inner = options.api.messages.stream(
        apiParams(params as Record<string, unknown>, model) as never,
        requestOptions,
      ) as unknown as StreamLike;
      // The CLI logs its own runs; this is the API's line, so the terminal names who answered.
      return follow(inner).then((message) => {
        const usage = message.usage as Partial<Anthropic.Usage> | undefined;
        onLog(
          `api usage — model ${model}, in ${String(usage?.input_tokens ?? '?')}, ` +
            `out ${String(usage?.output_tokens ?? '?')}, ${String(Math.round((Date.now() - started) / 1000))} s`,
        );
        return message;
      });
    };

    const done = (async (): Promise<Anthropic.Message> => {
      const model = params.model;
      if (model !== undefined && isCliModel(model)) return runCli(model);
      if (model !== undefined && isApiModel(model)) return runApi(model);
      if (model !== undefined && isCodexModel(model)) {
        if (options.codex === undefined)
          throw new CodexBackendError('The Codex route is not configured.', 503, false);
        return follow(
          options.codex.messages.stream(
            { ...params, model: model.slice('codex:'.length) || CODEX_DEFAULT_MODEL } as never,
            requestOptions,
          ) as unknown as StreamLike,
        );
      }

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
        /*
          Whatever text the failed model already wrote is void: say so before
          the fallback's first word, so a reader of the drafts starts over.
        */
        (listeners.get('restart') as (() => void) | undefined)?.();
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
