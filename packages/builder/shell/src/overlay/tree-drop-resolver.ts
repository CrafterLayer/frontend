import type { BuilderKernel, GroupStep } from '@craftkit/builder-core';
import {
  customCodeNodeAtPath,
  customCodeTagAccepts,
  formatCustomCodePath,
  isCustomCodeSvgTag,
  parseCustomCodePath,
  type CustomCodeNode,
  type CustomCodePath,
  type CustomCodeRoot,
  type NodeId,
} from '@craftkit/builder-schema';

import { asCustomCodeRoot, customCodeTreeKey } from '../custom-code/element-at';
import type { DragPayload } from './drop-resolver';

/*
  ── Dropping into a custom-code tree (style-manager DESIGN.md §E, P7) ────────

  The block drop resolver knows slots; a tree has none — its containers are
  ELEMENTS addressed by `data-ck-path` inside a `[data-ck-custom-code]` region.
  This resolver reads what is under the pointer on the canvas and answers
  "parent path + index" for an element payload (P2's tree-node payload from the
  Library panel, or an element being moved), RTL-aware:

  - the axis comes from the container's own layout: a flex row lays children
    along the INLINE axis (mirrored under RTL, and again for row-reverse);
    everything else stacks along the block axis;
  - the three-band rule of the block resolver holds: the middle of a
    container prefers INTO, its outer quarters prefer the gap beside it;
  - a move never lands inside itself, and a same-parent move reports its
    index in post-removal terms (the moveTreeNode convention).

  Commit is ONE labelled transaction: `insertTreeNode` or `moveTreeNode`.
*/

export type TreeDragPayload =
  | { readonly kind: 'tree-move'; readonly id: NodeId; readonly path: CustomCodePath }
  | {
      readonly kind: 'tree-insert'; readonly node: CustomCodeNode; readonly label: string;
      readonly onDrop?: ((target: TreeDropTarget) => void) | undefined;
      readonly fallback?: Extract<DragPayload, { kind: 'insert' }> | undefined;
    };

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface TreeDropTarget {
  readonly kind: 'tree';
  readonly regionId: NodeId;
  /** The container's path (`[]` is the tree root). */
  readonly parent: CustomCodePath;
  /** Insertion index — post-removal terms for a same-parent move. */
  readonly index: number;
  /** Where the insertion line is drawn (layer-local). */
  readonly indicatorRect: Box;
  /** The receiving container's box, for the soft highlight and alignment guides. */
  readonly parentRect: Box | undefined;
  /** The siblings' boxes in the receiving container, for edge alignment guides. */
  readonly siblingRects: readonly Box[];
}

export interface LayoutAxis { readonly axis: 'block' | 'inline'; readonly reverse: boolean }

export interface TreeDropPorts {
  hitTest(doc: Document, x: number, y: number): Element | null;
  measure(element: HTMLElement): Box;
  /** How a container lays out its children. */
  axisOf(element: HTMLElement): LayoutAxis;
}

export function systemTreeDropPorts(): TreeDropPorts {
  return {
    hitTest: (doc, x, y) => doc.elementFromPoint(x, y),
    measure: (element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    },
    axisOf: (element) => {
      const view = element.ownerDocument.defaultView;
      const style = view?.getComputedStyle(element);
      const display = style?.display ?? '';
      const direction = style?.flexDirection ?? '';
      if (display.includes('flex') && direction.startsWith('row')) {
        return { axis: 'inline', reverse: direction === 'row-reverse' };
      }
      if (display.includes('flex') && direction === 'column-reverse') {
        return { axis: 'block', reverse: true };
      }
      if (display.includes('grid') && (style?.gridAutoFlow ?? '').startsWith('column')) {
        return { axis: 'block', reverse: false };
      }
      if (display.includes('grid')) return { axis: 'inline', reverse: false };
      return { axis: 'block', reverse: false };
    },
  };
}

const NO_CHILDREN_TAGS = new Set([
  'img',
  'input',
  'hr',
  'br',
  'video',
  'audio',
  'iframe',
  'source',
  'track',
  'textarea',
  'select',
  'option',
  'wbr',
  'col',
]);

