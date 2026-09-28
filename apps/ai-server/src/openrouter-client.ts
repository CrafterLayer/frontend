import type Anthropic from '@anthropic-ai/sdk';

import { parsesAsJson, unwrapJson } from './json-salvage';
import { NARRATION_INTERVAL_MS, RunNarrator, formatCount, formatElapsed } from './narration';

/**
 * The OpenRouter backend, gated by `CRAFTKIT_AI_BACKEND=openrouter`.
 *
 * Routes the exact request `claude.ts` builds through OpenRouter's
 * chat-completions API instead of the Anthropic Messages API, so one key
 * reaches every model OpenRouter fronts. Like `cli-client.ts` it intercepts
 * at the seam the tests fake (`client.messages.stream`): `prompt.ts` — skills,
 * catalog, cache layout — runs unmodified, and `claude.ts` / `handler.ts`
 * keep translating the same `Anthropic.Message` shape they always did.
 *
 * What changes on this path:
 * - The output schema travels as `response_format` (enforced by the models
 *   that support it) AND as text after the cache breakpoint (for the ones that
 *   silently drop it). `claude.ts` still parses and the client still
 *   validates, so a model that ignores both produces a rejected proposal,
 *   never a damaged document.
 * - Reasoning is opt-in per deployment (`effort`), because the models behind
 *   one OpenRouter key disagree about what it costs and whether it exists.
 *   When a model does reason, its own words narrate; when it does not, the
 *   shared narrator keeps the panel's line moving from the clock.
 * - Failures arrive as `OpenRouterBackendError`, carrying OpenRouter's own
 *   sentence and the HTTP status the handler should answer with.
 */

/** `fetch`, narrowed to what this backend uses; injected by the tests. */
export type OpenRouterFetch = (input: string, init: RequestInit) => Promise<Response>;

export const OPENROUTER_DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

/** The reasoning budgets OpenRouter accepts as `reasoning.effort`. */
export const OPENROUTER_EFFORT_LEVELS = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
] as const;
export type OpenRouterEffort = (typeof OPENROUTER_EFFORT_LEVELS)[number];
export const CRAFTKIT_REASONING_EFFORT_HEADER = 'x-craftkit-internal-reasoning-effort';

/**
 * A requested budget in OpenRouter's terms. `max` — the top of the scale
 * `claude.ts` and the CLI speak — has no OpenRouter name; it asks for the
 * top OpenRouter has rather than falling back to the backend default, which
 * would quietly be the opposite of what was asked.
 */
function openRouterEffort(requested: unknown): OpenRouterEffort | undefined {
  if (requested === 'max') return 'xhigh';
  return OPENROUTER_EFFORT_LEVELS.find((level) => level === requested);
}

/** What OpenRouter says about one slug, asked once at startup. */
export interface OpenRouterModelFacts {
  readonly listed: boolean;
  /** Decodes straight into a JSON schema (`structured_outputs`), so a plan cannot be malformed. */
  readonly structuredOutputs: boolean;
  /** Provider-declared request features, retained for versioned role capability routing. */
  readonly supportedParameters: readonly string[];
  /** Provider-declared input modalities; `image` is required before routing visual review. */
  readonly inputModalities: readonly string[];
  /** The most the model may write in one answer; requests are clamped to it. */
  readonly maxOutputTokens: number | undefined;
  readonly promptPerMillion?: number;
  readonly completionPerMillion?: number;
}

export interface OpenRouterClientOptions {
  readonly apiKey: string;
  /**
   * The default, an OpenRouter slug (`vendor/model`). A request that names a
   * model wins — the handler has already vetted it against the allowlist.
   */
  readonly model: string;
  /** Defaults to `OPENROUTER_DEFAULT_BASE_URL`; a proxy or a test server goes here. */
  readonly baseUrl?: string;
  /** Reasoning budget. Omitted ⇒ no `reasoning` field, the model's own default. */
  readonly effort?: OpenRouterEffort;
  /**
   * `response_format.json_schema.strict`. Unset ⇒ on for models `models` says
   * decode into a schema, off for the rest; set ⇒ that, for every model.
   */
  readonly strict?: boolean;
  /** Per-slug facts from `probeOpenRouterModels`; decides strictness and the output ceiling. */
  readonly models?: ReadonlyMap<string, OpenRouterModelFacts>;
  /** Injected for tests; defaults to the platform `fetch`. */
  readonly fetch?: OpenRouterFetch;
  /** One line per run milestone, for the server's own terminal. */
  readonly onLog?: (line: string) => void;
}

