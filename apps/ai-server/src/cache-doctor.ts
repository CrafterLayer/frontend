import { createHash } from 'node:crypto';

/*
  Why a request did not read the prompt cache (2026-10-13).

  The person measured runs that wrote the cache and read nothing back, and the usage fields say
  THAT the prefix broke, never WHERE. A local reproduction (two consecutive edits through the
  real client and this server) showed the prefix itself is sound — the same request on the
  same page sends byte-identical blocks — and that a selection rewrites the catalog block and
  new words the skills block, each costing only the blocks from there on. A request that reads
  NOTHING lost even the rules: a different model or thinking/effort than the last request of
  its kind, the first request of its kind, an entry past its lifetime, or a route that does not
  keep the cache (OpenRouter may answer from another upstream). This doctor names which.

  Two sources, one answer:
  - Locally, for every route: each request is compared with the previous request of the same
    kind (same model, same rules, same thinking and effort: a build's scene writers think and
    its other writers do not, and each keeps its own entries) — each cached system block, then
    the history behind the conversation breakpoint. A kind first seen under other settings is
    named for its settings.
  - The Messages API's own diagnosis (beta `cache-diagnosis-2026-04-07`, `api:` slugs only):
    the request names the previous response's id and the answer says whether the model, the
    system, the tools or the messages diverged, and how many tokens that cost. A rejected
    beta turns it off for the process; the local comparison stays.
*/

export const CACHE_DIAGNOSIS_BETA = 'cache-diagnosis-2026-04-07';

/** Why the cache was not read, as the panel names it. */
export type CacheMissReason =
  | 'first'
  | 'expired'
  | 'model'
  | 'settings'
  | 'rules'
  | 'catalog'
  | 'skills'
  | 'system'
  | 'tools'
  | 'history'
  | 'unknown';

export interface CacheMiss {
  readonly reason: CacheMissReason;
  /** Tokens the API says would have been read had the prefix matched (API diagnosis only). */
  readonly missedTokens: number | null;
  /** Who said so: the API's own comparison, or this server's. */
  readonly source: 'api' | 'local';
}

interface Block {
  readonly text: string;
  readonly cache_control?: unknown;
}

interface Turn {
  readonly content: unknown;
}

/** The request fields the doctor reads. */
export interface DoctorParams {
  readonly model: string;
  readonly thinking?: unknown;
  readonly output_config?: { readonly effort?: unknown } | null | undefined;
  readonly system?: readonly Block[];
  readonly messages?: readonly Turn[];
}

interface Fingerprint {
  readonly at: number;
  readonly settings: string;
  readonly blocks: readonly { readonly name: CacheMissReason; readonly hash: string }[];
  readonly history: string;
  readonly id: string | undefined;
}

const hash = (text: string): string => createHash('sha256').update(text).digest('hex').slice(0, 16);

/** The cached system block's name: what changed when it differs. */
function blockName(block: Block, index: number): CacheMissReason {
  if (block.text.startsWith('# Active skills')) return 'skills';
  if (block.text.startsWith('# Block catalog')) return 'catalog';
  return index === 0 ? 'rules' : 'system';
}

function fingerprintOf(params: DoctorParams, at: number): Omit<Fingerprint, 'id'> {
  const system = params.system ?? [];
  const messages = params.messages ?? [];
  return {
    at,
    settings: JSON.stringify([params.thinking ?? null, params.output_config?.effort ?? null]),
    blocks: system
      .map((block, index) => ({ block, index }))
      .filter(({ block }) => block.cache_control !== undefined)
      .map(({ block, index }) => ({ name: blockName(block, index), hash: hash(block.text) })),
    // Everything before the current turn: what the conversation breakpoint caches.
    history: hash(JSON.stringify(messages.slice(0, -1).map(({ content }) => content))),
  };
}

/** The request's kind: the same model writing under the same rules. */
function kindOf(params: DoctorParams): string {
  return `${params.model}|${hash(params.system?.[0]?.text ?? '')}`;
}

/** An `api:` slug: the Anthropic Messages API, the only route the API's diagnosis exists on. */
function onMessagesApi(model: string): boolean {
  return model.startsWith('api:');
}

/** The system's cached blocks, by name: what the API's "system changed" narrows to. */
const SYSTEM_BLOCKS: ReadonlySet<CacheMissReason> = new Set([
  'rules',
  'catalog',
  'skills',
  'system',
]);

const API_REASONS: Readonly<Record<string, CacheMissReason>> = {
  model_changed: 'model',
  system_changed: 'system',
  tools_changed: 'tools',
  messages_changed: 'history',
};