/** Whether a node can receive children on the canvas. */
export function canHoldChildren(node: CustomCodeNode): boolean {
  if (node.kind !== 'element') return false;
  if (NO_CHILDREN_TAGS.has(node.tag)) return false;
  // A leaf that shows its own text is text, not a box to drop into.
  const text = node.text?.trim() ?? '';
  return text === '' || (node.children?.length ?? 0) > 0;
}

function treeOf(kernel: BuilderKernel, regionId: NodeId): CustomCodeRoot | undefined {
  const node = kernel.getDocument().nodes[regionId];
  if (node === undefined) return undefined;
  const key = customCodeTreeKey(kernel, node.type);
  return key === undefined ? undefined : asCustomCodeRoot(node.props[key]);
}

function childrenAt(tree: CustomCodeRoot, path: CustomCodePath): readonly CustomCodeNode[] {
  if (path.length === 0) return tree.children;
  const node = customCodeNodeAtPath(tree, path);
  return node === undefined || node.kind === 'icon' ? [] : (node.children ?? []);
}

/**
 * The tag a dropped node stands as for the content model: an icon is phrasing
 * (it draws an inline svg), a component renders a block of its own.
 */
function payloadTag(node: CustomCodeNode | undefined): string | undefined {
  if (node === undefined) return undefined;
  if (node.kind === 'element') return node.tag;
  return node.kind === 'icon' ? 'span' : 'div';
}

/**
 * Whether the container at `parent` may receive a node standing as `tag`, by
 * the door's HTML content model: the container itself, then every element
 * ancestor up to the nearest component or drawing (a heading dropped on a
 * link inside a paragraph is still inside the paragraph).
 */
export function treeParentAccepts(
  tree: CustomCodeRoot,
  parent: CustomCodePath,
  tag: string | undefined,
): boolean {
  if (tag === undefined) return true;
  for (let depth = parent.length; depth > 0; depth -= 1) {
    const node = customCodeNodeAtPath(tree, parent.slice(0, depth));
    if (node?.kind !== 'element') return true;
    if (!customCodeTagAccepts(node.tag, tag)) return false;
    // Inside a drawing only the drawing's own rule applies.
    if (isCustomCodeSvgTag(node.tag)) return true;
  }
  return true;
}

function isPrefix(prefix: CustomCodePath, path: CustomCodePath): boolean {
  return prefix.length <= path.length && prefix.every((value, at) => path[at] === value);
}

/** Before the midpoint along the axis, in reading order (RTL mirrors the inline axis). */
function isBefore(rect: Box, x: number, y: number, layout: LayoutAxis, dir: 'ltr' | 'rtl'): boolean {
  let before: boolean;
  if (layout.axis === 'block') {
    before = y < rect.y + rect.height / 2;
  } else {
    const leftHalf = x < rect.x + rect.width / 2;
    before = dir === 'rtl' ? !leftHalf : leftHalf;
  }
  return layout.reverse ? !before : before;
}

const LINE = 2;

/** The insertion line on one edge of a sibling, in reading order. */
function edgeLine(rect: Box, before: boolean, layout: LayoutAxis, dir: 'ltr' | 'rtl'): Box {
  const readingBefore = layout.reverse ? !before : before;
  if (layout.axis === 'block') {
    const y = readingBefore ? rect.y : rect.y + rect.height;
    return { x: rect.x, y: y - LINE / 2, width: rect.width, height: LINE };
  }
  // Inline: "before" is the start edge — the physical right under RTL.
  const startIsLeft = dir === 'ltr';
  const atLeft = readingBefore === startIsLeft;
  const x = atLeft ? rect.x : rect.x + rect.width;
  return { x: x - LINE / 2, y: rect.y, width: LINE, height: rect.height };
}

function intoLine(rect: Box): Box {
  const inset = Math.min(8, rect.width / 8);
  return {
    x: rect.x + inset,
    y: rect.y + rect.height - LINE - 4,
    width: Math.max(rect.width - inset * 2, LINE),
    height: LINE,
  };
}

