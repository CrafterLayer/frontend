/**
 * Element handles (agent-script DESIGN §A.5): the opaque ids a script's
 * elements carry, and the host-only resolution behind each one.
 *
 * The model never builds an id. `ck.find()` hands it elements whose `id` is
 * one of three forms, and a write names the element by that id:
 *
 *   s|<page>|<node>                      a top-level section
 *   t|<page>|<node>|<formatPath(path)>   an element of a customCode tree
 *   p|<page>|<node>|<part>|<index>       a part of a registered block
 *                                        (index '' when not repeated, '2', '1.0' nested)
 *
 * Segments are percent-escaped for `|` and `%`, so a page or node id that
 * contains a bar still round-trips. The tree path is written exactly the way
 * `element.*` writes it (`formatPath`, `[0,2]`) and read back with
 * `parsePath`, so the index and the style tools address one element the same way.
 */

import { formatPath, parsePath, type TreePath } from '../style-tools/address';
import type { ScriptElementKind } from './types';

export type HandleType = 'section' | 'tree' | 'part';

/** What a script element id stands for, on the host side only. */
export interface Handle {
  readonly type: HandleType;
  readonly pageId: string;
  readonly nodeId: string;
  /**
   * Tree elements: the element's path from the region root. Sections: the
   * path of the region's top element (a customCode section), so a section
   * style lands on its `<section>`.
   */
  readonly path?: TreePath;
  /** Parts: the declared part name. Registered-block sections: the block's root box part, when it has one. */
  readonly part?: string;
  /** Parts: one index per `*` level of the bind (empty when the part is not repeated). */
  readonly index?: readonly number[];
  /**
   * Tree elements: the deepest single text-bearing descendant (the element
   * itself when it holds the only text). Undefined for mixed content.
   */
  readonly textPath?: TreePath;
  /** Item parts: the one text sub-part `set({text})` writes (undefined when the item has several). */
  readonly textPart?: string;
  /** The top-level section the element sits in (for repair hints). */
  readonly sectionId?: string;
  /** The element's script kind, so a write can say why it does not fit (an image has no text). */
  readonly kind?: ScriptElementKind;
}

const SEPARATOR = '|';

function escapeSegment(value: string): string {
  return value.replace(/%/gu, '%25').replace(/\|/gu, '%7C');
}

function unescapeSegment(value: string): string {
  return value.replace(/%7C/giu, '|').replace(/%25/gu, '%');
}

export function sectionHandleId(pageId: string, nodeId: string): string {
  return ['s', escapeSegment(pageId), escapeSegment(nodeId)].join(SEPARATOR);
}

export function treeHandleId(pageId: string, nodeId: string, path: TreePath): string {
  return ['t', escapeSegment(pageId), escapeSegment(nodeId), formatPath(path)].join(SEPARATOR);
}

export function partHandleId(pageId: string, nodeId: string, part: string, index: readonly number[]): string {
  return ['p', escapeSegment(pageId), escapeSegment(nodeId), escapeSegment(part), index.join('.')].join(SEPARATOR);
}

/** The address an id spells, without the index's extras (textPath, sectionId); undefined when it is not an id. */
export function parseHandleId(id: string): Handle | undefined {
  const segments = id.split(SEPARATOR);
  const [type, page, node] = segments;
  if (page === undefined || node === undefined || page === '' || node === '') return undefined;
  const pageId = unescapeSegment(page);
  const nodeId = unescapeSegment(node);
  if (type === 's' && segments.length === 3) return { type: 'section', pageId, nodeId };
  if (type === 't' && segments.length === 4) {
    let raw: unknown;
    try {
      raw = JSON.parse(segments[3] ?? '');
    } catch {
      return undefined;
    }
    const path = parsePath(raw, 'path');
    return path.ok ? { type: 'tree', pageId, nodeId, path: path.value } : undefined;
  }
  if (type === 'p' && segments.length === 5) {
    const part = unescapeSegment(segments[3] ?? '');
    const indexText = segments[4] ?? '';
    if (part === '') return undefined;
    const index = indexText === '' ? [] : indexText.split('.').map(Number);
    if (index.some((entry) => !Number.isInteger(entry) || entry < 0)) return undefined;
    return { type: 'part', pageId, nodeId, part, index };
  }
  return undefined;
}
