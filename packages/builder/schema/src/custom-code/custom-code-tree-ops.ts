import type { CustomCodePath } from './custom-code-path';
import {
  isCustomCodeTag,
  type CustomCodeElement,
  type CustomCodeNode,
  type CustomCodeRoot,
} from './custom-code-tree';

/*
  ── Pure, immutable operations over one custom-code tree ─────────────────────
  (style-manager DESIGN.md §D.2, package P2)

  Every element-level edit — the panel, the canvas, the layers tree, copy and
  paste, and the agent — reduces to one of these. They are deliberately PURE:
  no kernel, no zod, no registry. The page commands in
  `@craftkit/builder-custom-code` wrap them, validate the result with the tree
  door, and write it as one transaction.

  Three rules hold for every function here:

  1. The input is never touched. The spine from the root to the edit is
     rebuilt and every branch off it is shared by reference.
  2. A path problem is a typed RESULT, never a throw: the caller decides
     whether it is a refusal (a command) or a disabled button (a toolbar).
  3. Each failure message has the door's form, "what is wrong · what to send
     instead", because for the agent the message is the repair instruction.
*/

/** Why an operation could not be applied. */
export type TreeOpErrorCode =
  | 'path-not-found'
  | 'not-a-container'
  | 'index-out-of-range'
  | 'into-itself'
  | 'empty-selection'
  | 'not-siblings'
  | 'not-contiguous'
  | 'not-an-element'
  | 'no-children'
  | 'has-text'
  | 'has-children'
  | 'invalid-range'
  | 'invalid-value';

export interface TreeOpFailure {
  readonly ok: false;
  readonly code: TreeOpErrorCode;
  /** "what is wrong · what to send instead". */
  readonly message: string;
  /** The tree path the problem is about (empty = the root). */
  readonly path: CustomCodePath;
}

/** A successful edit: the new tree plus whatever the operation reports. */
export type TreeOpResult<T extends object = object> =
  | ({ readonly ok: true; readonly tree: CustomCodeRoot } & T)
  | TreeOpFailure;

function fail(code: TreeOpErrorCode, message: string, path: CustomCodePath): TreeOpFailure {
  return { ok: false, code, message, path: [...path] };
}

function pathText(path: CustomCodePath): string {
  return path.length === 0 ? 'the root' : `[${path.join(',')}]`;
}

/* ── Reading ──────────────────────────────────────────────────────────────── */

type Container = CustomCodeRoot | CustomCodeElement | Extract<CustomCodeNode, { kind: 'component' }>;

/** The node or root at a path; the empty path is the root itself. */
function containerOrNodeAt(
  tree: CustomCodeRoot,
  path: CustomCodePath,
): CustomCodeRoot | CustomCodeNode | undefined {
  let current: CustomCodeRoot | CustomCodeNode = tree;
  for (const index of path) {
    if (current.kind === 'icon') return undefined;
    const children: readonly CustomCodeNode[] | undefined = current.children;
    const next: CustomCodeNode | undefined = children?.[index];
    if (next === undefined) return undefined;
    current = next;
  }
  return current;
}

function isContainer(value: CustomCodeRoot | CustomCodeNode): value is Container {
  return value.kind !== 'icon';
}

/** The node at a path (never the root). */
export function treeNodeAt(tree: CustomCodeRoot, path: CustomCodePath): CustomCodeNode | undefined {
  if (path.length === 0) return undefined;
  const found = containerOrNodeAt(tree, path);
  return found === undefined || found.kind === 'root' ? undefined : found;
}

/** The parent path and index of a non-root path. */
function splitPath(path: CustomCodePath): { parent: CustomCodePath; index: number } | undefined {
  if (path.length === 0) return undefined;
  const index = path[path.length - 1];
  /* v8 ignore next -- a non-empty path always has a last segment. */
  if (index === undefined) return undefined;
  return { parent: path.slice(0, -1), index };
}

/** Same tree, with the children list at `parentPath` replaced. Caller resolved the path. */
function withChildrenAt(
  tree: CustomCodeRoot,
  parentPath: CustomCodePath,
  next: CustomCodeNode[],
): CustomCodeRoot {
  if (parentPath.length === 0) return { ...tree, children: next };
  return { ...tree, children: rebuild(tree.children, parentPath, 0, next) };
}

