import {
  customCodeTreeSchema,
  type CustomCodeNode,
  type CustomCodeRoot,
} from '@craftkit/builder-schema';

/*
  ── The tree-node payload (style-manager DESIGN.md §E, Copy/paste + Library) ─

  One codec for every way an element travels: the Library panel's drag, the
  canvas drop, and Mod+C / Mod+V through the system clipboard. The wire form is
  JSON text, `{"craftkit":"tree-node","v":1,"node":…,"css"?:…}`, so it survives
  `navigator.clipboard.writeText`, a DataTransfer string item and a paste into
  another tab alike.

  `parse` is a DOOR, not a cast: clipboard text is untrusted (anyone can put
  anything there), so the node must pass the same tree validator the kernel
  uses before a caller can even build an `insertTreeNode` from it. The kernel
  validates again on insert, where the parent is known — this first check
  only keeps junk from reaching a preview. The check runs with the node at a
  tree root, so a node that only means something inside one parent (a
  `<source>`, an svg shape) does not travel alone: copy its parent instead.
*/

/** The DataTransfer / clipboard media type the payload travels under. */
export const ELEMENT_PAYLOAD_MIME = 'application/x-craftkit-tree-node+json';

export const ELEMENT_PAYLOAD_VERSION = 1;

/** Region CSS travelling with a node; the region css cap (DESIGN §D.1). */
export const ELEMENT_PAYLOAD_CSS_MAX = 24_000;

export interface ElementPayload {
  readonly craftkit: 'tree-node';
  readonly v: 1;
  readonly node: CustomCodeNode;
  /** The source region's `ck-` rules the node's hook classes need, when any. */
  readonly css?: string;
}

/** Build a payload from a node (and optional region CSS); the node is deep-copied. */
export function elementPayload(node: CustomCodeNode, css?: string): ElementPayload {
  const copy = JSON.parse(JSON.stringify(node)) as CustomCodeNode;
  return css === undefined || css.trim() === ''
    ? { craftkit: 'tree-node', v: ELEMENT_PAYLOAD_VERSION, node: copy }
    : { craftkit: 'tree-node', v: ELEMENT_PAYLOAD_VERSION, node: copy, css };
}

/** The wire text for a payload. */
export function serializeElementPayload(payload: ElementPayload): string {
  return JSON.stringify(payload);
}

/**
 * Read a payload from wire text, or `undefined` for anything that is not one
 * — plain text, another app's JSON, a newer version, or a node the tree door
 * refuses.
 */
export function parseElementPayload(text: string): ElementPayload | undefined {
  if (!text.trimStart().startsWith('{')) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  return elementPayloadFromValue(value);
}

/** The same door over an already-parsed value. */
export function elementPayloadFromValue(value: unknown): ElementPayload | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (record['craftkit'] !== 'tree-node' || record['v'] !== ELEMENT_PAYLOAD_VERSION) return undefined;
  const allowed = new Set(['craftkit', 'v', 'node', 'css']);
  if (Object.keys(record).some((key) => !allowed.has(key))) return undefined;
  const css = record['css'];
  if (css !== undefined && (typeof css !== 'string' || css.length > ELEMENT_PAYLOAD_CSS_MAX)) {
    return undefined;
  }
  const probe: CustomCodeRoot = { kind: 'root', children: [record['node'] as CustomCodeNode] };
  const parsed = customCodeTreeSchema.safeParse(probe);
  const node = parsed.success ? parsed.data.children[0] : undefined;
  if (node === undefined) return undefined;
  return elementPayload(node, typeof css === 'string' ? css : undefined);
}
