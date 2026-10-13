import Anthropic from '@anthropic-ai/sdk';

import {
  AI_BATCH_ITEM_ID_PATTERN,
  AI_BATCH_MAX_ITEMS,
  AI_BATCH_PATH,
} from '@craftkit/builder/wire';

import {
  planBatchItem,
  reviewBatchItem,
  type BatchBackend,
  type BuiltItem,
  type Judge,
} from './batch-items';
import { prewarm, prewarmPlan } from './batch-prewarm';
import { batchCacheMisses, type CacheMissReason, type DoctorParams } from './cache-doctor';
import {
  answerBody,
  readPagePlanMessage,
  readPlanMessage,
  reportUsage,
  type AnswerHooks,
  type UsageSink,
} from './plan-answer';
import { errorResponse } from './plan-errors';
import { usageOf, type UsageReport } from './plan-params';
import {
  DEFAULT_MAX_REQUEST_BYTES,
  MODEL_HEADER,
  authorized,
  readJsonBody,
  readPlanCall,
  type PlanRequestPolicy,
} from './plan-request';
import { readSceneReviewCall, readSceneReviewMessage, sceneReviewBody } from './scene-review';

export type { BatchBackend } from './batch-items';

/*
  Background batches (2026-10-12): the agent's big jobs — the same request on every page of a
  site, every chapter, every language — sent through the Message Batches API at half price.

  Each item is a /plan body, held to /plan's checks (plan-request.ts) and built into the very
  request a live call sends (plan-params.ts; for an `api:` model, the routing client's
  `apiParams` too). Each succeeded item comes back as the body /plan would have answered
  (plan-answer.ts), so the client judges it at the same door as a live plan.

  Only the Messages API batches. The local CLI and OpenRouter answer one streamed call at a
  time, so a server on either answers 501 naming what is missing, and an item that names a
  model only they serve answers 409.

  A background build's scene reviews ride the same routes (2026-10-13): an item that carries
  `review` instead of `request` is a `/v1/scene/review` body, held to that endpoint's door and
  answered with the body it would have answered (batch-items.ts). Before the batch goes, one
  live call may warm the prefix its items share, so they read it instead of each writing it
  (batch-prewarm.ts); what it cost comes back as `warmUsage`. Each item that wrote the cache
  anyway says why (`usage.cacheMiss`, cache-doctor.ts), as a live call does.

  The server keeps no batch: its id is the API's. What it keeps, in memory, is each plan
  item's shape judge (`planShapeCheck`), which picks between the candidates a salvage of a
  broken answer produces; a server restarted since the batch was sent reads its results
  without them, and says so in its log.
*/

/** Why this server cannot batch at all: a sentence naming what is missing. */
export interface BatchUnavailable {
  readonly unavailable: string;
}

export type BatchCapability = BatchBackend | BatchUnavailable;

/** What the batch routes read from the handler's options. `HandlerOptions` is one. */
export interface BatchRouteOptions extends PlanRequestPolicy, UsageSink, AnswerHooks {
  readonly batches?: BatchCapability | undefined;
  /** The scene review's model choice reads it, as the live endpoint does. */
  readonly enhanceModel?: string | undefined;
  readonly authToken?: string;
  readonly maxRequestBytes?: number;
  readonly maxTokens?: number;
}

const NOT_CONFIGURED =
  'Background batches are not configured on this server: they need the Anthropic Messages API (ANTHROPIC_API_KEY).';

/** Batches remembered for their shape judges; the oldest is forgotten first. */
const LEDGER_MAX_BATCHES = 256;

const BATCH_ID = /^[A-Za-z0-9_-]{1,200}$/u;