function rebuild(
  children: readonly CustomCodeNode[],
  parentPath: CustomCodePath,
  depth: number,
  next: CustomCodeNode[],
): CustomCodeNode[] {
  const index = parentPath[depth];
  return children.map((child, at) => {
    if (at !== index || child.kind === 'icon') return child;
    if (depth === parentPath.length - 1) {
      return withChildren(child, next);
    }
    return withChildren(child, rebuild(child.children ?? [], parentPath, depth + 1, next));
  });
}

/** A container with new children; an empty list is dropped rather than stored (Law J). */
function withChildren<N extends Exclude<CustomCodeNode, { kind: 'icon' }>>(
  node: N,
  children: CustomCodeNode[],
): N {
  const copy = { ...node };
  if (children.length === 0) {
    delete copy.children;
  } else {
    copy.children = children;
  }
  return copy;
}

function childrenAt(
  tree: CustomCodeRoot,
  parentPath: CustomCodePath,
): { children: CustomCodeNode[] } | TreeOpFailure {
  const parent = containerOrNodeAt(tree, parentPath);
  if (parent === undefined) {
    return fail(
      'path-not-found',
      `No element at ${pathText(parentPath)} · send a parent path that exists in this tree`,
      parentPath,
    );
  }
  if (!isContainer(parent)) {
    return fail(
      'not-a-container',
      `The node at ${pathText(parentPath)} is an icon and holds no children · send the path of an element, a component or the root ([])`,
      parentPath,
    );
  }
  return { children: [...(parent.children ?? [])] };
}

/** A deep, plain copy of a node — the duplicate must share nothing with its source. */
export function cloneTreeNode<N extends CustomCodeNode>(node: N): N {
  return JSON.parse(JSON.stringify(node)) as N;
}

/* ── Insert / remove / move ───────────────────────────────────────────────── */

/**
 * Insert `node` as child `index` of the container at `parentPath` (`[]` = the
 * root). `index` may equal the child count, which appends.
 */
export function insertNodeAt(
  tree: CustomCodeRoot,
  parentPath: CustomCodePath,
  index: number,
  node: CustomCodeNode,
): TreeOpResult<{ readonly path: CustomCodePath }> {
  const found = childrenAt(tree, parentPath);
  if ('ok' in found) return found;
  const { children } = found;
  if (!Number.isInteger(index) || index < 0 || index > children.length) {
    return fail(
      'index-out-of-range',
      `Index ${String(index)} is outside ${pathText(parentPath)}, which has ${String(children.length)} children · send an index from 0 to ${String(children.length)}`,
      parentPath,
    );
  }
  children.splice(index, 0, node);
  return { ok: true, tree: withChildrenAt(tree, parentPath, children), path: [...parentPath, index] };
}

/** Remove the node at `path`; the removed node is returned for a cross-tree move or a cut. */
export function removeNodeAt(
  tree: CustomCodeRoot,
  path: CustomCodePath,
): TreeOpResult<{ readonly removed: CustomCodeNode }> {
  const split = splitPath(path);
  const removed = treeNodeAt(tree, path);
  if (split === undefined || removed === undefined) {
    return fail(
      'path-not-found',
      `No element at ${pathText(path)} · send the path of an element in this tree`,
      path,
    );
  }
  const found = childrenAt(tree, split.parent);
  /* v8 ignore next -- the node resolved, so its parent's children resolve too. */
  if ('ok' in found) return found;
  found.children.splice(split.index, 1);
  return { ok: true, tree: withChildrenAt(tree, split.parent, found.children), removed };
}

/** The first half of a cross-tree move: the same as `removeNodeAt`, named for intent. */
export const extractNodeAt = removeNodeAt;

/**
 * Move a node within one tree.
 *
 * Coordinates: `toParent` is read in the tree AS IT IS before the move (what a
 * caller computed from what it sees), and `toIndex` is the node's index among
 * the destination's children AFTER it has been taken out — the kernel's own
 * `moveNode` convention, which makes "move to the end" `children.length - 1`
 * within one parent and `children.length` across parents.
 */
