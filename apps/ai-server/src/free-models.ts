import {
  OPENROUTER_DEFAULT_BASE_URL,
  openRouterFactsOf,
  type OpenRouterFetch,
  type OpenRouterModelFacts,
} from './openrouter-client';

/**
 * The free OpenRouter models, as OpenRouter lists them NOW.
 *
 * The owner's `.env` list of free slugs was a snapshot, and free slugs come and
 * go: of the six in it on 2026-10-06, three were gone from the listing and ten
 * newer ones were there. So the picker no longer trusts a list typed in a file.
 * The server asks OpenRouter's public `/models` (no key, no credit), keeps the
 * answer for `ttlMs`, and serves it to the playground (`GET /v1/models`); a
 * request that names a free slug the listing carries is allowed without it
 * being in `CRAFTKIT_AI_MODELS`.
 *
 * A listing that cannot be fetched keeps the last good answer, and with none,
 * answers empty — the configured models still work, only the live part is
 * missing, and `error` says why.
 */

export interface FreeModel {
  readonly id: string;
  /** The vendor's display name, `Apodex 1.1 Mini`. */
  readonly name: string;
  readonly contextLength: number;
  /** Decodes straight into a JSON schema; a plan from it cannot be malformed. */
  readonly structuredOutputs: boolean;
  /** Unix seconds OpenRouter first listed it; newest first is the picker's order within a kind. */
  readonly created: number;
}

export interface FreeModelListing {
  readonly models: readonly FreeModel[];
  /** When this answer was read from OpenRouter, ms since the epoch; 0 when it never was. */
  readonly fetchedAt: number;
  /** Why the last refresh failed; absent when it succeeded. The models are then the last good ones. */
  readonly error?: string;
}

export interface FreeModelCatalog {
  /** The current listing, refreshed first when older than the TTL. Never rejects. */
  list(): Promise<FreeModelListing>;
  /** Whether `slug` is a free model OpenRouter lists right now. */
  has(slug: string): Promise<boolean>;
}

export interface FreeModelCatalogOptions {
  readonly baseUrl?: string;
  readonly fetch?: OpenRouterFetch;
  /** How long an answer is kept. Default five minutes. */
  readonly ttlMs?: number;
  readonly now?: () => number;
  /**
   * Told each model's facts (output ceiling, strict decoding) on every refresh, so the
   * OpenRouter client clamps and decodes a live model like a configured one.
   */
  readonly onFacts?: (facts: ReadonlyMap<string, OpenRouterModelFacts>) => void;
  readonly onLog?: (line: string) => void;
}

const DEFAULT_TTL_MS = 5 * 60_000;
const RETRY_AFTER_FAILURE_MS = 30_000;
/** A plan is 15-25k output tokens of JSON; a smaller window or ceiling cannot hold one. */
const MIN_CONTEXT = 100_000;
const MIN_OUTPUT = 16_000;
/** Models that classify, embed or rank are free and listed, and cannot write a page. */
const NOT_A_WRITER = /safety|guard|moderat|embed|rerank|classif/iu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function modalities(entry: Record<string, unknown>, key: string): readonly unknown[] {
  const architecture = isRecord(entry['architecture']) ? entry['architecture'] : {};
  const list = architecture[key];
  return Array.isArray(list) ? list : [];
}

/** The free models of an OpenRouter `/models` body that can write a page plan, best first. */
export function freeModelsOf(listing: unknown): {
  readonly models: readonly FreeModel[];
  readonly facts: Map<string, OpenRouterModelFacts>;
} {
  const entries = isRecord(listing) && Array.isArray(listing['data']) ? listing['data'] : [];
  const models: FreeModel[] = [];
  const facts = new Map<string, OpenRouterModelFacts>();
  for (const entry of entries as unknown[]) {
    if (!isRecord(entry)) continue;
    const id = entry['id'];
    if (typeof id !== 'string' || !id.endsWith(':free') || NOT_A_WRITER.test(id)) continue;
    const pricing = isRecord(entry['pricing']) ? entry['pricing'] : {};
    if (Number(pricing['prompt']) !== 0 || Number(pricing['completion']) !== 0) continue;
    if (!modalities(entry, 'input_modalities').includes('text')) continue;
    if (!modalities(entry, 'output_modalities').includes('text')) continue;
    const contextLength = Number(entry['context_length']);
    if (!Number.isFinite(contextLength) || contextLength < MIN_CONTEXT) continue;
    const modelFacts = openRouterFactsOf(entry);
    if (modelFacts.maxOutputTokens !== undefined && modelFacts.maxOutputTokens < MIN_OUTPUT) {
      continue;
    }
    const name = typeof entry['name'] === 'string' ? entry['name'] : id;
    const created = Number(entry['created']);
    facts.set(id, modelFacts);
    models.push({
      id,
      name: name.replace(/\s*\(free\)\s*$/iu, ''),
      contextLength,
      structuredOutputs: modelFacts.structuredOutputs,
      created: Number.isFinite(created) ? created : 0,
    });
  }
  models.sort(
    (left, right) =>
      Number(right.structuredOutputs) - Number(left.structuredOutputs) ||
      right.created - left.created ||
      left.id.localeCompare(right.id),
  );
  return { models, facts };
}

export function createFreeModelCatalog(options: FreeModelCatalogOptions = {}): FreeModelCatalog {
  const fetchImpl: OpenRouterFetch = options.fetch ?? ((input, init) => fetch(input, init));
  const baseUrl = (options.baseUrl ?? OPENROUTER_DEFAULT_BASE_URL).replace(/\/+$/u, '');
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const now = options.now ?? Date.now;
  const onLog = options.onLog ?? ((): void => undefined);

  let current: FreeModelListing = { models: [], fetchedAt: 0 };
  /** One refresh at a time: a burst of picker polls is one request to OpenRouter. */
  let refreshing: Promise<void> | undefined;

  let attemptedAt: number | undefined;

  const refresh = async (): Promise<void> => {
    attemptedAt = now();
    try {
      const response = await fetchImpl(`${baseUrl}/models`, {
        method: 'GET',
        headers: { accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`OpenRouter answered ${String(response.status)}`);
      const { models, facts } = freeModelsOf(await response.json());
      const before = new Set(current.models.map((model) => model.id));
      current = { models, fetchedAt: now() };
      options.onFacts?.(facts);
      const added = models.filter((model) => !before.has(model.id)).length;
      const gone = [...before].filter((id) => !facts.has(id)).length;
      if (before.size === 0 || added > 0 || gone > 0) {
        onLog(`free models: ${String(models.length)} listed (+${String(added)}, -${String(gone)})`);
      }
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : 'the listing could not be read';
      // Keep the last good models.
      current = { ...current, error };
      onLog(`free models: refresh failed — ${error}`);
    }
  };

  const list = async (): Promise<FreeModelListing> => {
    // After a failure the next ask retries soon, not after a full TTL, but not on every ask either.
    const wait = current.error === undefined ? ttlMs : RETRY_AFTER_FAILURE_MS;
    if (attemptedAt === undefined || now() - attemptedAt >= wait) {
      refreshing ??= refresh().finally(() => {
        refreshing = undefined;
      });
      await refreshing;
    }
    return current;
  };

  return {
    list,
    has: async (slug) => (await list()).models.some((model) => model.id === slug),
  };
}
