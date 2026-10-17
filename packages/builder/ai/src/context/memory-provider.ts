import type { AiContextProvider } from '@craftkit/builder-schema';

import { canonicalJsonStringify } from '../internal/canonical-json';

export const AI_MEMORY_MAX_RECORDS = 20;
export const AI_MEMORY_MAX_SUMMARY_LENGTH = 512;
export const AI_MEMORY_MAX_COMMAND_NAMES = 64;
export const AI_MEMORY_MAX_COMMAND_NAME_LENGTH = 160;

export type AiMemoryRecordKind = 'applied-change' | 'preference' | 'site-fact';

/**
 * Durable memory is host-authored outcome data, never a model message or a
 * reusable prompt. Keeping source/trust inside each record prevents role
 * information from disappearing when a host persists the body separately.
 */
export interface AiMemoryRecordV1 {
  readonly schemaVersion: 1;
  readonly source: 'host';
  readonly kind: AiMemoryRecordKind;
  readonly trust: 'reviewed';
  readonly summary: string;
  readonly commandNames?: readonly string[];
}

export interface MemoryContextProviderOptions {
  /** Called for every assembly; the host remains the persistence owner. */
  load: () => readonly AiMemoryRecordV1[];
  /** Fragment title; override when a host runs several independent memories. */
  title?: string;
  /** Stable provenance id for this host-owned memory seam. */
  source?: string;
  /** May narrow the global bound, never widen it. */
  maxRecords?: number;
}

export class AiMemoryContextError extends Error {
  override readonly name = 'AiMemoryContextError';

  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function fail(code: string, message: string): never {
  throw new AiMemoryContextError(code, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return fail('invalid-memory-text', `${label} must be a non-empty string.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    return fail(
      'memory-text-too-long',
      `${label} must be at most ${String(maxLength)} characters.`,
    );
  }
  return normalized;
}

function commandNames(value: unknown, index: number): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    return fail(
      'invalid-memory-command-names',
      `Memory record ${String(index)} commandNames must be an array.`,
    );
  }
  if (value.length > AI_MEMORY_MAX_COMMAND_NAMES) {
    return fail(
      'memory-command-limit',
      `Memory record ${String(index)} exceeds the command-name limit.`,
    );
  }
  const seen = new Set<string>();
  const result = value.map((name, commandIndex) => {
    const normalized = boundedText(
      name,
      `Memory record ${String(index)} commandNames[${String(commandIndex)}]`,
      AI_MEMORY_MAX_COMMAND_NAME_LENGTH,
    );
    if (seen.has(normalized)) {
      return fail(
        'duplicate-memory-command',
        `Memory record ${String(index)} repeats command ${normalized}.`,
      );
    }
    seen.add(normalized);
    return normalized;
  });
  return Object.freeze(result);
}

function normalizeRecord(value: unknown, index: number): Readonly<AiMemoryRecordV1> {
  if (!isRecord(value)) {
    return fail('invalid-memory-record', `Memory record ${String(index)} must be an object.`);
  }
  if (value['schemaVersion'] !== 1) {
    return fail(
      'invalid-memory-version',
      `Memory record ${String(index)} must use schemaVersion 1.`,
    );
  }
  if (value['source'] !== 'host') {
    return fail('invalid-memory-source', `Memory record ${String(index)} source must be host.`);
  }
  if (value['trust'] !== 'reviewed') {
    return fail('invalid-memory-trust', `Memory record ${String(index)} trust must be reviewed.`);
  }
  const kind = value['kind'];
  if (kind !== 'applied-change' && kind !== 'preference' && kind !== 'site-fact') {
    return fail('invalid-memory-kind', `Memory record ${String(index)} kind is not supported.`);
  }
  const names = commandNames(value['commandNames'], index);
  return Object.freeze({
    schemaVersion: 1,
    source: 'host',
    kind,
    trust: 'reviewed',
    summary: boundedText(
      value['summary'],
      `Memory record ${String(index)} summary`,
      AI_MEMORY_MAX_SUMMARY_LENGTH,
    ),
    ...(names === undefined ? {} : { commandNames: names }),
  });
}

function recordLimit(value: number | undefined): number {
  const limit = value ?? AI_MEMORY_MAX_RECORDS;
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > AI_MEMORY_MAX_RECORDS) {
    return fail(
      'invalid-memory-record-limit',
      `maxRecords must be between 1 and ${String(AI_MEMORY_MAX_RECORDS)}.`,
    );
  }
  return limit;
}

/**
 * Adapt structured host memory into one additive, role-labelled context
 * fragment. Extra object fields are deliberately discarded, so a persisted
 * model `rationale` can never silently become durable instruction context.
 */
export function createMemoryContextProvider(
  options: MemoryContextProviderOptions,
): AiContextProvider {
  const limit = recordLimit(options.maxRecords);
  const source = boundedText(options.source ?? 'host:session-memory', 'Memory source', 256);
  const title = boundedText(options.title ?? 'Session memory', 'Memory title', 512);
  return {
    id: source,
    collect() {
      const loaded: unknown = options.load();
      if (!Array.isArray(loaded)) {
        return fail('invalid-memory-load', 'Memory load must return an array of records.');
      }
      const omittedRecords = Math.max(0, loaded.length - limit);
      const records = loaded
        .slice(-limit)
        .map((record, index) => normalizeRecord(record, omittedRecords + index));
      return {
        source,
        kind: 'data',
        trust: 'reviewed',
        title,
        body: canonicalJsonStringify({ schemaVersion: 1, records, omittedRecords }),
      };
    },
  };
}