export function moveNode(
  tree: CustomCodeRoot,
  from: CustomCodePath,
  toParent: CustomCodePath,
  toIndex: number,
): TreeOpResult<{ readonly path: CustomCodePath }> {
  if (from.length > 0 && from.length <= toParent.length && from.every((v, i) => toParent[i] === v)) {
    return fail(
      'into-itself',
      `Cannot move ${pathText(from)} into itself or its own descendant ${pathText(toParent)} · send a destination outside the moved element`,
      toParent,
    );
  }
  const taken = removeNodeAt(tree, from);
  if (!taken.ok) return taken;
  const adjusted = adjustAfterRemoval(toParent, from);
  return insertNodeAt(taken.tree, adjusted, toIndex, taken.removed);
}

/**
 * A pre-removal path, re-read after the node at `removed` was taken out: a
 * later sibling of the removed node (or anything under one) shifts up by one.
 */
export function adjustAfterRemoval(path: CustomCodePath, removed: CustomCodePath): CustomCodePath {
  const depth = removed.length - 1;
  if (depth < 0 || path.length <= depth) return [...path];
  for (let at = 0; at < depth; at += 1) {
    if (path[at] !== removed[at]) return [...path];
  }
  const segment = path[depth];
  const removedIndex = removed[depth];
  /* v8 ignore next -- both are defined by the length checks above. */
  if (segment === undefined || removedIndex === undefined) return [...path];
  if (segment <= removedIndex) return [...path];
  const next = [...path];
  next[depth] = segment - 1;
  return next;
}

/** Insert a deep copy of the node at `path` right after it. */
export function duplicateNodeAt(
  tree: CustomCodeRoot,
  path: CustomCodePath,
): TreeOpResult<{ readonly path: CustomCodePath }> {
  const split = splitPath(path);
  const node = treeNodeAt(tree, path);
  if (split === undefined || node === undefined) {
    return fail(
      'path-not-found',
      `No element at ${pathText(path)} · send the path of an element in this tree`,
      path,
    );
  }
  return insertNodeAt(tree, split.parent, split.index + 1, cloneTreeNode(node));
}

/* ── Wrap / unwrap ────────────────────────────────────────────────────────── */

export interface TreeWrapper {
  readonly tag: string;
  readonly className?: string | undefined;
}

/**
 * Wrap CONTIGUOUS siblings in one new element, placed where the first of them
 * stood. Paths may arrive in any order; duplicates are refused.
 */
export function wrapNodesAt(
  tree: CustomCodeRoot,
  paths: readonly CustomCodePath[],
  wrapper: TreeWrapper,
): TreeOpResult<{ readonly path: CustomCodePath }> {
  const first = paths[0];
  if (first === undefined) {
    return fail('empty-selection', 'Nothing to wrap · send at least one element path', []);
  }
  const wrapperTag = wrapper.tag;
  if (!isCustomCodeTag(wrapperTag)) {
    return fail(
      'invalid-value',
      `<${wrapperTag}> is not a tag the vocabulary admits · send a container tag such as div, section, article, figure or a`,
      first,
    );
  }
  const split = splitPath(first);
  if (split === undefined) {
    return fail('path-not-found', 'The root cannot be wrapped · send the paths of its children', first);
  }
  const indices: number[] = [];
  for (const path of paths) {
    const own = splitPath(path);
    const sameParent =
      own?.parent.length === split.parent.length &&
      own.parent.every((v, i) => split.parent[i] === v);
    if (own === undefined || !sameParent) {
      return fail(
        'not-siblings',
        `${pathText(path)} is not a sibling of ${pathText(first)} · send element paths that share one parent`,
        path,
      );
    }
    if (treeNodeAt(tree, path) === undefined) {
      return fail(
        'path-not-found',
        `No element at ${pathText(path)} · send the path of an element in this tree`,
        path,
      );
    }
    if (indices.includes(own.index)) {
      return fail('not-contiguous', `${pathText(path)} is listed twice · send each path once`, path);
    }
    indices.push(own.index);
  }
  indices.sort((a, b) => a - b);
  const start = indices[0] ?? 0;
  if (indices.some((value, at) => value !== start + at)) {
    return fail(
      'not-contiguous',
      `The elements to wrap are not side by side (indices ${indices.join(', ')}) · send a run of neighbouring siblings`,
      split.parent,
    );
  }
  const found = childrenAt(tree, split.parent);
  /* v8 ignore next -- the siblings resolved, so their parent's children resolve. */
  if ('ok' in found) return found;
  const wrapped = found.children.splice(start, indices.length);
  const element: CustomCodeElement = { kind: 'element', tag: wrapperTag, children: wrapped };
  if (wrapper.className !== undefined && wrapper.className.trim() !== '') {
    element.className = wrapper.className.trim();
  }
  found.children.splice(start, 0, element);
  return {
    ok: true,
    tree: withChildrenAt(tree, split.parent, found.children),
    path: [...split.parent, start],
  };
}

