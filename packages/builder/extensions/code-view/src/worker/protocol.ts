import { isJsonValue, type JsonValue } from '@craftkit/builder-schema';

export type TransformScope =
  { readonly kind: 'document' } | { readonly kind: 'node'; readonly nodeId: string };

export interface TransformRequest {
  readonly operation: 'project' | 'parse';
  readonly requestId: number;
  /**
   * Increments when INPUT arrives, not when this request starts. A queued newer
   * input therefore makes an older response detectably stale even before the
   * newer request reaches the worker.
   */
  readonly generation: number;
  readonly baseRevision: number;
  readonly scope: TransformScope;
  /** Resolved locally in the worker; projection functions never cross this boundary. */
  readonly projectionId: string;
  /** `null` for projection; draft text for parsing. */
  readonly payload: string | null;
}

/** The document has its own channel so typing never clones it per request. */
export interface TransformDocumentMessage {
  readonly kind: 'document';
  readonly baseRevision: number;
  readonly payload: string;
}

export type TransformWorkerMessage = TransformDocumentMessage | TransformRequest;

export interface TransformPatch {
  readonly op: 'add' | 'remove' | 'replace';
  readonly path: readonly (string | number)[];
  readonly value?: JsonValue | undefined;
}

export interface TransformParseError {
  readonly line: number;
  readonly message: string;
}

interface TransformResultContext {
  readonly baseRevision: number;
  readonly scope: TransformScope;
}

export interface ProjectedTextResult extends TransformResultContext {
  readonly kind: 'projected';
  readonly text: string;
}

export interface ParseSuccessResult extends TransformResultContext {
  readonly kind: 'parsed';
  readonly ok: true;
  readonly patches: readonly TransformPatch[];
}

export interface ParseFailureResult extends TransformResultContext {
  readonly kind: 'parsed';
  readonly ok: false;
  readonly errors: readonly TransformParseError[];
}

export type TransformParseResult = ParseSuccessResult | ParseFailureResult;

export interface TransformProtocolError extends TransformResultContext {
  readonly kind: 'protocol-error';
  readonly code: string;
  readonly message: string;
}

export type TransformResult = ProjectedTextResult | TransformParseResult | TransformProtocolError;

export interface TransformResponse {
  readonly requestId: number;
  /** Echoes the input generation; it is never allocated when work starts. */
  readonly generation: number;
  readonly result: TransformResult;
}

type JsonRecord = Record<string, JsonValue>;

function isRecord(value: JsonValue): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: JsonRecord, keys: readonly string[]): boolean {
  const ownKeys = Reflect.ownKeys(value);
  return (
    ownKeys.length === keys.length &&
    ownKeys.every((key) => typeof key === 'string' && keys.includes(key))
  );
}

function hasFunction(value: unknown, ancestors: Set<object>): boolean {
  if (typeof value === 'function') {
    return true;
  }
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (ancestors.has(value)) {
    return false;
  }

  ancestors.add(value);
  try {
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined) {
        return true;
      }
      if (descriptor.get !== undefined || descriptor.set !== undefined) {
        return true;
      }
      if (hasFunction(descriptor.value, ancestors)) {
        return true;
      }
    }
    return false;
  } finally {
    ancestors.delete(value);
  }
}

/** Runtime half of the serializable-only worker law. */
export function isSerializableValue(value: unknown): value is JsonValue {
  try {
    return !hasFunction(value, new Set()) && isJsonValue(value);
  } catch {
    // Proxies/getters are not protocol data, and a guard must fail closed rather than throw.
    return false;
  }
}

function isCounter(value: JsonValue | undefined): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function isTransformScope(value: unknown): value is TransformScope {
  if (!isSerializableValue(value) || !isRecord(value)) {
    return false;
  }
  if (value['kind'] === 'document') {
    return hasExactKeys(value, ['kind']);
  }
  return (
    value['kind'] === 'node' &&
    typeof value['nodeId'] === 'string' &&
    hasExactKeys(value, ['kind', 'nodeId'])
  );
}

