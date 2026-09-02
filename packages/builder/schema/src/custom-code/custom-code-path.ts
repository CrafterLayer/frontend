import type { CustomCodeNode, CustomCodeRoot } from './custom-code-tree';

/**
 * Addressing ONE node inside a stored custom-code tree.
 *
 * A composed region is one document node whose `tree` prop holds every element
 * the assistant authored (see the block's "why it is one node and not many").
 * That is the right storage shape and the wrong editing shape: a person who
 * clicks the portrait in a generated CV header means THAT image, not the
 * region. So an element needs an address the canvas can stamp, the kernel can
 * hold as ephemeral focus, and the Inspector can read and write through.
 *
 * The address is the sequence of child indices from the root — the same
 * position-derived identity the renderer already uses for synthetic ids
 * (`host::0.1.2`), which is what keeps the two from ever disagreeing about
 * which element is which. Position is deliberately the whole identity: the
 * tree has no ids, and inventing them would be a second source of truth about
 * structure that every AI write would have to maintain.
 */
export type CustomCodePath = readonly number[];

/** The dotted form the renderer stamps on the canvas (`data-ck-path="0.1.2"`). */
export function formatCustomCodePath(path: CustomCodePath): string {
  return path.map((index) => String(index)).join('.');
}

const PATH_TEXT = /^\d+(?:\.\d+)*$/u;

/** Parse a stamped path; anything but non-negative integers joined by dots is refused. */
export function parseCustomCodePath(text: string): number[] | undefined {
  if (!PATH_TEXT.test(text)) {
    return undefined;
  }
  return text.split('.').map((part) => Number.parseInt(part, 10));
}

function childrenOf(value: unknown): readonly unknown[] | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const children = (value as { children?: unknown }).children;
  return Array.isArray(children) ? children : undefined;
}

function isNode(value: unknown): value is CustomCodeNode {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const kind = (value as { kind?: unknown }).kind;
  return kind === 'element' || kind === 'component' || kind === 'icon';
}

/**
 * The node at a path — a TOLERANT read, like the renderer's: a document is
 * validated when written and read again after upgrades and hand edits, so a
 * missing branch or junk input yields `undefined` rather than throwing into a
 * panel with no error boundary. The empty path names the root, which is not an
 * element and therefore also `undefined`.
 */
export function customCodeNodeAtPath(
  tree: unknown,
  path: CustomCodePath,
): CustomCodeNode | undefined {
  if (path.length === 0) {
    return undefined;
  }
  let current: unknown = tree;
  for (const index of path) {
    const children = childrenOf(current);
    if (children === undefined) {
      return undefined;
    }
    current = children[index];
  }
  return isNode(current) ? current : undefined;
}

/**
 * The tree with one node replaced. Immutable: the input is never touched, the
 * spine from the root to the path is rebuilt, and every branch off that spine
 * is shared by reference — so a one-attribute edit on a 400-node region
 * allocates a handful of objects. An unresolvable path returns the input tree
 * BY REFERENCE, which the kernel's no-effect rule turns into "nothing written".
 */
export function replaceCustomCodeNodeAtPath(
  tree: CustomCodeRoot,
  path: CustomCodePath,
  next: CustomCodeNode,
): CustomCodeRoot {
  if (path.length === 0 || customCodeNodeAtPath(tree, path) === undefined) {
    return tree;
  }
  return { ...tree, children: replaceIn(tree.children, path, 0, next) };
}

function replaceIn(
  children: CustomCodeNode[],
  path: CustomCodePath,
  depth: number,
  next: CustomCodeNode,
): CustomCodeNode[] {
  const index = path[depth];
  /* v8 ignore next 3 -- the caller resolved the path first; a missing index is unreachable. */
  if (index === undefined) {
    return children;
  }
  return children.map((child, at) => {
    if (at !== index) {
      return child;
    }
    if (depth === path.length - 1) {
      return next;
    }
    const nested = childrenOf(child);
    /* v8 ignore next 3 -- same argument: the resolved path proves the branch exists. */
    if (nested === undefined) {
      return child;
    }
    return { ...child, children: replaceIn(nested as CustomCodeNode[], path, depth + 1, next) };
  });
}