/**
 * Replace an element by its children. Refused when that would silently lose
 * content: an element with its own text, or one with nothing inside.
 */
export function unwrapNodeAt(
  tree: CustomCodeRoot,
  path: CustomCodePath,
): TreeOpResult<{ readonly paths: readonly CustomCodePath[] }> {
  const split = splitPath(path);
  const node = treeNodeAt(tree, path);
  if (split === undefined || node === undefined) {
    return fail(
      'path-not-found',
      `No element at ${pathText(path)} · send the path of an element in this tree`,
      path,
    );
  }
  if (node.kind !== 'element') {
    return fail(
      'not-an-element',
      `The node at ${pathText(path)} is ${node.kind === 'icon' ? 'an icon' : 'a component'} and cannot be unwrapped · send the path of an element that wraps others`,
      path,
    );
  }
  const inner = node.children ?? [];
  if (inner.length === 0) {
    return fail(
      'no-children',
      `<${node.tag}> at ${pathText(path)} wraps nothing · use removeTreeNode to delete it`,
      path,
    );
  }
  if (node.text !== undefined && node.text !== '') {
    return fail(
      'has-text',
      `<${node.tag}> at ${pathText(path)} carries its own text, which unwrapping would lose · move the text into a child element first`,
      path,
    );
  }
  const found = childrenAt(tree, split.parent);
  /* v8 ignore next -- the node resolved, so its parent's children resolve. */
  if ('ok' in found) return found;
  found.children.splice(split.index, 1, ...inner);
  return {
    ok: true,
    tree: withChildrenAt(tree, split.parent, found.children),
    paths: inner.map((_, at) => [...split.parent, split.index + at]),
  };
}

/* ── Patch ────────────────────────────────────────────────────────────────── */

/**
 * One node's field and attribute changes. `null` (and `''` for the text-like
 * fields) DELETES — an empty string is never stored (Law J). Attributes keep
 * `''`, because a bare boolean attribute (`muted`, `popover`) IS the empty
 * string; only `null` deletes one.
 */
export interface TreeNodePatch {
  readonly set?:
    | {
        readonly className?: string | null | undefined;
        readonly text?: string | null | undefined;
        readonly tag?: string | undefined;
        readonly label?: string | null | undefined;
        readonly locked?: boolean | undefined;
      }
    | undefined;
  readonly attributes?: Readonly<Record<string, string | null>> | undefined;
}