export interface ResolveTreeDropInput {
  readonly kernel: BuilderKernel;
  readonly frameDocument: Document;
  readonly payload: TreeDragPayload;
  readonly x: number;
  readonly y: number;
  /** The PAGE direction. */
  readonly dir: 'ltr' | 'rtl';
  readonly ports?: Partial<TreeDropPorts> | undefined;
}

interface Container {
  readonly path: CustomCodePath;
  readonly element: HTMLElement;
}

/**
 * Resolve a tree drop at a frame-local point, or `null` when the point is not
 * over a custom-code region (or no valid seat exists there).
 */
export function resolveTreeDropTarget(input: ResolveTreeDropInput): TreeDropTarget | null {
  const ports = { ...systemTreeDropPorts(), ...input.ports };
  const { kernel, frameDocument, payload, x, y, dir } = input;
  const hit = ports.hitTest(frameDocument, x, y);
  const region = hit?.closest<HTMLElement>('[data-ck-custom-code]') ?? null;
  const regionId = region?.closest('[data-bldr-node]')?.getAttribute('data-bldr-node') ?? null;
  if (hit === null || region === null || regionId === null) return null;
  const tree = treeOf(kernel, regionId);
  if (tree === undefined) return null;

  const elementFor = (path: CustomCodePath): HTMLElement | null =>
    path.length === 0
      ? region
      : region.querySelector<HTMLElement>(`[data-ck-path="${formatCustomCodePath(path)}"]`);

  const movingFrom =
    payload.kind === 'tree-move' && payload.id === regionId ? payload.path : undefined;
  /** What the dragged node stands as, for the content model (P12: no <h2> inside a <p>). */
  const draggedTag = payloadTag(
    payload.kind === 'tree-insert'
      ? payload.node
      : (() => {
          const source = treeOf(kernel, payload.id);
          return source === undefined ? undefined : customCodeNodeAtPath(source, payload.path);
        })(),
  );
  /** A move may not land inside the moved element, nor anywhere the door would refuse it. */
  const allowedParent = (parent: CustomCodePath) =>
    (movingFrom === undefined || !isPrefix(movingFrom, parent)) &&
    treeParentAccepts(tree, parent, draggedTag);

  const postRemoval = (parent: CustomCodePath, rawIndex: number) => {
    if (movingFrom === undefined) return rawIndex;
    const sameParent =
      movingFrom.length === parent.length + 1 && isPrefix(parent, movingFrom);
    const fromIndex = movingFrom.at(-1) ?? 0;
    return sameParent && fromIndex < rawIndex ? rawIndex - 1 : rawIndex;
  };

  const siblingBoxes = (container: Container): Box[] =>
    childrenAt(tree, container.path).flatMap((_child, at) => {
      const element = elementFor([...container.path, at]);
      return element === null ? [] : [ports.measure(element)];
    });

  /** INTO a container: the seat nearest the pointer among its children. */
  const intoTarget = (container: Container): TreeDropTarget | null => {
    if (!allowedParent(container.path)) return null;
    const children = childrenAt(tree, container.path);
    const parentRect = ports.measure(container.element);
    const layout = ports.axisOf(container.element);
    let best: { at: number; rect: Box; distance: number } | undefined;
    children.forEach((_child, at) => {
      const element = elementFor([...container.path, at]);
      if (element === null) return;
      const rect = ports.measure(element);
      const cx = Math.max(rect.x, Math.min(x, rect.x + rect.width));
      const cy = Math.max(rect.y, Math.min(y, rect.y + rect.height));
      const distance = Math.hypot(x - cx, y - cy);
      if (best === undefined || distance < best.distance) best = { at, rect, distance };
    });
    const siblingRects = siblingBoxes(container);
    if (best === undefined) {
      return {
        kind: 'tree',
        regionId,
        parent: container.path,
        index: postRemoval(container.path, children.length),
        indicatorRect: intoLine(parentRect),
        parentRect,
        siblingRects,
      };
    }
    const before = isBefore(best.rect, x, y, layout, dir);
    return {
      kind: 'tree',
      regionId,
      parent: container.path,
      index: postRemoval(container.path, before ? best.at : best.at + 1),
      indicatorRect: edgeLine(best.rect, before, layout, dir),
      parentRect,
      siblingRects,
    };
  };

  /** Beside an element, in its parent. */
  const gapTarget = (path: CustomCodePath, element: HTMLElement): TreeDropTarget | null => {
    const parent = path.slice(0, -1);
    if (!allowedParent(parent) || (movingFrom !== undefined && isPrefix(movingFrom, path))) {
      return null;
    }
    const parentElement = elementFor(parent);
    if (parentElement === null) return null;
    const layout = ports.axisOf(parentElement);
    const rect = ports.measure(element);
    const before = isBefore(rect, x, y, layout, dir);
    const index = path.at(-1) ?? 0;
    return {
      kind: 'tree',
      regionId,
      parent,
      index: postRemoval(parent, before ? index : index + 1),
      indicatorRect: edgeLine(rect, before, layout, dir),
      parentRect: ports.measure(parentElement),
      siblingRects: siblingBoxes({ path: parent, element: parentElement }),
    };
  };

  const addressed = hit.closest<HTMLElement>('[data-ck-path]');
  let path =
    addressed !== null && region.contains(addressed)
      ? parseCustomCodePath(addressed.getAttribute('data-ck-path') ?? '')
      : undefined;
  if (path === undefined) {
    return intoTarget({ path: [], element: region });
  }
  // Climb until a seat is valid: the pointer over a moved element's own
  // descendant resolves beside the moved element's ancestors instead.
  while (path.length > 0) {
    const node = customCodeNodeAtPath(tree, path);
    const element = elementFor(path);
    if (node === undefined || element === null) return null;
    const rect = ports.measure(element);
    const inMiddle = y >= rect.y + rect.height * 0.25 && y < rect.y + rect.height * 0.75;
    const holds = canHoldChildren(node);
    const preferInto = holds && (inMiddle || childrenAt(tree, path).length === 0);
    const first = preferInto ? intoTarget({ path, element }) : gapTarget(path, element);
    const second = preferInto ? gapTarget(path, element) : holds ? intoTarget({ path, element }) : null;
    const resolved = first ?? second;
    if (resolved !== null) return resolved;
    path = path.slice(0, -1);
  }
  return intoTarget({ path: [], element: region });
}