/** The narrow view of what `claude.ts` passes to `messages.stream`. */
interface StreamParams {
  readonly model?: string;
  readonly max_tokens?: number;
  readonly system?: readonly {
    readonly text: string;
    readonly cache_control?: unknown;
  }[];
  readonly messages?: readonly { readonly role: string; readonly content: unknown }[];
  readonly output_config?: {
    readonly format?: { readonly schema?: unknown };
    /** The Messages API's per-call budget, as `claude.ts` sets it for a section writer. */
    readonly effort?: unknown;
  };
}

interface StreamRequestOptions {
  readonly signal?: AbortSignal;
  readonly headers?: Readonly<Record<string, string>>;
}

/**
 * Every failure of this backend, as a sentence its owner can act on, plus the
 * HTTP status the handler should answer with — 429 is retryable, 400 is
 * terminal, and a key or credit problem is a deployment mistake (500).
 */
export class OpenRouterBackendError extends Error {
  override readonly name = 'OpenRouterBackendError';

  constructor(
    message: string,
    readonly httpStatus: number,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAbort(cause: unknown): boolean {
  return isRecord(cause) && cause['name'] === 'AbortError';
}

function messageText(content: unknown): string {
  return typeof content === 'string' ? content : JSON.stringify(content);
}

/** OpenRouter's own words, on one line and bounded — never a stack, never a page. */
function boundedText(text: string): string {
  const flat = text.replace(/\s+/gu, ' ').trim();
  return flat.length > 300 ? `${flat.slice(0, 300)}…` : flat;
}

function errorText(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * The schema spelled out, for models that drop `response_format`. Placed
 * after the cache breakpoint on purpose: it changes between the outline and
 * the plan contract, and inside the cached prefix that would cost a re-bill.
 */
function schemaAsText(schema: unknown): string {
  return (
    '# Required output format\n' +
    'Reply with RAW JSON ONLY — the first character of your reply must be "{" and the last must be "}". ' +
    'No markdown code fences, no explanation before or after. Conform exactly to this JSON Schema:\n' +
    JSON.stringify(schema)
  );
}

function chatMessages(
  params: StreamParams,
  schema: unknown,
  explicitPromptCache: boolean,
): unknown[] {
  const system = (params.system ?? []).map((block) => ({
    type: 'text',
    text: block.text,
    ...(block.cache_control === undefined || !explicitPromptCache
      ? {}
      : { cache_control: block.cache_control }),
  }));
  if (schema !== undefined) system.push({ type: 'text', text: schemaAsText(schema) });
  const turns = (params.messages ?? []).map((turn) => ({
    role: turn.role === 'assistant' ? 'assistant' : 'user',
    content: messageText(turn.content),
  }));
  return [...(system.length === 0 ? [] : [{ role: 'system', content: system }]), ...turns];
}

function chatPayload(
  params: StreamParams,
  options: OpenRouterClientOptions,
  effort: OpenRouterEffort | undefined,
): Record<string, unknown> {
  const schema = params.output_config?.format?.schema;
  const model = params.model ?? options.model;
  const facts = options.models?.get(model);
  /*
    `response_format` only where constrained decoding is proven. A provider's
    guided decoding once turned every name in a plan into a single letter —
    `"command":"w"`, `"rationale":"س"` — the shortest string the schema's
    `minLength: 1` admits. So: Anthropic and OpenAI models that declare
    `structured_outputs` get strict decoding; every other model gets the schema
    as text only (below); `strict` set by the owner overrides both ways.
  */
  const trustedVendor = /^(anthropic|openai)\//u.test(model);
  const strict = options.strict ?? (trustedVendor && facts?.structuredOutputs === true);
  /*
    Never ask for more than the model can write: OpenRouter answers that with
    a 400 before the first token, and the sentence blames the request.
  */
  const ceiling = facts?.maxOutputTokens;
  const maxTokens =
    params.max_tokens === undefined
      ? undefined
      : ceiling === undefined
        ? params.max_tokens
        : Math.min(params.max_tokens, ceiling);
  return {
    model,
    // GPT caching is automatic. Anthropic is the only configured path where
    // this server sends the provider-specific cache-control TTL.
    messages: chatMessages(params, schema, model.startsWith('anthropic/')),
    ...(maxTokens === undefined ? {} : { max_tokens: maxTokens }),
    stream: true,
    usage: { include: true },
    ...(schema === undefined || !strict
      ? {}
      : {
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'craftkit_plan', strict: true, schema },
          },
        }),
    ...(effort === undefined ? {} : { reasoning: { effort } }),
  };
}

/**
 * One sentence per HTTP status, ending with OpenRouter's own message. The
 * status is the one the HANDLER answers with, which is what the client acts
 * on: 429 and 5xx retry, 4xx is terminal.
 */
function failureOf(status: number, detail: string, model: string): OpenRouterBackendError {
  const said = detail === '' ? '' : ` OpenRouter said: ${detail}`;
  if (status === 401) {
    return new OpenRouterBackendError(
      `OpenRouter rejected the API key: check OPENROUTER_API_KEY in apps/ai-server/.env and restart the server.${said}`,
      500,
    );
  }
  if (status === 402) {
    return new OpenRouterBackendError(
      `The OpenRouter account has no credits left: top it up at openrouter.ai/settings/credits.${said}`,
      500,
    );
  }
  if (status === 403) {
    return new OpenRouterBackendError(`OpenRouter blocked this request.${said}`, 400);
  }
  if (status === 429) {
    return new OpenRouterBackendError(
      `OpenRouter is rate limiting this key or model right now. Try again in a moment.${said}`,
      429,
    );
  }
  if (status === 400 || status === 404 || status === 422) {
    return new OpenRouterBackendError(
      `OpenRouter rejected the request for model ${model}: check that CRAFTKIT_AI_MODEL is a slug OpenRouter lists, ` +
        `such as anthropic/claude-sonnet-4.5.${said}`,
      400,
    );
  }
  return new OpenRouterBackendError(
    `OpenRouter could not get an answer from ${model}.${said}`,
    502,
  );
}

/** `error.message` out of an OpenRouter error body, or the body itself, bounded. */
async function errorDetail(response: Response): Promise<string> {
  let text = '';
  try {
    text = await response.text();
  } catch {
    return '';
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (
      isRecord(parsed) &&
      isRecord(parsed['error']) &&
      typeof parsed['error']['message'] === 'string'
    ) {
      return boundedText(parsed['error']['message']);
    }
  } catch {
    // Not JSON; the raw body is the best detail there is.
  }
  return boundedText(text);
}

/**
 * Reads server-sent events off the body, dispatching each event's `data`.
 * Comment lines (`: OPENROUTER PROCESSING`) are heartbeats and are dropped;
 * a multi-line `data:` is joined the way the SSE spec says. A throw from the
 * consumer cancels the body, so a failed run stops the upstream generation.
 */
async function readEvents(
  body: ReadableStream<Uint8Array>,
  onData: (data: string) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let pending: string[] = [];

  const takeLine = (line: string): void => {
    const text = line.endsWith('\r') ? line.slice(0, -1) : line;
    if (text === '') {
      if (pending.length > 0) onData(pending.join('\n'));
      pending = [];
      return;
    }
    if (text.startsWith(':')) return;
    if (text.startsWith('data:')) pending.push(text.slice('data:'.length).replace(/^ /u, ''));
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline >= 0) {
        takeLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
      }
    }
    buffer += decoder.decode();
    if (buffer !== '') takeLine(buffer);
    takeLine('');
  } catch (cause) {
    await reader.cancel().catch(() => undefined);
    throw cause;
  }
}