export interface CacheVisit {
  /** Body fields to add to the request (the API diagnosis), or none. */
  readonly body: Readonly<Record<string, unknown>>;
  /** Request headers to add (the diagnosis beta), or none. */
  readonly headers: Readonly<Record<string, string>>;
  /**
   * The answer's verdict: undefined when the cache was read in full (nothing was written),
   * else why the prefix (or its tail) was written instead of read.
   */
  readonly done: (message: {
    readonly id?: unknown;
    readonly usage?: unknown;
    readonly diagnostics?: unknown;
  }) => CacheMiss | undefined;
}

export interface CacheDoctor {
  visit(params: DoctorParams): CacheVisit;
  /** The API refused the diagnosis beta: compare locally from now on. */
  disableApiDiagnosis(): void;
  readonly apiDiagnosis: boolean;
}

export interface CacheDoctorOptions {
  readonly now?: () => number;
  /** Ask the Messages API for its own diagnosis on `api:` slugs (default true). */
  readonly apiDiagnosis?: boolean;
  /** How long an entry lives (the breakpoints' TTL). */
  readonly ttlMs?: number;
}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function apiMiss(diagnostics: unknown): CacheMiss | undefined {
  if (typeof diagnostics !== 'object' || diagnostics === null) return undefined;
  const miss = (diagnostics as { cache_miss_reason?: unknown }).cache_miss_reason;
  if (typeof miss !== 'object' || miss === null) return undefined;
  const type = (miss as { type?: unknown }).type;
  const reason = typeof type === 'string' ? API_REASONS[type] : undefined;
  if (reason === undefined) return undefined;
  return {
    reason,
    missedTokens: count(
      (miss as { cache_missed_input_tokens?: unknown }).cache_missed_input_tokens,
    ),
    source: 'api',
  };
}

/** Where the previous request of the same kind and this one first differ. */
function localMiss(
  previous: Fingerprint | undefined,
  next: Omit<Fingerprint, 'id'>,
  ttlMs: number,
): CacheMissReason {
  if (previous === undefined) return 'first';
  if (next.at - previous.at > ttlMs) return 'expired';
  for (const [index, block] of next.blocks.entries()) {
    if (previous.blocks[index]?.hash !== block.hash) return block.name;
  }
  if (previous.history !== next.history) return 'history';
  return 'unknown';
}

export function createCacheDoctor(options: CacheDoctorOptions = {}): CacheDoctor {
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? 60 * 60 * 1000;
  let apiDiagnosis = options.apiDiagnosis ?? true;
  // The last request per kind and settings, and every kind seen under any settings.
  const lanes = new Map<string, Fingerprint>();
  const kinds = new Set<string>();
  return {
    get apiDiagnosis() {
      return apiDiagnosis;
    },
    disableApiDiagnosis() {
      apiDiagnosis = false;
    },
    visit(params) {
      const kind = kindOf(params);
      const next = fingerprintOf(params, now());
      const lane = `${kind}|${next.settings}`;
      const previous = lanes.get(lane);
      const newSettings = previous === undefined && kinds.has(kind);
      const diagnose = apiDiagnosis && onMessagesApi(params.model);
      return {
        body: diagnose ? { diagnostics: { previous_message_id: previous?.id ?? null } } : {},
        headers: diagnose ? { 'anthropic-beta': CACHE_DIAGNOSIS_BETA } : {},
        done(message) {
          const id = typeof message.id === 'string' ? message.id : undefined;
          lanes.set(lane, { ...next, id });
          kinds.add(kind);
          const usage = (message.usage ?? {}) as Record<string, unknown>;
          const written = count(usage['cache_creation_input_tokens']) ?? 0;
          if (written === 0) return undefined;
          const local = newSettings ? 'settings' : localMiss(previous, next, ttlMs);
          const api = apiMiss(message.diagnostics);
          if (api === undefined) return { reason: local, missedTokens: null, source: 'local' };
          // The API says "system"; the local comparison knows which block of it.
          const specific = api.reason === 'system' && SYSTEM_BLOCKS.has(local);
          return specific ? { ...api, reason: local } : api;
        },
      };
    },
  };
}

/** One doctor per server process: lanes outlive a request. */
export const SHARED_CACHE_DOCTOR: CacheDoctor = createCacheDoctor({
  apiDiagnosis: process.env['CRAFTKIT_AI_CACHE_DIAGNOSIS'] !== '0',
});

/** Whether an error is the API refusing the diagnosis beta or its body field. */
export function isDiagnosisRefusal(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const status = (error as { status?: unknown }).status;
  const message = (error as { message?: unknown }).message;
  if (typeof message !== 'string') return false;
  return status === 400 && /diagnos|cache-diagnosis|anthropic-beta/iu.test(message);
}