/** Whether a path is one of the batch routes. */
export function isBatchPath(pathname: string): boolean {
  return pathname === AI_BATCH_PATH || pathname.startsWith(`${AI_BATCH_PATH}/`);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

type BatchRoute =
  | { readonly kind: 'create' }
  | { readonly kind: 'status' | 'results' | 'cancel'; readonly id: string };

const ROUTES = 'Use POST /batch, GET /batch/:id, GET /batch/:id/results or POST /batch/:id/cancel.';

function routeOf(method: string, pathname: string): BatchRoute | Response {
  const parts = pathname.slice(AI_BATCH_PATH.length).split('/').filter(Boolean);
  const [id, action, ...rest] = parts;
  if (id === undefined)
    return method === 'POST' ? { kind: 'create' } : json({ error: ROUTES }, 405);
  if (!BATCH_ID.test(id) || rest.length > 0) return json({ error: 'Endpoint not found.' }, 404);
  if (action === undefined)
    return method === 'GET' ? { kind: 'status', id } : json({ error: ROUTES }, 405);
  if (action === 'results')
    return method === 'GET' ? { kind: 'results', id } : json({ error: ROUTES }, 405);
  if (action === 'cancel')
    return method === 'POST' ? { kind: 'cancel', id } : json({ error: ROUTES }, 405);
  return json({ error: 'Endpoint not found.' }, 404);
}

/** A batch's state, as the wire carries it. */
function stateOf(batch: Anthropic.Messages.MessageBatch): Readonly<Record<string, unknown>> {
  const counts = batch.request_counts;
  return {
    version: 1,
    id: batch.id,
    status: batch.processing_status,
    counts: {
      processing: counts.processing,
      succeeded: counts.succeeded,
      errored: counts.errored,
      canceled: counts.canceled,
      expired: counts.expired,
    },
    createdAt: batch.created_at,
    endedAt: batch.ended_at,
    expiresAt: batch.expires_at,
  };
}

/** One item as sent: a plan body (`request`) or a scene review body (`review`), never both. */
interface BatchBodyItem {
  readonly id: string;
  readonly request?: unknown;
  readonly review?: unknown;
}

interface BatchBody {
  readonly model?: string;
  readonly items: readonly BatchBodyItem[];
}

function readBatchBody(body: unknown): BatchBody | { readonly error: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { error: 'Expected a batch request of version 1.' };
  }
  const record = body as Record<string, unknown>;
  const { version, model, items } = record;
  if (version !== 1) return { error: 'Expected a batch request of version 1.' };
  if (model !== undefined && typeof model !== 'string') {
    return { error: 'The batch\'s "model" must be a model name.' };
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > AI_BATCH_MAX_ITEMS) {
    return { error: `A batch carries 1 to ${String(AI_BATCH_MAX_ITEMS)} items.` };
  }
  const seen = new Set<string>();
  const read: BatchBodyItem[] = [];
  for (const item of items as unknown[]) {
    const id: unknown =
      typeof item === 'object' && item !== null ? (item as { id?: unknown }).id : undefined;
    if (typeof id !== 'string' || !AI_BATCH_ITEM_ID_PATTERN.test(id)) {
      return { error: 'Every item needs an "id" of 1-62 letters, digits, "_" or "-".' };
    }
    if (seen.has(id)) return { error: `Item id "${id}" appears twice.` };
    seen.add(id);
    const { request, review } = item as { request?: unknown; review?: unknown };
    if (request !== undefined && review !== undefined) {
      return { error: `Item "${id}" carries both a "request" and a "review".` };
    }
    read.push(review === undefined ? { id, request } : { id, review });
  }
  return {
    ...(model === undefined || model.trim() === '' ? {} : { model: model.trim() }),
    items: read,
  };
}

/** A request as the cache doctor reads it: its system as blocks (ours always are). */
function doctorParams(params: Anthropic.Messages.MessageCreateParamsNonStreaming): DoctorParams {
  return { ...params, system: Array.isArray(params.system) ? params.system : [] };
}

/** The plain sentence for an item that got no answer: never the API's own prose. */
function noAnswer(result: Anthropic.Messages.MessageBatchResult): {
  type: string;
  message: string;
} {
  if (result.type === 'canceled') {
    return {
      type: 'canceled',
      message: 'The batch was cancelled before this request was answered.',
    };
  }
  if (result.type === 'expired') {
    return {
      type: 'expired',
      message: 'The batch ended (24 hours) before this request was answered; send it again.',
    };
  }
  const type = result.type === 'errored' ? result.error.error.type : 'api_error';
  const message =
    type === 'invalid_request_error'
      ? 'The assistant rejected this request as malformed.'
      : type === 'authentication_error' || type === 'permission_error'
        ? 'The assistant server is not configured with a valid API key.'
        : 'The assistant service failed to answer this request; send it again.';
  return { type, message };
}

