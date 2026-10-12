// The HTTP contract for BACKGROUND BATCHES (2026-10-12): many plan requests sent as one
// Message Batches job at half price, answered within 24 hours instead of seconds. Every item
// is an ordinary `AiPlanWireRequest`, held by the server to exactly the checks `/plan` makes,
// and every succeeded item's `body` is exactly the answer `/plan` would have given it — so
// the client reads it with the same decoders and judges it at the same door.
import type { AiPlanWireRequest } from './wire';

/**
 * The batch routes, on the plan endpoint's ORIGIN (like `/v1/prompt/enhance`), with the
 * same bearer, CORS and body-size rules as `/plan`:
 *
 *   POST /batch                 AiBatchWireRequest → AiBatchWireState
 *   GET  /batch/:id             → AiBatchWireState
 *   GET  /batch/:id/results     → AiBatchWireResults (409 until the state is "ended")
 *   POST /batch/:id/cancel      → AiBatchWireState
 *
 * Failures use /plan's envelope, `{"error": "…"}`: 400 a malformed batch or item (the
 * message names the item), 404 an unknown batch, 409 a model that cannot batch or results
 * asked for too early, 501 a server whose backend cannot batch at all (the local CLI,
 * OpenRouter), and /plan's statuses for the API's own failures.
 */
export const AI_BATCH_PATH = '/batch';
/** Items in one batch, at most. */
export const AI_BATCH_MAX_ITEMS = 100;
/**
 * An item id: what results are keyed by. The server marks each one with its task before it
 * becomes the API's `custom_id` (64 characters of `[A-Za-z0-9_-]`), so it has two fewer.
 */
export const AI_BATCH_ITEM_ID_PATTERN = /^[A-Za-z0-9_-]{1,62}$/u;

/** One request of a batch, and the id its answer comes back under. */
export interface AiBatchWireItem {
  readonly id: string;
  readonly request: AiPlanWireRequest;
}

/** POST /batch. `model` is the person's pick for every item (as `x-craftkit-ai-model` is for one). */
export interface AiBatchWireRequest {
  readonly version: 1;
  readonly model?: string;
  readonly items: readonly AiBatchWireItem[];
}

/** Where a batch is: still answering, stopping, or done (every item has a result). */
export type AiBatchWireStatus = 'in_progress' | 'canceling' | 'ended';

export interface AiBatchWireCounts {
  readonly processing: number;
  readonly succeeded: number;
  readonly errored: number;
  readonly canceled: number;
  readonly expired: number;
}

/** A batch's state. Times are the API's own ISO 8601 strings. */
export interface AiBatchWireState {
  readonly version: 1;
  readonly id: string;
  readonly status: AiBatchWireStatus;
  readonly counts: AiBatchWireCounts;
  readonly createdAt: string;
  readonly endedAt: string | null;
  readonly expiresAt?: string;
}

/**
 * One item's result: the `/plan` answer body (a plan, a refusal or the invalid-output report)
 * with what it cost, or an item that got no answer — `type` is the API's error type
 * (`invalid_request_error`, `overloaded_error`, …), `canceled` or `expired`.
 */
export type AiBatchWireResultItem =
  | { readonly id: string; readonly body: unknown; readonly usage?: unknown }
  | { readonly id: string; readonly error: { readonly type: string; readonly message: string } };

/** GET /batch/:id/results: one entry per item, in no particular order. */
export interface AiBatchWireResults {
  readonly version: 1;
  readonly id: string;
  readonly items: readonly AiBatchWireResultItem[];
}
