/// <reference lib="webworker" />
import type { BuilderDocument, BuilderSite, Patch } from '@craftkit/builder-schema';
import {
  CANONICAL_JSON_PROJECTION_ID,
  SITE_MANIFEST_PROJECTION_ID,
  parseDocument,
  parseScope,
  parseSiteManifest,
  parseSitePage,
  projectDocument,
  projectScope,
  projectSiteManifest,
  projectSitePage,
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

/**
 * Everything the worker keeps between messages: ONE base artifact, by revision.
 *
 * A document or a site, never both. The site arrives on the same channel the
 * document always used — a base artifact is a base artifact — because giving
 * the site its own channel would mean two revision counters and therefore two
 * ways for the worker to be stale, one of which nothing would be checking.
 */
type HeldBase =
  | { readonly kind: 'document'; readonly baseRevision: number; readonly document: BuilderDocument }
  | { readonly kind: 'site'; readonly baseRevision: number; readonly site: BuilderSite };

let held: HeldBase | null = null;

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

/** A snapshot payload: one base artifact plus the type names the codec may accept. */
interface BasePayload {
  readonly document?: BuilderDocument;
  readonly site?: BuilderSite;
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
 * The projection a scope is entitled to ask for.
 *
 * A site's manifest and a document's canonical JSON are different projections
 * with different parsers, so the id is checked AGAINST THE SCOPE rather than
 * against a single constant. Accepting either id for either scope would let a
 * mismatched pane parse a manifest as a document and report a page's worth of
 * nonsense errors.
 */
const projectionFor = (scope: TransformScope): string =>
  scope.kind === 'site' ? SITE_MANIFEST_PROJECTION_ID : CANONICAL_JSON_PROJECTION_ID;

const projected = (request: TransformRequest, text: string): TransformResult => ({
  kind: 'projected',
  baseRevision: request.baseRevision,
  scope: request.scope,
  text,
});

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

  if (request.projectionId !== projectionFor(request.scope)) {
    return respond(
      protocolError(
        request,
        'unknown-projection',
        `No projection "${request.projectionId}" is available for a ${request.scope.kind} scope in this worker.`,
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

  const scope = request.scope;
  const text = request.payload ?? '';
  const wantsSite = scope.kind === 'site' || scope.kind === 'page';
  if (wantsSite !== (held.kind === 'site')) {
    /*
      The worker answers about the artifact it HOLDS. A site scope against a
      document snapshot is not a recoverable near-miss — there is no site to
      read — and inventing one from the document would answer a question nobody
      asked with patches rooted in the wrong place.
    */
    return respond(
      protocolError(
        request,
        'scope-mismatch',
        `This worker holds a ${held.kind}; a ${scope.kind} scope needs a ${wantsSite ? 'site' : 'document'} snapshot.`,
      ),
    );
  }

  try {
    if (held.kind === 'site') {
      const site = held.site;
      if (scope.kind === 'site') {
        return respond(
          request.operation === 'project'
            ? projected(request, projectSiteManifest(site).text)
            : toResult(request, parseSiteManifest(text, site)),
        );
      }
      const pageId = scope.kind === 'page' ? scope.pageId : '';
      if (request.operation === 'project') {
        const projection = projectSitePage(site, pageId);
        return respond(
          projection === undefined
            ? protocolError(request, 'unknown-page', `This site has no page "${pageId}".`)
            : projected(request, projection.text),
        );
      }
      return respond(toResult(request, parseSitePage(text, site, pageId, portsFor())));
    }

    const document = held.document;
    const nodeId = scopedNodeId(scope);
    if (request.operation === 'project') {
      const projection =
        nodeId === null ? projectDocument(document) : projectScope(document, nodeId);
      return respond(projected(request, projection.text));
    }
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

/** Install a base-artifact snapshot. Exported so the unit suite needs no real Worker. */
export function acceptDocument(baseRevision: number, payload: string): void {
  const snapshot = JSON.parse(payload) as BasePayload;
  if (snapshot.site !== undefined) {
    held = { kind: 'site', baseRevision, site: snapshot.site };
  } else if (snapshot.document !== undefined) {
    held = { kind: 'document', baseRevision, document: snapshot.document };
  } else {
    /*
      A payload carrying neither leaves the worker holding NOTHING, so the next
      request answers `no-document`. Keeping the previous snapshot would be
      worse: it would answer confidently about an artifact the host has already
      replaced.
    */
    held = null;
  }
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
