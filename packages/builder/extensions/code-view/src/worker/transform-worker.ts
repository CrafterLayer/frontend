/// <reference lib="webworker" />
import type { BuilderDocument, Patch } from '@craftkit/builder-schema';
import {
  CANONICAL_JSON_PROJECTION_ID,
  parseDocument,
  parseScope,
  projectDocument,
  projectScope,
  type CodecPorts,
  type ParseResult,
} from '@craftkit/builder-transforms';

import {
  isSerializableValue,
  isTransformWorkerMessage,
  type TransformPatch,
  type TransformRequest,
  type TransformResponse,
  type TransformResult,
  type TransformScope,
} from './protocol';

/**
 * The worker entry (011 contract §3 w1). This is the ONE place the two halves of
 * B4 meet, and the reason the meeting has to happen HERE rather than across the
 * message boundary:
 *
 * `ProjectionDef` holds FUNCTIONS (`project`, `parse`), and functions cannot be
 * structured-cloned. Sending one would either throw `DataCloneError` or — with a
 * proxying library — call it back on the thread it came from, which is exactly
 * the thread FR-009 exists to keep free. So the worker imports the transforms
 * package DOWNWARD (layer 4 → layer 2) and resolves the projection by ID.
 * Nothing but serializable text crosses.
 *
 * The document arrives on its own channel and is kept per revision, so typing
 * sends TEXT only — never a fresh clone of the whole document per keystroke
 * (§3 w4, research trap 6).
 */

/** Everything the worker keeps between messages: one document, by revision. */
interface WorkerDocumentState {
  readonly baseRevision: number;
  readonly document: BuilderDocument;
}

let held: WorkerDocumentState | null = null;

/**
 * The registered block vocabulary the codec needs for `blockExists`. The worker
 * cannot reach the registry (it lives on the other thread and holds functions),
 * so the vocabulary travels as data with each document snapshot — a plain list
 * of type names, serializable by construction.
 */
let vocabulary: ReadonlySet<string> = new Set();

const portsFor = (): CodecPorts => ({
  blockExists: (type: string) => vocabulary.has(type),
});

/** A snapshot payload: the document plus the type names the codec may accept. */
interface DocumentPayload {
  readonly document: BuilderDocument;
  readonly blockTypes: readonly string[];
}

function protocolError(
  request: Pick<TransformRequest, 'baseRevision' | 'scope'>,
  code: string,
  message: string,
): TransformResult {
  return {
    kind: 'protocol-error',
    baseRevision: request.baseRevision,
    scope: request.scope,
    code,
    message,
  };
}

/**
 * Narrow codec patches onto the wire type, refusing anything unserializable.
 * Returns null when a value cannot cross, so the caller answers with an honest
 * protocol error instead of letting postMessage throw.
 */
function toWirePatches(patches: readonly Patch[]): readonly TransformPatch[] | null {
  const wire: TransformPatch[] = [];
  for (const patch of patches) {
    if (patch.value === undefined) {
      wire.push({ op: patch.op, path: patch.path });
      continue;
    }
    if (!isSerializableValue(patch.value)) {
      return null;
    }
    wire.push({ op: patch.op, path: patch.path, value: patch.value });
  }
  return wire;
}

function toResult(request: TransformRequest, parsed: ParseResult): TransformResult {
  if (parsed.ok) {
    const wire = toWirePatches(parsed.patches);
    if (wire === null) {
      return protocolError(
        request,
        'unserializable-patch',
        'The parse produced a patch value that cannot cross the worker boundary.',
      );
    }
    return {
      kind: 'parsed',
      ok: true,
      baseRevision: request.baseRevision,
      scope: request.scope,
      // The codec types a patch value as `unknown`; the wire type requires
      // JsonValue. That gap is not a typing nuisance — it IS the boundary, so
      // it is CHECKED, not asserted away. A value that could not be structured-
      // cloned would otherwise throw DataCloneError inside postMessage, killing
      // the worker and stranding every pending request (w6).
      patches: wire,
    };
  }
  return {
    kind: 'parsed',
    ok: false,
    baseRevision: request.baseRevision,
    scope: request.scope,
    errors: parsed.errors,
  };
}

const scopedNodeId = (scope: TransformScope): string | null =>
  scope.kind === 'node' ? scope.nodeId : null;

/**
 * Run one request against the held document. Exported for the unit suite: the
 * message plumbing is trivial, but THIS is where a stale revision, an unknown
 * projection, or a missing document must each become an honest error rather
 * than a thrown exception that kills the worker.
 */
export function handleRequest(request: TransformRequest): TransformResponse {
  const respond = (result: TransformResult): TransformResponse => ({
    requestId: request.requestId,
    generation: request.generation,
    result,
  });

  if (request.projectionId !== CANONICAL_JSON_PROJECTION_ID) {
    return respond(
      protocolError(
        request,
        'unknown-projection',
        `No projection "${request.projectionId}" is available in this worker.`,
      ),
    );
  }
  if (held === null) {
    return respond(
      protocolError(request, 'no-document', 'No document snapshot has been sent yet.'),
    );
  }
  if (held.baseRevision !== request.baseRevision) {
    // The caller's revision moved on; answering from a stale document would
    // produce patches against a document that no longer exists.
    return respond(
      protocolError(
        request,
        'stale-document',
        `Request targets revision ${String(request.baseRevision)} but the worker holds ${String(held.baseRevision)}.`,
      ),
    );
  }

  const document = held.document;
  const nodeId = scopedNodeId(request.scope);

  try {
    if (request.operation === 'project') {
      const projected =
        nodeId === null ? projectDocument(document) : projectScope(document, nodeId);
      return respond({
        kind: 'projected',
        baseRevision: request.baseRevision,
        scope: request.scope,
        text: projected.text,
      });
    }

    const text = request.payload ?? '';
    const parsed =
      nodeId === null
        ? parseDocument(text, document, portsFor())
        : parseScope(text, document, nodeId, portsFor());
    return respond(toResult(request, parsed));
  } catch (error) {
    // The codec is total by contract (§1 c2); if that law is ever broken, the
    // worker must still answer rather than die and strand every pending request.
    return respond(
      protocolError(
        request,
        'transform-failed',
        error instanceof Error ? error.message : 'The transform failed for an unknown reason.',
      ),
    );
  }
}

/** Install a document snapshot. Exported so the unit suite needs no real Worker. */
export function acceptDocument(baseRevision: number, payload: string): void {
  const snapshot = JSON.parse(payload) as DocumentPayload;
  held = { baseRevision, document: snapshot.document };
  vocabulary = new Set(snapshot.blockTypes);
}

/** Wire a message port to the two handlers above. */
export function attachTransformWorker(scope: {
  addEventListener: (type: 'message', listener: (event: MessageEvent) => void) => void;
  postMessage: (message: TransformResponse) => void;
}): void {
  scope.addEventListener('message', (event: MessageEvent) => {
    const message: unknown = event.data;
    if (!isTransformWorkerMessage(message)) {
      return; // not ours; a foreign message must never crash the worker
    }
    if ('kind' in message) {
      acceptDocument(message.baseRevision, message.payload);
      return;
    }
    scope.postMessage(handleRequest(message));
  });
}

// Module workers evaluate this file directly; in tests the module is imported
// and the two handlers are driven without any global side effect.
if (typeof self !== 'undefined' && 'postMessage' in self) {
  attachTransformWorker(self);
}
