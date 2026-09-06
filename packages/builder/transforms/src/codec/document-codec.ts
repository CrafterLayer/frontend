import {
  canonicalizeJsonValue,
  isJsonValue,
  validateDocument,
  type Breakpoint,
  type BuilderDocument,
  type JsonValue,
  type Node,
  type NodeId,
  type Patch,
} from '@craftkit/builder-schema';

import { canonicalJson } from './canonical-json';
import { scopedProjection, SCOPED_ENVELOPE_VERSION } from './scope';
import { strictParse, type ParseError, type ParsedJson } from './strict-parse';

export interface ProjectionText {
  text: string;
}

/**
 * The id this codec registers under. It lives HERE because the worker resolves
 * projections by id locally (011 §3 w1) and the extension registers the same
 * id with the kernel — one constant, so the two halves cannot drift apart.
 */
export const CANONICAL_JSON_PROJECTION_ID = 'canonical-json';

export interface CodecPorts {
  /** Registry-backed lookup; the transforms layer never owns a registry. */
  blockExists: (type: string) => boolean;
}

export type ParseResult = { ok: true; patches: Patch[] } | { ok: false; errors: ParseError[] };

/**
 * Text in, a validated candidate document out — no base, and therefore no diff.
 *
 * `parseDocument` is this read followed by `documentPatches`. The two halves are
 * separated because a SITE needs the document itself before it can diff: a page
 * is only valid in the context of the site around it (its direction must match,
 * its asset references must resolve), and those checks need every page's
 * candidate document at once, not one page's patches.
 */
export type DocumentReadResult =
  | { ok: true; document: BuilderDocument }
  | { ok: false; errors: ParseError[] };

type Path = readonly (string | number)[];

interface ShapeContext {
  parsed: ParsedJson;
  errors: ParseError[];
}

const DOCUMENT_FIELDS = new Set(['schemaVersion', 'surface', 'dir', 'rootId', 'nodes']);
const NODE_FIELDS = new Set([
  'id',
  'type',
  'props',
  'bindings',
  'variantOf',
  'responsive',
  'slots',
]);
const ENVELOPE_FIELDS = new Set(['envelope', 'rootId', 'nodes']);