/** Apply a field/attribute patch to the node at `path`. Validation is the door's job. */
export function patchNodeAt(
  tree: CustomCodeRoot,
  path: CustomCodePath,
  patch: TreeNodePatch,
): TreeOpResult<{ readonly node: CustomCodeNode }> {
  const node = treeNodeAt(tree, path);
  if (node === undefined) {
    return fail(
      'path-not-found',
      `No element at ${pathText(path)} · send the path of an element in this tree`,
      path,
    );
  }
  const record: Record<string, unknown> = { ...node };
  const set = patch.set ?? {};
  if (set.tag !== undefined) {
    if (node.kind !== 'element') {
      return fail(
        'not-an-element',
        `Only an element has a tag; the node at ${pathText(path)} is ${node.kind === 'icon' ? 'an icon' : 'a component'} · drop "tag" from the patch`,
        path,
      );
    }
    record['tag'] = set.tag;
  }
  if (set.className !== undefined) {
    if (node.kind === 'component') {
      return fail(
        'not-an-element',
        `A component at ${pathText(path)} takes no className · style it through its props, or wrap it in an element`,
        path,
      );
    }
    assignText(record, 'className', set.className === null ? null : set.className.trim());
  }
  if (set.text !== undefined) {
    if (node.kind !== 'element') {
      return fail(
        'not-an-element',
        `Only an element holds text; the node at ${pathText(path)} is ${node.kind === 'icon' ? 'an icon' : 'a component'} · drop "text" from the patch`,
        path,
      );
    }
    assignText(record, 'text', set.text);
  }
  if (set.label !== undefined) {
    assignText(record, 'label', set.label === null ? null : set.label.trim());
  }
  if (set.locked !== undefined) {
    if (set.locked) record['locked'] = true;
    else delete record['locked'];
  }
  const attributes = patch.attributes ?? {};
  if (Object.keys(attributes).length > 0) {
    if (node.kind !== 'element') {
      return fail(
        'not-an-element',
        `Only an element carries attributes; the node at ${pathText(path)} is ${node.kind === 'icon' ? 'an icon' : 'a component'} · drop "attributes" from the patch`,
        path,
      );
    }
    const next: Record<string, string> = {};
    for (const [name, value] of Object.entries(node.attributes ?? {})) {
      if (typeof value === 'string') next[name] = value;
    }
    for (const [name, value] of Object.entries(attributes)) {
      if (value === null) delete next[name];
      else next[name] = value;
    }
    if (Object.keys(next).length === 0) delete record['attributes'];
    else record['attributes'] = next;
  }
  const patched = record as unknown as CustomCodeNode;
  const split = splitPath(path);
  /* v8 ignore next -- the node resolved, so the path is non-empty. */
  if (split === undefined) return fail('path-not-found', 'The root has no fields', path);
  const found = childrenAt(tree, split.parent);
  /* v8 ignore next -- the node resolved, so its parent's children resolve. */
  if ('ok' in found) return found;
  found.children[split.index] = patched;
  return { ok: true, tree: withChildrenAt(tree, split.parent, found.children), node: patched };
}

function assignText(record: Record<string, unknown>, key: string, value: string | null): void {
  if (value === null || value === '') delete record[key];
  else record[key] = value;
}

/** Replace the node at `path` wholesale. */
export function setNodeAt(
  tree: CustomCodeRoot,
  path: CustomCodePath,
  node: CustomCodeNode,
): TreeOpResult<{ readonly path: CustomCodePath }> {
  const split = splitPath(path);
  if (split === undefined || treeNodeAt(tree, path) === undefined) {
    return fail(
      'path-not-found',
      `No element at ${pathText(path)} · send the path of an element in this tree, or use insertTreeNode`,
      path,
    );
  }
  const found = childrenAt(tree, split.parent);
  /* v8 ignore next -- the node resolved, so its parent's children resolve. */
  if ('ok' in found) return found;
  found.children[split.index] = node;
  return { ok: true, tree: withChildrenAt(tree, split.parent, found.children), path: [...path] };
}

/* ── Inline formatting ────────────────────────────────────────────────────── */

export const TREE_TEXT_MARKS = ['strong', 'em', 'u', 'mark', 'code', 'a', 'span'] as const;
export type TreeTextMark = (typeof TREE_TEXT_MARKS)[number];

export interface TreeTextMarkExtras {
  readonly className?: string | undefined;
  readonly href?: string | undefined;
}