/** The model's reasoning out of one delta, in whichever of the two shapes OpenRouter used. */
function reasoningOf(delta: Record<string, unknown>): string {
  const reasoning = delta['reasoning'];
  if (typeof reasoning === 'string' && reasoning !== '') return reasoning;
  const details = delta['reasoning_details'];
  if (!Array.isArray(details)) return '';
  let text = '';
  for (const detail of details) {
    if (!isRecord(detail)) continue;
    if (typeof detail['text'] === 'string') text += detail['text'];
    else if (typeof detail['summary'] === 'string') text += detail['summary'];
  }
  return text;
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * OpenRouter's `prompt_tokens` includes the cached tokens; Anthropic's
 * `input_tokens` excludes them. The handler's `cachedShare` is computed the
 * Anthropic way, so this subtracts — otherwise every run here would look
 * like a broken cache prefix.
 */
function usageOf(usage: Record<string, unknown> | undefined): Anthropic.Message['usage'] {
  const details = isRecord(usage?.['prompt_tokens_details']) ? usage['prompt_tokens_details'] : {};
  const prompt = count(usage?.['prompt_tokens']);
  const cached = count(details['cached_tokens']);
  const written = count(details['cache_write_tokens']);
  const cost = usage?.['cost'];
  return {
    input_tokens: Math.max(0, prompt - cached - written),
    output_tokens: count(usage?.['completion_tokens']),
    cache_read_input_tokens: cached,
    cache_creation_input_tokens: written,
    ...(typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 ? { cost_usd: cost } : {}),
  } as Anthropic.Message['usage'];
}

/**
 * What one run has received so far, and its translation into the message
 * `claude.ts` reads. Narration is a side effect of receiving: the model's
 * own reasoning is forwarded as it arrives, and plan text moves the shared
 * narrator into its writing phase.
 */
class Answer {
  private text = '';
  private unwrapped: string | undefined;
  private refusal = '';
  private finish: string | undefined;
  private usage: Record<string, unknown> | undefined;
  private done = false;
  /** Once true, the clock narrator stays quiet until plan text arrives. */
  reasoningSeen = false;

  constructor(
    private readonly model: string,
    private readonly narrator: RunNarrator,
    private readonly report: (text: string) => void,
  ) {}

  take(data: string): void {
    if (data === '[DONE]') {
      this.done = true;
      return;
    }
    let frame: unknown;
    try {
      frame = JSON.parse(data);
    } catch {
      return;
    }
    if (!isRecord(frame)) return;

    /*
      An error after the first token has no status line left to travel on,
      so OpenRouter puts it in the frame. It is the same failure as a 4xx/5xx
      before any token and gets the same sentence.
    */
    const error = frame['error'];
    if (isRecord(error)) {
      const code = Number(error['code']);
      const detail = typeof error['message'] === 'string' ? boundedText(error['message']) : '';
      throw failureOf(Number.isFinite(code) ? code : 502, detail, this.model);
    }

    const choices = frame['choices'];
    const choice = Array.isArray(choices) ? (choices[0] as unknown) : undefined;
    if (isRecord(choice)) {
      const delta = choice['delta'];
      if (isRecord(delta)) this.takeDelta(delta);
      if (typeof choice['finish_reason'] === 'string') this.finish = choice['finish_reason'];
    }
    if (isRecord(frame['usage'])) this.usage = frame['usage'];
  }

  private takeDelta(delta: Record<string, unknown>): void {
    const reasoning = reasoningOf(delta);
    if (reasoning !== '') {
      this.reasoningSeen = true;
      this.narrator.addThinking(0);
      this.report(reasoning);
    }
    if (typeof delta['content'] === 'string' && delta['content'] !== '') {
      this.text += delta['content'];
      this.narrator.addText(delta['content'].length);
    }
    if (typeof delta['refusal'] === 'string') this.refusal += delta['refusal'];
  }

  /** `finish_reason` is the real end; `[DONE]` alone is only the accounting frame's cue. */
  complete(): boolean {
    return this.finish !== undefined || this.done;
  }

  /**
   * One log line when the answer is not JSON — what it started and ended
   * with, and how the stream finished. "The assistant answer was not valid
   * JSON" is the panel's whole report; without this the owner's terminal
   * said nothing more, and a free model's habit stayed a mystery.
   */
  diagnostic(): string | undefined {
    if (this.text.trim() === '') return undefined;
    if (parsesAsJson(this.modelJson())) return undefined;
    // The model's own words, wrappers and all: they are what the owner is diagnosing.
    const flat = this.text.replace(/\s+/gu, ' ').trim();
    const head = flat.length > 400 ? `${flat.slice(0, 400)}…` : flat;
    const tail = flat.length > 800 ? `…${flat.slice(-400)}` : '';
    return (
      `openrouter answer is not JSON as written (the plan's salvage may still repair it) — ` +
      `finish=${this.finish ?? '(none)'}, ` +
      `${formatCount(this.text.length)} characters, reasoning ${this.reasoningSeen ? 'seen' : 'not seen'}. ` +
      `starts: «${head}»${tail === '' ? '' : ` ends: «${tail}»`}`
    );
  }

  /**
   * The answer with its wrappers undone — fence, sentence, `<think>`,
   * trailing commas — and every closer as the model wrote it. Repairing the
   * closers here, with no idea what shape a plan has, would hand `claude.ts`
   * text that already parses: its judged salvage would never run, and
   * `onAnswer` would log and dump a repair instead of what the model said.
   */
  private modelJson(): string {
    this.unwrapped ??= unwrapJson(this.text);
    return this.unwrapped;
  }

  message(): Anthropic.Message {
    const refused = this.refusal !== '' || this.finish === 'content_filter';
    return {
      stop_reason: refused ? 'refusal' : this.finish === 'length' ? 'max_tokens' : 'end_turn',
      stop_details: refused
        ? {
            explanation:
              this.refusal !== '' ? this.refusal : "The model's provider declined this request.",
          }
        : null,
      content: [{ type: 'text', text: this.modelJson() }],
      usage: usageOf(this.usage),
    } as unknown as Anthropic.Message;
  }
}

async function runChat(
  payload: Record<string, unknown>,
  options: OpenRouterClientOptions,
  signal: AbortSignal | undefined,
  report: (text: string) => void,
): Promise<Anthropic.Message> {
  const onLog = options.onLog ?? ((): void => undefined);
  const fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
  const baseUrl = (options.baseUrl ?? OPENROUTER_DEFAULT_BASE_URL).replace(/\/+$/u, '');
  // The model this run is actually on — a per-request choice or the default — so logs and failures name the right slug.
  const model = typeof payload['model'] === 'string' ? payload['model'] : options.model;
  const reasoning = isRecord(payload['reasoning']) ? payload['reasoning'] : {};
  const effort = typeof reasoning['effort'] === 'string' ? reasoning['effort'] : '(model default)';
  const body = JSON.stringify(payload);

  const startedAt = Date.now();
  const narrator = new RunNarrator(report, startedAt);
  const answer = new Answer(model, narrator, report);
  /*
    The clock speaks only when the model does not: a model that reasons
    aloud narrates itself, and a status line that alternates between its
    sentences and "Thinking (00:12)" would read as two voices.
  */
  const narration = setInterval(() => {
    if (answer.reasoningSeen && narrator.writtenSoFar() === 0) return;
    narrator.emit();
  }, NARRATION_INTERVAL_MS);
  onLog(
    `openrouter run started — model ${model}, effort ${effort}, ` +
      `request ${formatCount(body.length)} characters`,
  );

  try {
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          'content-type': 'application/json',
          'x-title': 'CraftKit ai-server',
        },
        body,
        ...(signal === undefined ? {} : { signal }),
      });
    } catch (cause) {
      if (isAbort(cause)) throw cause;
      throw new OpenRouterBackendError(
        `OpenRouter could not be reached (${boundedText(errorText(cause))}). ` +
          'Check the connection and CRAFTKIT_AI_OPENROUTER_BASE_URL.',
        502,
      );
    }

    if (!response.ok) {
      throw failureOf(response.status, await errorDetail(response), model);
    }

    if (response.body !== null) {
      try {
        await readEvents(response.body, (data) => {
          answer.take(data);
        });
      } catch (cause) {
        if (isAbort(cause) || cause instanceof OpenRouterBackendError) throw cause;
        throw new OpenRouterBackendError(
          `The connection to OpenRouter dropped mid-plan (${boundedText(errorText(cause))}). Try again.`,
          502,
        );
      }
    }

    if (!answer.complete()) {
      throw new OpenRouterBackendError(
        'The OpenRouter stream ended before the plan finished. Try again; if it keeps happening, ask for a smaller change.',
        502,
      );
    }
    const diagnostic = answer.diagnostic();
    if (diagnostic !== undefined) onLog(diagnostic);
    return answer.message();
  } finally {
    clearInterval(narration);
    onLog(
      `openrouter run ended after ${formatElapsed(Date.now() - startedAt)} — ` +
        `${formatCount(narrator.writtenSoFar())} characters of plan`,
    );
  }
}