const hasOwn = (record: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isJsonObject = (value: unknown): value is Record<string, JsonValue> => {
  if (!isRecord(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return (
    (prototype === Object.prototype || prototype === null) &&
    Object.values(value).every((entry) => isJsonValue(entry))
  );
};

const emptyRecord = <T>(): Record<string, T> => {
  const record: Record<string, T> = {};
  Object.setPrototypeOf(record, null);
  return record;
};

const defineOwn = <T>(record: Record<string, T>, key: string, value: T): void => {
  Object.defineProperty(record, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
};

const addError = (context: ShapeContext, path: Path, message: string): void => {
  context.errors.push({ line: context.parsed.lineAt(path), message });
};

const ownValue = (record: Record<string, unknown>, key: string): unknown =>
  hasOwn(record, key) ? record[key] : undefined;

export function projectDocument(doc: BuilderDocument): ProjectionText {
  return { text: canonicalJson(doc) };
}

export function projectScope(doc: BuilderDocument, nodeId: NodeId): ProjectionText {
  return { text: canonicalJson(scopedProjection(doc, nodeId)) };
}

export function readDocumentText(text: string, ports: CodecPorts): DocumentReadResult {
  try {
    const strict = strictParse(text);
    if (!strict.ok) {
      return strict;
    }

    const context: ShapeContext = { parsed: strict.parsed, errors: [] };
    const candidate = readDocument(strict.parsed.value, context);
    if (candidate === undefined) {
      return { ok: false, errors: context.errors };
    }

    validateCandidate(candidate, ports, context);
    if (context.errors.length > 0) {
      return { ok: false, errors: context.errors };
    }
    return { ok: true, document: candidate };
  } catch {
    return { ok: false, errors: [{ line: 1, message: 'The document text could not be read.' }] };
  }
}

export function parseDocument(text: string, base: BuilderDocument, ports: CodecPorts): ParseResult {
  const read = readDocumentText(text, ports);
  return read.ok
    ? { ok: true, patches: documentPatches(base, read.document) }
    : { ok: false, errors: read.errors };
}

export function parseScope(
  text: string,
  base: BuilderDocument,
  nodeId: NodeId,
  ports: CodecPorts,
): ParseResult {
  try {
    const strict = strictParse(text);
    if (!strict.ok) {
      return strict;
    }

    const context: ShapeContext = { parsed: strict.parsed, errors: [] };
    const envelope = readEnvelope(strict.parsed.value, context);
    if (envelope === undefined) {
      return { ok: false, errors: context.errors };
    }
    if (envelope.rootId !== nodeId) {
      addError(
        context,
        ['rootId'],
        `Scoped root "${envelope.rootId}" does not match the selected node "${nodeId}".`,
      );
    }

    const previous = scopedProjection(base, nodeId);
    if (!hasOwn(previous.nodes, nodeId)) {
      addError(
        context,
        ['rootId'],
        `Selected node "${nodeId}" does not exist in the base document.`,
      );
    }

    const candidate: BuilderDocument = {
      schemaVersion: base.schemaVersion,
      surface: base.surface,
      dir: base.dir,
      rootId: envelope.rootId,
      nodes: envelope.nodes,
    };
    validateCandidate(candidate, ports, context);
    validateScopeCollisions(base, previous.nodes, envelope.nodes, context);

    if (context.errors.length > 0) {
      return { ok: false, errors: context.errors };
    }
    return { ok: true, patches: scopePatches(previous.nodes, envelope.nodes) };
  } catch {
    return { ok: false, errors: [{ line: 1, message: 'The scoped text could not be read.' }] };
  }
}

function readDocument(value: unknown, context: ShapeContext): BuilderDocument | undefined {
  if (!isRecord(value)) {
    addError(context, [], 'A builder document must be a JSON object.');
    return undefined;
  }
  reportUnknownFields(value, DOCUMENT_FIELDS, [], context);
  const startErrors = context.errors.length;

  const schemaVersion = readRequiredFiniteNumber(value, 'schemaVersion', [], context);
  const surface = readRequiredString(value, 'surface', [], context);
  const dir = readDirection(value, [], context);
  const rootId = readRequiredString(value, 'rootId', [], context);
  const nodes = readNodeMap(ownValue(value, 'nodes'), ['nodes'], context, hasOwn(value, 'nodes'));

  if (
    context.errors.length !== startErrors ||
    schemaVersion === undefined ||
    surface === undefined ||
    dir === undefined ||
    rootId === undefined ||
    nodes === undefined
  ) {
    return undefined;
  }
  return {
    schemaVersion: Object.is(schemaVersion, -0) ? 0 : schemaVersion,
    surface,
    dir,
    rootId,
    nodes,
  };
}

interface ReadEnvelope {
  rootId: NodeId;
  nodes: Record<NodeId, Node>;
}

function readEnvelope(value: unknown, context: ShapeContext): ReadEnvelope | undefined {
  if (!isRecord(value)) {
    addError(context, [], 'A scoped projection must be a JSON object.');
    return undefined;
  }
  reportUnknownFields(value, ENVELOPE_FIELDS, [], context);
  const startErrors = context.errors.length;

  const version = readRequiredFiniteNumber(value, 'envelope', [], context);
  if (version !== undefined && version !== SCOPED_ENVELOPE_VERSION) {
    addError(
      context,
      ['envelope'],
      `Unsupported scoped envelope version ${String(version)}; expected ${String(SCOPED_ENVELOPE_VERSION)}.`,
    );
  }
  const rootId = readRequiredString(value, 'rootId', [], context);
  const nodes = readNodeMap(ownValue(value, 'nodes'), ['nodes'], context, hasOwn(value, 'nodes'));

  if (
    context.errors.length !== startErrors ||
    version !== SCOPED_ENVELOPE_VERSION ||
    rootId === undefined ||
    nodes === undefined
  ) {
    return undefined;
  }
  return { rootId, nodes };
}

function readNodeMap(
  value: unknown,
  path: Path,
  context: ShapeContext,
  present: boolean,
): Record<NodeId, Node> | undefined {
  if (!present) {
    addError(context, path.slice(0, -1), 'Missing required field "nodes".');
    return undefined;
  }
  if (!isRecord(value)) {
    addError(context, path, 'Field "nodes" must be a JSON object keyed by node id.');
    return undefined;
  }

  const startErrors = context.errors.length;
  const nodes = emptyRecord<Node>();
  for (const key of Object.keys(value)) {
    const node = readNode(value[key], [...path, key], context);
    if (node === undefined) {
      continue;
    }
    if (node.id !== key) {
      addError(
        context,
        [...path, key, 'id'],
        `Node stored under key "${key}" carries id "${node.id}"; keys and ids must match.`,
      );
      continue;
    }
    defineOwn(nodes, key, node);
  }
  return context.errors.length === startErrors ? nodes : undefined;
}

function readNode(value: unknown, path: Path, context: ShapeContext): Node | undefined {
  if (!isRecord(value)) {
    addError(context, path, 'Each node-map value must be a JSON object.');
    return undefined;
  }
  reportUnknownFields(value, NODE_FIELDS, path, context);
  const startErrors = context.errors.length;

  const id = readRequiredString(value, 'id', path, context);
  const type = readRequiredString(value, 'type', path, context);
  const props = readRequiredJsonObject(value, 'props', path, context);
  const bindings = readOptionalBindings(value, path, context);
  const variantOf = readOptionalString(value, 'variantOf', path, context);
  const responsive = readOptionalResponsive(value, path, context);
  const slots = readOptionalSlots(value, path, context);

  if (
    context.errors.length !== startErrors ||
    id === undefined ||
    type === undefined ||
    props === undefined
  ) {
    return undefined;
  }

  const node: Node = { id, type, props };
  if (bindings !== undefined) node.bindings = bindings;
  if (variantOf !== undefined) node.variantOf = variantOf;
  if (responsive !== undefined) node.responsive = responsive;
  if (slots !== undefined) node.slots = slots;
  return node;
}

function readRequiredString(
  record: Record<string, unknown>,
  key: string,
  path: Path,
  context: ShapeContext,
): string | undefined {
  if (!hasOwn(record, key)) {
    addError(context, path, `Missing required field "${key}".`);
    return undefined;
  }
  const value = record[key];
  if (typeof value !== 'string') {
    addError(context, [...path, key], `Field "${key}" must be a string.`);
    return undefined;
  }
  return value;
}

function readOptionalString(
  record: Record<string, unknown>,
  key: string,
  path: Path,
  context: ShapeContext,
): string | undefined {
  if (!hasOwn(record, key)) {
    return undefined;
  }
  const value = record[key];
  if (typeof value !== 'string') {
    addError(context, [...path, key], `Optional field "${key}" must be a string when present.`);
    return undefined;
  }
  return value;
}

function readRequiredFiniteNumber(
  record: Record<string, unknown>,
  key: string,
  path: Path,
  context: ShapeContext,
): number | undefined {
  if (!hasOwn(record, key)) {
    addError(context, path, `Missing required field "${key}".`);
    return undefined;
  }
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    addError(context, [...path, key], `Field "${key}" must be a finite number.`);
    return undefined;
  }
  return value;
}

function readDirection(
  record: Record<string, unknown>,
  path: Path,
  context: ShapeContext,
): BuilderDocument['dir'] | undefined {
  if (!hasOwn(record, 'dir')) {
    addError(context, path, 'Missing required field "dir".');
    return undefined;
  }
  const value = record['dir'];
  if (value !== 'ltr' && value !== 'rtl') {
    addError(context, [...path, 'dir'], 'Field "dir" must be either "ltr" or "rtl".');
    return undefined;
  }
  return value;
}

function readRequiredJsonObject(
  record: Record<string, unknown>,
  key: string,
  path: Path,
  context: ShapeContext,
): Record<string, JsonValue> | undefined {
  if (!hasOwn(record, key)) {
    addError(context, path, `Missing required field "${key}".`);
    return undefined;
  }
  const value = record[key];
  if (!isJsonObject(value)) {
    addError(context, [...path, key], `Field "${key}" must contain only finite JSON values.`);
    return undefined;
  }
  return canonicalizeJsonValue(value);
}

function readOptionalBindings(
  record: Record<string, unknown>,
  path: Path,
  context: ShapeContext,
): Record<string, string> | undefined {
  if (!hasOwn(record, 'bindings')) {
    return undefined;
  }
  const value = record['bindings'];
  if (!isRecord(value)) {
    addError(context, [...path, 'bindings'], 'Optional field "bindings" must be an object.');
    return undefined;
  }

  const startErrors = context.errors.length;
  const bindings = emptyRecord<string>();
  for (const key of Object.keys(value)) {
    const dataPath = value[key];
    if (typeof dataPath !== 'string') {
      addError(context, [...path, 'bindings', key], `Binding "${key}" must be a string.`);
    } else {
      defineOwn(bindings, key, dataPath);
    }
  }
  return context.errors.length === startErrors ? bindings : undefined;
}

function readOptionalResponsive(
  record: Record<string, unknown>,
  path: Path,
  context: ShapeContext,
): Partial<Record<Breakpoint, Record<string, JsonValue>>> | undefined {
  if (!hasOwn(record, 'responsive')) {
    return undefined;
  }
  const value = record['responsive'];
  if (!isRecord(value)) {
    addError(context, [...path, 'responsive'], 'Optional field "responsive" must be an object.');
    return undefined;
  }

  const startErrors = context.errors.length;
  const responsive: Partial<Record<Breakpoint, Record<string, JsonValue>>> = {};
  for (const key of Object.keys(value)) {
    if (key !== 'mobile' && key !== 'tablet') {
      addError(context, [...path, 'responsive', key], `Unknown breakpoint "${key}".`);
      continue;
    }
    const override = value[key];
    if (!isJsonObject(override)) {
      addError(
        context,
        [...path, 'responsive', key],
        `Breakpoint "${key}" must contain only finite JSON values.`,
      );
      continue;
    }
    responsive[key] = canonicalizeJsonValue(override);
  }
  return context.errors.length === startErrors ? responsive : undefined;
}

function readOptionalSlots(
  record: Record<string, unknown>,
  path: Path,
  context: ShapeContext,
): Record<string, NodeId[]> | undefined {
  if (!hasOwn(record, 'slots')) {
    return undefined;
  }
  const value = record['slots'];
  if (!isRecord(value)) {
    addError(context, [...path, 'slots'], 'Optional field "slots" must be an object.');
    return undefined;
  }

  const startErrors = context.errors.length;
  const slots = emptyRecord<NodeId[]>();
  for (const key of Object.keys(value)) {
    const children = value[key];
    if (!Array.isArray(children)) {
      addError(context, [...path, 'slots', key], `Slot "${key}" must be an array of node ids.`);
      continue;
    }
    const ids: NodeId[] = [];
    children.forEach((childId, index) => {
      if (typeof childId !== 'string') {
        addError(
          context,
          [...path, 'slots', key, index],
          `Every entry in slot "${key}" must be a node id string.`,
        );
      } else {
        ids.push(childId);
      }
    });
    defineOwn(slots, key, ids);
  }
  return context.errors.length === startErrors ? slots : undefined;
}

function reportUnknownFields(
  record: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: Path,
  context: ShapeContext,
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      addError(context, [...path, key], `Field "${key}" has no textual document representation.`);
    }
  }
}

function validateCandidate(
  candidate: BuilderDocument,
  ports: CodecPorts,
  context: ShapeContext,
): void {
  try {
    for (const error of validateDocument(candidate)) {
      // Identity is owned by `readNodeMap`, where the source line is exact. Do
      // not let the structural validator mask whether that dedicated guard is
      // alive during the required mutation check.
      if (error.code === 'doc/id-mismatch') {
        continue;
      }
      addError(context, error.path ?? [], error.message);
    }
  } catch {
    addError(context, [], 'The document could not be structurally validated.');
  }

  for (const key of Object.keys(candidate.nodes)) {
    const node = candidate.nodes[key];
    if (node === undefined) {
      continue;
    }
    let exists: boolean;
    try {
      exists = ports.blockExists(node.type);
    } catch {
      addError(context, ['nodes', key, 'type'], `Block type lookup failed for "${node.type}".`);
      continue;
    }
    if (!exists) {
      addError(
        context,
        ['nodes', key, 'type'],
        `Node "${key}" uses unregistered block type "${node.type}".`,
      );
    }
  }
}

function validateScopeCollisions(
  base: BuilderDocument,
  previous: Record<NodeId, Node>,
  candidate: Record<NodeId, Node>,
  context: ShapeContext,
): void {
  for (const id of Object.keys(candidate)) {
    if (!hasOwn(previous, id) && hasOwn(base.nodes, id)) {
      addError(
        context,
        ['nodes', id],
        `Scoped node id "${id}" already belongs to content outside the selected subtree.`,
      );
    }
  }
}

export function documentPatches(base: BuilderDocument, candidate: BuilderDocument): Patch[] {
  // NODE-GRANULAR, never a root replace. A whole-document replace patch would
  // satisfy the non-vacuous property gate (applying it does yield `edited`) —
  // which is exactly why the browser road caught what the property road could
  // not: it clones the world into every transaction, and the kernel's
  // `applyPatches` door refuses empty paths by design. History must store what
  // CHANGED, at the same granularity the scoped path already uses.
  const patches: Patch[] = scopePatches(base.nodes, candidate.nodes);
  for (const field of ['schemaVersion', 'surface', 'dir', 'rootId'] as const) {
    if (canonicalJson(base[field]) !== canonicalJson(candidate[field])) {
      patches.push({ op: 'replace', path: [field], value: candidate[field] });
    }
  }
  return patches;
}

function scopePatches(previous: Record<NodeId, Node>, candidate: Record<NodeId, Node>): Patch[] {
  const patches: Patch[] = [];

  for (const id of Object.keys(candidate).sort()) {
    const next = candidate[id];
    if (next === undefined) {
      continue;
    }
    const current = hasOwn(previous, id) ? previous[id] : undefined;
    if (current === undefined) {
      patches.push(...nodeWritePatches('add', id, next));
    } else if (canonicalJson(current) !== canonicalJson(next)) {
      patches.push(...nodeWritePatches('replace', id, next));
    }
  }
  for (const id of Object.keys(previous).sort()) {
    if (!hasOwn(candidate, id)) {
      patches.push({ op: 'remove', path: ['nodes', id] });
    }
  }
  return patches;
}

/**
 * The dispatch door validates every patch value as one Law-J root. Most nodes
 * fit that envelope and stay node-granular. A node containing a prop at the
 * exact JSON limit does not: the node/props wrappers would make the patch value
 * look too deep even though the stored prop itself is valid. For that boundary
 * only, write a shallow node shell and then each stored JSON value at its real
 * document path. The kernel validates the completed document atomically.
 */
function nodeWritePatches(op: 'add' | 'replace', id: NodeId, node: Node): Patch[] {
  if (isJsonValue(node)) {
    return [{ op, path: ['nodes', id], value: node }];
  }

  const path = ['nodes', id] as const;
  const patches: Patch[] = [
    { op, path: [...path], value: { id: node.id, type: node.type, props: {} } },
  ];

  for (const key of Object.keys(node.props).sort()) {
    const value = node.props[key];
    if (value !== undefined) {
      patches.push({ op: 'add', path: [...path, 'props', key], value });
    }
  }
  if (node.bindings !== undefined) {
    patches.push({ op: 'add', path: [...path, 'bindings'], value: node.bindings });
  }
  if (node.variantOf !== undefined) {
    patches.push({ op: 'add', path: [...path, 'variantOf'], value: node.variantOf });
  }
  if (node.responsive !== undefined) {
    patches.push({ op: 'add', path: [...path, 'responsive'], value: {} });
    for (const breakpoint of ['tablet', 'mobile'] as const) {
      const override = node.responsive[breakpoint];
      if (override === undefined) {
        continue;
      }
      patches.push({ op: 'add', path: [...path, 'responsive', breakpoint], value: {} });
      for (const key of Object.keys(override).sort()) {
        const value = override[key];
        if (value !== undefined) {
          patches.push({
            op: 'add',
            path: [...path, 'responsive', breakpoint, key],
            value,
          });
        }
      }
    }
  }
  if (node.slots !== undefined) {
    patches.push({ op: 'add', path: [...path, 'slots'], value: node.slots });
  }
  return patches;
}