/** A link target the run may carry: relative, in-page, https/http, mail or phone. */
const LINK_TARGET = /^(?:\/|\.\/|#|https?:\/\/|mailto:|tel:)/iu;

/**
 * Split an element's own text into child runs, marking `[start, end)`.
 *
 * The element keeps its tag, class and attributes; its `text` moves into
 * children: plain runs become `<span>`, the marked run becomes the mark's tag.
 * `u` is written as `<u>` when the vocabulary admits it and as a `<span
 * class="underline">` otherwise, so the run never fails the door for a tag.
 * Empty edge runs are not created. Only a leaf element with text can be
 * split; to format inside an existing run, address that run.
 */
export function formatTextRange(
  element: CustomCodeNode,
  start: number,
  end: number,
  mark: TreeTextMark,
  extras: TreeTextMarkExtras = {},
): { readonly ok: true; readonly element: CustomCodeElement } | TreeOpFailure {
  if (element.kind !== 'element') {
    return fail(
      'not-an-element',
      'Only an element holds text to format · send the path of a text element',
      [],
    );
  }
  if ((element.children?.length ?? 0) > 0) {
    return fail(
      'has-children',
      `<${element.tag}> already holds child elements · format inside one of its runs by sending that run's path`,
      [],
    );
  }
  const text = element.text ?? '';
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > text.length || start >= end) {
    return fail(
      'invalid-range',
      `The range ${String(start)}–${String(end)} does not select text in "${text.slice(0, 40)}" (${String(text.length)} characters) · send 0 ≤ start < end ≤ ${String(text.length)}`,
      [],
    );
  }
  const href = extras.href?.trim();
  if (mark === 'a' && (href === undefined || href === '' || !LINK_TARGET.test(href))) {
    return fail(
      'invalid-value',
      'A link run needs an href · send a relative path, #anchor, https:// address, mailto: or tel:',
      [],
    );
  }
  const run = markRun(mark, text.slice(start, end), extras.className?.trim(), href);
  const runs: CustomCodeElement[] = [];
  if (start > 0) runs.push({ kind: 'element', tag: 'span', text: text.slice(0, start) });
  runs.push(run);
  if (end < text.length) runs.push({ kind: 'element', tag: 'span', text: text.slice(end) });
  const next: CustomCodeElement = { ...element, children: runs };
  delete next.text;
  return { ok: true, element: next };
}

function markRun(
  mark: TreeTextMark,
  text: string,
  className: string | undefined,
  href: string | undefined,
): CustomCodeElement {
  const underlineAsSpan = mark === 'u' && !isCustomCodeTag('u');
  const tag = underlineAsSpan ? 'span' : mark;
  /* v8 ignore next 3 -- every mark but `u` is in the base vocabulary. */
  if (!isCustomCodeTag(tag)) {
    return { kind: 'element', tag: 'span', text };
  }
  const run: CustomCodeElement = { kind: 'element', tag, text };
  const classes = [underlineAsSpan ? 'underline' : '', className ?? ''].filter((c) => c !== '');
  if (classes.length > 0) run.className = classes.join(' ');
  if (mark === 'a' && href !== undefined) run.attributes = { href };
  return run;
}

/* ── Similar siblings ─────────────────────────────────────────────────────── */

function similarityKey(node: CustomCodeNode): string {
  const classes = (node.kind === 'component' ? '' : (node.className ?? ''))
    .split(/\s+/u)
    .filter((c) => c !== '')
    .sort()
    .join(' ');
  const identity =
    node.kind === 'element' ? node.tag : node.kind === 'icon' ? 'icon' : `component:${node.component}`;
  return `${node.kind}|${identity}|${classes}`;
}

/**
 * The siblings of the node at `path` that look like it — same kind and tag
 * (or component type) and the same set of classes in any order — INCLUDING
 * the node itself, in document order. The basis of "apply to all similar".
 * Empty when the path does not resolve.
 */
export function similarSiblings(
  tree: CustomCodeRoot,
  path: CustomCodePath,
): readonly CustomCodePath[] {
  const split = splitPath(path);
  const node = treeNodeAt(tree, path);
  if (split === undefined || node === undefined) return [];
  const parent = containerOrNodeAt(tree, split.parent);
  /* v8 ignore next -- the node resolved, so its parent is a container. */
  if (parent === undefined || !isContainer(parent)) return [];
  const key = similarityKey(node);
  const found: CustomCodePath[] = [];
  (parent.children ?? []).forEach((sibling, at) => {
    if (similarityKey(sibling) === key) found.push([...split.parent, at]);
  });
  return found;
}