function perMillion(key: string, value: unknown): Record<string, number> {
  const rate = Number(value);
  return Number.isFinite(rate) ? { [key]: Math.round(rate * 1e6 * 100) / 100 } : {};
}

/**
 * What OpenRouter lists today, for the slugs this server is configured with.
 *
 * Free slugs come and go — one was withdrawn the evening this shipped — and
 * models differ in whether they can decode into a schema and how much they may
 * write. Asked once at startup, so a slug that no longer exists is named in the
 * terminal before the first request fails on it. A listing that cannot be
 * fetched answers with nothing rather than stopping the server: the request
 * path does not depend on it, only strictness and the output ceiling do.
 */
export async function probeOpenRouterModels(
  slugs: readonly string[],
  options: { readonly baseUrl?: string; readonly fetch?: OpenRouterFetch } = {},
): Promise<ReadonlyMap<string, OpenRouterModelFacts>> {
  const fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
  const baseUrl = (options.baseUrl ?? OPENROUTER_DEFAULT_BASE_URL).replace(/\/+$/u, '');
  let listing: unknown;
  try {
    const response = await fetchImpl(`${baseUrl}/models`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return new Map();
    listing = await response.json();
  } catch {
    return new Map();
  }
  const entries = isRecord(listing) && Array.isArray(listing['data']) ? listing['data'] : [];
  const byId = new Map<string, Record<string, unknown>>();
  for (const entry of entries as unknown[]) {
    if (isRecord(entry) && typeof entry['id'] === 'string') byId.set(entry['id'], entry);
  }
  const facts = new Map<string, OpenRouterModelFacts>();
  for (const slug of slugs) {
    const entry = byId.get(slug);
    if (entry === undefined) {
      facts.set(slug, {
        listed: false,
        structuredOutputs: false,
        supportedParameters: [],
        inputModalities: [],
        maxOutputTokens: undefined,
      });
      continue;
    }
    const parameters: unknown[] = Array.isArray(entry['supported_parameters'])
      ? entry['supported_parameters']
      : [];
    const top = isRecord(entry['top_provider']) ? entry['top_provider'] : {};
    const pricing = isRecord(entry['pricing']) ? entry['pricing'] : {};
    const architecture = isRecord(entry['architecture']) ? entry['architecture'] : {};
    const inputModalities: unknown[] = Array.isArray(architecture['input_modalities'])
      ? architecture['input_modalities']
      : [];
    const maxOut = top['max_completion_tokens'];
    facts.set(slug, {
      listed: true,
      structuredOutputs: parameters.includes('structured_outputs'),
      supportedParameters: parameters.filter(
        (parameter): parameter is string => typeof parameter === 'string',
      ),
      inputModalities: inputModalities.filter(
        (modality): modality is string => typeof modality === 'string',
      ),
      maxOutputTokens: typeof maxOut === 'number' && maxOut > 0 ? maxOut : undefined,
      ...perMillion('promptPerMillion', pricing['prompt']),
      ...perMillion('completionPerMillion', pricing['completion']),
    });
  }
  return facts;
}

/** A `client.messages.stream(...)`-shaped shim over OpenRouter's chat completions. */
export function createOpenRouterClient(options: OpenRouterClientOptions): Anthropic {
  const stream = (params: StreamParams, requestOptions: StreamRequestOptions = {}) => {
    const listeners = new Map<string, (delta: string) => void>();
    const report = (text: string): void => {
      listeners.get('thinking')?.(text);
    };
    /*
      Per call: `claude.ts` puts a section's budget where the Messages API
      reads it, `output_config.effort`; the authored-file runs still send it
      as the private header. Either wins over the deployment's own `effort`.
    */
    const requestedEffort =
      openRouterEffort(params.output_config?.effort) ??
      openRouterEffort(requestOptions.headers?.[CRAFTKIT_REASONING_EFFORT_HEADER]);
    const done = runChat(
      chatPayload(params, options, requestedEffort ?? options.effort),
      options,
      requestOptions.signal,
      report,
    );
    return {
      on: (event: string, listener: (delta: string) => void) => {
        listeners.set(event, listener);
      },
      finalMessage: () => done,
    };
  };

  return { messages: { stream } } as unknown as Anthropic;
}