export function isTransformRequest(value: unknown): value is TransformRequest {
  if (!isSerializableValue(value) || !isRecord(value)) {
    return false;
  }
  return (
    (value['operation'] === 'project' || value['operation'] === 'parse') &&
    isCounter(value['requestId']) &&
    isCounter(value['generation']) &&
    isCounter(value['baseRevision']) &&
    isTransformScope(value['scope']) &&
    typeof value['projectionId'] === 'string' &&
    (typeof value['payload'] === 'string' || value['payload'] === null) &&
    hasExactKeys(value, [
      'operation',
      'requestId',
      'generation',
      'baseRevision',
      'scope',
      'projectionId',
      'payload',
    ])
  );
}

export function isTransformDocumentMessage(value: unknown): value is TransformDocumentMessage {
  if (!isSerializableValue(value) || !isRecord(value)) {
    return false;
  }
  return (
    value['kind'] === 'document' &&
    isCounter(value['baseRevision']) &&
    typeof value['payload'] === 'string' &&
    hasExactKeys(value, ['kind', 'baseRevision', 'payload'])
  );
}

export function isTransformWorkerMessage(value: unknown): value is TransformWorkerMessage {
  return isTransformDocumentMessage(value) || isTransformRequest(value);
}

function isTransformPatch(value: JsonValue): value is TransformPatch & JsonRecord {
  if (!isRecord(value)) {
    return false;
  }
  const hasValue = Object.hasOwn(value, 'value');
  return (
    (value['op'] === 'add' || value['op'] === 'remove' || value['op'] === 'replace') &&
    Array.isArray(value['path']) &&
    value['path'].every(
      (segment) =>
        typeof segment === 'string' || (typeof segment === 'number' && Number.isFinite(segment)),
    ) &&
    (!hasValue || isSerializableValue(value['value'])) &&
    hasExactKeys(value, hasValue ? ['op', 'path', 'value'] : ['op', 'path'])
  );
}

function isParseError(value: JsonValue): value is TransformParseError & JsonRecord {
  return (
    isRecord(value) &&
    typeof value['line'] === 'number' &&
    Number.isSafeInteger(value['line']) &&
    value['line'] >= 1 &&
    typeof value['message'] === 'string' &&
    hasExactKeys(value, ['line', 'message'])
  );
}

function hasResultContext(value: JsonRecord): boolean {
  return isCounter(value['baseRevision']) && isTransformScope(value['scope']);
}

export function isTransformResult(value: unknown): value is TransformResult {
  if (!isSerializableValue(value) || !isRecord(value) || !hasResultContext(value)) {
    return false;
  }

  if (value['kind'] === 'projected') {
    return (
      typeof value['text'] === 'string' &&
      hasExactKeys(value, ['kind', 'baseRevision', 'scope', 'text'])
    );
  }

  if (value['kind'] === 'parsed' && value['ok'] === true) {
    return (
      Array.isArray(value['patches']) &&
      value['patches'].every(isTransformPatch) &&
      hasExactKeys(value, ['kind', 'baseRevision', 'scope', 'ok', 'patches'])
    );
  }

  if (value['kind'] === 'parsed' && value['ok'] === false) {
    return (
      Array.isArray(value['errors']) &&
      value['errors'].every(isParseError) &&
      hasExactKeys(value, ['kind', 'baseRevision', 'scope', 'ok', 'errors'])
    );
  }

  return (
    value['kind'] === 'protocol-error' &&
    typeof value['code'] === 'string' &&
    typeof value['message'] === 'string' &&
    hasExactKeys(value, ['kind', 'baseRevision', 'scope', 'code', 'message'])
  );
}

export function isTransformResponse(value: unknown): value is TransformResponse {
  if (!isSerializableValue(value) || !isRecord(value)) {
    return false;
  }
  return (
    isCounter(value['requestId']) &&
    isCounter(value['generation']) &&
    isTransformResult(value['result']) &&
    hasExactKeys(value, ['requestId', 'generation', 'result'])
  );
}