/** What a batch's results are read with, by `custom_id`: plan shape judges, cache-miss reasons. */
interface Remembered {
  readonly judges: ReadonlyMap<string, Judge>;
  readonly misses: ReadonlyMap<string, CacheMissReason>;
}

/** Each batch's judges and miss reasons, and whether its usage was logged already. */
function createLedger() {
  const batches = new Map<string, Remembered & { logged: boolean }>();
  return {
    remember(id: string, remembered: Remembered): void {
      batches.set(id, { ...remembered, logged: false });
      while (batches.size > LEDGER_MAX_BATCHES) {
        const oldest = batches.keys().next().value;
        if (oldest === undefined) break;
        batches.delete(oldest);
      }
    },
    entry(id: string) {
      return batches.get(id);
    },
  };
}

/**
 * The batch routes, for `createHandler`. Auth first, as /plan's; then whether this server can
 * batch at all; then the route.
 */
export function createBatchRoutes(options: BatchRouteOptions) {
  const ledger = createLedger();
  const maxRequestBytes = options.maxRequestBytes ?? DEFAULT_MAX_REQUEST_BYTES;

  async function create(request: Request, backend: BatchBackend): Promise<Response> {
    const read = await readJsonBody(request, maxRequestBytes);
    if ('error' in read) return json({ error: read.error }, read.status);
    const batch = readBatchBody(read.body);
    if ('error' in batch) return json({ error: batch.error }, 400);
    // The batch's model is the person's pick for every item, as the picker's header is for one.
    const headers = new Headers(request.headers);
    if (batch.model !== undefined) headers.set(MODEL_HEADER, batch.model);
    const requests: Anthropic.Messages.BatchCreateParams.Request[] = [];
    const judges = new Map<string, Judge>();
    for (const item of batch.items) {
      const built = await builtItem(item, headers, backend);
      if ('error' in built) {
        return json({ error: `Item "${item.id}": ${built.error}`, item: item.id }, built.status);
      }
      requests.push(built.request);
      if (built.judge !== undefined) judges.set(built.request.custom_id, built.judge);
    }
    const warm = await warmed(requests, backend, request.signal);
    const created = await backend.client.messages.batches.create(
      { requests },
      { signal: request.signal },
    );
    // Why an item that wrote the cache did (cache-doctor.ts), read with its result.
    const reasons = batchCacheMisses(
      requests.map(({ params }) => doctorParams(params)),
      warm?.params,
    );
    const misses = new Map(
      requests.map(({ custom_id }, at) => [custom_id, reasons[at] ?? 'unknown']),
    );
    ledger.remember(created.id, { judges, misses });
    options.onLog?.(`batch ${created.id}: ${String(requests.length)} requests sent at batch price`);
    const state = stateOf(created);
    return json(warm === undefined ? state : { ...state, warmUsage: warm.usage });
  }

  /** One item, built as its live call's request: a review at the review door, a plan at /plan's. */
  async function builtItem(
    item: BatchBodyItem,
    headers: Headers,
    backend: BatchBackend,
  ): Promise<BuiltItem> {
    if (item.review !== undefined) {
      const call = readSceneReviewCall(item.review, headers, options);
      return 'error' in call ? call : reviewBatchItem(item.id, call, backend);
    }
    const call = await readPlanCall(headers, item.request, options);
    return 'error' in call ? call : planBatchItem(item.id, call.wire, call.run, backend);
  }

  /** The one warm call, when a prefix is worth it (batch-prewarm.ts); a failed one is only logged. */
  async function warmed(
    requests: readonly Anthropic.Messages.BatchCreateParams.Request[],
    backend: BatchBackend,
    signal: AbortSignal,
  ): Promise<{ readonly params: DoctorParams; readonly usage: UsageReport } | undefined> {
    const plan = prewarmPlan(requests);
    if (plan === undefined) return undefined;
    try {
      const usage = await prewarm(backend.client, plan, signal);
      reportUsage(options, usage, 'cache-warm');
      options.onLog?.(
        `batch: warmed a ~${String(plan.tokens)}-token prefix ${String(plan.sharers)} items share ` +
          `(wrote ${String(usage.cacheWriteTokens ?? '?')}, read ${String(usage.cacheReadTokens ?? '?')})`,
      );
      return { params: doctorParams(plan.params), usage };
    } catch (cause) {
      signal.throwIfAborted();
      const said = cause instanceof Error ? cause.message : String(cause);
      options.onLog?.(
        `batch: the cache warm-up failed (${said.slice(0, 200)}); sending without it`,
      );
      return undefined;
    }
  }

  async function results(
    id: string,
    backend: BatchBackend,
    signal: AbortSignal,
  ): Promise<Response> {
    const state = await backend.client.messages.batches.retrieve(id, { signal });
    if (state.processing_status !== 'ended') {
      return json(
        { error: 'The batch has not ended yet: ask for its results once its status is "ended".' },
        409,
      );
    }
    const remembered = ledger.entry(id);
    if (remembered === undefined) {
      options.onLog?.(
        `batch ${id}: read without its shape judges (sent before this server started)`,
      );
    }
    const logUsage = remembered?.logged !== true;
    const items: unknown[] = [];
    for await (const entry of await backend.client.messages.batches.results(id, { signal })) {
      const marked = /^([pgr])-(.+)$/u.exec(entry.custom_id);
      const itemId = marked?.[2];
      if (marked === null || itemId === undefined) continue;
      const result = entry.result;
      if (result.type !== 'succeeded') {
        items.push({ id: itemId, error: noAnswer(result) });
        continue;
      }
      const task = marked[1] === 'r' ? 'scene-review' : marked[1] === 'g' ? 'page-plan' : 'plan';
      const measured = usageOf(result.message);
      // A write says why, as a live call's does (cache-doctor.ts); a read needs no reason.
      const reason = remembered?.misses.get(entry.custom_id);
      const usage =
        reason === undefined || (measured.cacheWriteTokens ?? 0) === 0
          ? measured
          : { ...measured, cacheMiss: { reason, missedTokens: null, source: 'local' as const } };
      const answered =
        task === 'scene-review'
          ? { body: sceneReviewBody(readSceneReviewMessage(result.message, options.onAnswer)) }
          : answerBody(
              task === 'page-plan'
                ? readPagePlanMessage(result.message, options)
                : readPlanMessage(result.message, remembered?.judges.get(entry.custom_id), options),
              usage,
            );
      if (logUsage) reportUsage(options, usage, task);
      items.push({ id: itemId, body: answered.body, usage });
    }
    if (remembered !== undefined) remembered.logged = true;
    return json({ version: 1, id, items });
  }

  return async function batchResponse(request: Request, url: URL): Promise<Response> {
    if (!authorized(request, options.authToken)) return json({ error: 'Unauthorized.' }, 401);
    const capability = options.batches;
    if (capability === undefined || 'unavailable' in capability) {
      return json({ error: capability?.unavailable ?? NOT_CONFIGURED }, 501);
    }
    const route = routeOf(request.method, url.pathname);
    if (route instanceof Response) return route;
    const batches = capability.client.messages.batches;
    try {
      if (route.kind === 'create') return await create(request, capability);
      if (route.kind === 'results') return await results(route.id, capability, request.signal);
      const batch =
        route.kind === 'cancel'
          ? await batches.cancel(route.id, { signal: request.signal })
          : await batches.retrieve(route.id, { signal: request.signal });
      return json(stateOf(batch));
    } catch (cause) {
      if (cause instanceof Anthropic.NotFoundError)
        return json({ error: 'No batch has that id.' }, 404);
      return errorResponse(cause);
    }
  };
}