/** The ONE grouped write a tree drop commits, or `undefined` when it would change nothing. */
export function treeDropSteps(
  payload: TreeDragPayload,
  target: TreeDropTarget,
): { readonly steps: readonly GroupStep[]; readonly focus: { id: NodeId; path: number[] } } | undefined {
  if (payload.kind === 'tree-insert') {
    return {
      steps: [
        {
          command: 'insertTreeNode',
          args: {
            id: target.regionId,
            parent: [...target.parent],
            index: target.index,
            node: JSON.parse(JSON.stringify(payload.node)) as unknown,
          },
        },
      ],
      focus: { id: target.regionId, path: [...target.parent, target.index] },
    };
  }
  const sameRegion = payload.id === target.regionId;
  const fromParent = payload.path.slice(0, -1);
  const fromIndex = payload.path.at(-1) ?? 0;
  if (
    sameRegion &&
    fromParent.length === target.parent.length &&
    isPrefix(fromParent, target.parent) &&
    fromIndex === target.index
  ) {
    return undefined; // kept in place
  }
  // The destination path as it reads AFTER the move, for focusing the result.
  let parentAfter = [...target.parent];
  if (sameRegion) {
    const depth = payload.path.length - 1;
    if (
      parentAfter.length > depth &&
      isPrefix(fromParent, parentAfter) &&
      (parentAfter[depth] ?? 0) > fromIndex
    ) {
      parentAfter = [...parentAfter];
      parentAfter[depth] = (parentAfter[depth] ?? 0) - 1;
    }
  }
  return {
    steps: [
      {
        command: 'moveTreeNode',
        args: {
          id: payload.id,
          from: [...payload.path],
          to: {
            ...(sameRegion ? {} : { id: target.regionId }),
            parent: [...target.parent],
            index: target.index,
          },
        },
      },
    ],
    focus: { id: target.regionId, path: [...parentAfter, target.index] },
  };
}
