import { createHash } from 'node:crypto';

export const AGENT_CACHE_VERSION = 'craftkit-agent-cache-v1';
export const DEFAULT_CACHE_TTL_MS = 30 * 60 * 1_000;

export interface CacheMetrics {
  readonly reads: number;
  readonly hits: number;
  readonly misses: number;
  readonly writes: number;
  readonly evictions: number;
  readonly expirations: number;
}

export interface PromptCacheMetrics extends CacheMetrics {
  readonly ordinaryInputTokens: number | null;
  readonly cacheReadTokens: number | null;
  readonly cacheWriteTokens: number | null;
  readonly unknownReports: number;
}

export interface CacheEntry<T> {
  readonly value: T;
  readonly expiresAt: number;
}

export interface BoundedCache<T> {
  readonly namespace: string;
  key(input: unknown): string;
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  delete(key: string): void;
  clear(): void;
  metrics(): CacheMetrics;
}

export interface StablePromptPrefix {
  readonly policyVersion: string;
  readonly roleRules: string;
  readonly toolSchemas: unknown;
  readonly runtimeProfile: unknown;
  readonly designSystemContract: unknown;
}

export interface PromptCacheMeter {
  readonly cache: BoundedCache<string>;
  recordProviderUsage(input: {
    readonly inputTokens: number | null;
    readonly cacheReadTokens: number | null;
    readonly cacheWriteTokens: number | null;
  }): void;
  metrics(): PromptCacheMetrics;
}

export interface CreateBoundedCacheOptions {
  readonly namespace: string;
  readonly maxEntries?: number;
  readonly ttlMs?: number;
  readonly now?: () => number;
}

function canonical(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value !== 'object') throw new TypeError('Cache keys must contain JSON values.');
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Cache keys must contain plain JSON objects.');
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
    .join(',')}}`;
}

export function cacheKey(namespace: string, input: unknown): string {
  const digest = createHash('sha256').update(canonical(input), 'utf8').digest('hex');
  return `${AGENT_CACHE_VERSION}:${namespace}:${digest}`;
}

export function createBoundedCache<T>(options: CreateBoundedCacheOptions): BoundedCache<T> {
  const maxEntries = options.maxEntries ?? 200;
  const ttlMs = options.ttlMs ?? DEFAULT_CACHE_TTL_MS;
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 1)
    throw new Error('maxEntries must be positive.');
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1) throw new Error('ttlMs must be positive.');
  const now = options.now ?? Date.now;
  const entries = new Map<string, CacheEntry<T>>();
  const metric = { reads: 0, hits: 0, misses: 0, writes: 0, evictions: 0, expirations: 0 };

  return {
    namespace: options.namespace,
    key: (input) => cacheKey(options.namespace, input),
    get: (key) => {
      metric.reads += 1;
      const entry = entries.get(key);
      if (entry === undefined) {
        metric.misses += 1;
        return undefined;
      }
      if (entry.expiresAt <= now()) {
        entries.delete(key);
        metric.misses += 1;
        metric.expirations += 1;
        return undefined;
      }
      entries.delete(key);
      entries.set(key, entry);
      metric.hits += 1;
      return structuredClone(entry.value);
    },
    set: (key, value) => {
      entries.delete(key);
      entries.set(key, { value: structuredClone(value), expiresAt: now() + ttlMs });
      metric.writes += 1;
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
        metric.evictions += 1;
      }
    },
    delete: (key) => {
      entries.delete(key);
    },
    clear: () => {
      entries.clear();
    },
    metrics: () => ({ ...metric }),
  };
}

export function stablePromptPrefix(prefix: StablePromptPrefix): string {
  return [
    `policy:${prefix.policyVersion}`,
    '# Role and tool rules',
    prefix.roleRules,
    '# Tool schemas',
    canonical(prefix.toolSchemas),
    '# Runtime profile',
    canonical(prefix.runtimeProfile),
    '# Design system contract',
    canonical(prefix.designSystemContract),
  ].join('\n');
}

function addKnown(current: number | null, value: number | null): number | null {
  if (current === null || value === null) return null;
  return current + value;
}

export function createPromptCacheMeter(
  options: Omit<CreateBoundedCacheOptions, 'namespace'> = {},
): PromptCacheMeter {
  const cache = createBoundedCache<string>({ ...options, namespace: 'prompt-prefix' });
  let ordinaryInputTokens: number | null = 0;
  let cacheReadTokens: number | null = 0;
  let cacheWriteTokens: number | null = 0;
  let unknownReports = 0;
  return {
    cache,
    recordProviderUsage: (usage) => {
      if (
        usage.inputTokens === null ||
        usage.cacheReadTokens === null ||
        usage.cacheWriteTokens === null
      ) {
        unknownReports += 1;
      }
      ordinaryInputTokens = addKnown(ordinaryInputTokens, usage.inputTokens);
      cacheReadTokens = addKnown(cacheReadTokens, usage.cacheReadTokens);
      cacheWriteTokens = addKnown(cacheWriteTokens, usage.cacheWriteTokens);
    },
    metrics: () => ({
      ...cache.metrics(),
      ordinaryInputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      unknownReports,
    }),
  };
}

export function createAgentCaches(options: { readonly now?: () => number } = {}) {
  const clock = options.now === undefined ? {} : { now: options.now };
  return {
    prompt: createPromptCacheMeter(clock),
    context: createBoundedCache<unknown>({ namespace: 'context-index', ...clock }),
    component: createBoundedCache<unknown>({ namespace: 'component-catalog', ...clock }),
  };
}
