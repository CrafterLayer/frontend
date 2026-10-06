import type { BuilderKernel, GroupStep } from '@craftkit/builder-core';
import {
  applyStyleIntents,
  extractStyleClasses,
  pasteStyleClasses,
  readStyle,
  type Author,
  type CustomCodeNode,
  type CustomCodePath,
  type StyleBucket,
} from '@craftkit/builder-schema';

import { customCodeElementAt } from '../custom-code/element-at';
import {
  treeNodeDisplayName,
  tryDispatchTreeEdits,
  type ElementTarget,
} from '../custom-code/element-target';

/*
  ── Element actions (style-manager DESIGN.md §A.6, P7) ───────────────────────

  The second row of the element quick bar, and the fix for the region bug: with
  an element focused inside a custom-code region, Duplicate / Delete / Move
  used to act on the WHOLE REGION (block-actions.ts resolved actions for the
  selected node and nothing else). Every structural action here is a
  path-addressed tree command, so it touches the element and nothing around it.

  Same contract as the block actions: `resolveElementActions` says what is
  valid (a closed gate carries its reason), `performElementAction` re-checks
  the gate from live document truth and writes EXACTLY ONE labelled
  transaction (one Undo) — for one target or for a multi-selection alike.
  Selection-only actions (select parent, deselect) and clipboard-only actions
  (copy style) write nothing.
*/

export type ElementActionId =
  | 'selectParent'
  | 'duplicate'
  | 'delete'
  | 'moveEarlier'
  | 'moveLater'
  | 'wrap'
  | 'unwrap'
  | 'copyStyle'
  | 'pasteStyle'
  | 'saveTemplate'
  | 'animate'
  | 'hideOnBucket'
  | 'deselect';

export const ELEMENT_ACTION_IDS: readonly ElementActionId[] = [
  'selectParent',
  'duplicate',
  'delete',
  'moveEarlier',
  'moveLater',
  'wrap',
  'unwrap',
  'copyStyle',
  'pasteStyle',
  'saveTemplate',
  'animate',
  'hideOnBucket',
  'deselect',
];

export interface ElementAction {
  readonly id: ElementActionId;
  /** English default; the quick bar shows its own localized label by id. */
  readonly label: string;
  readonly enabled: boolean;
  /** Why a closed gate is closed — doubles as the refusal announcement. */
  readonly reason?: string | undefined;
  /** Toggle state (hide on this bucket); absent for one-shot actions. */
  readonly pressed?: boolean | undefined;
  /** Keyboard hint shown beside the label for the pointer ("Esc"). */
  readonly hint?: string | undefined;
}

export interface ElementActionResult {
  readonly ok: boolean;
  /** For the canvas's polite region — every outcome is announced. */
  readonly announcement: string;
}

/** Where copied styles live between Copy style and Paste style. */
export interface StyleClipboard {
  read(): string | undefined;
  write(classes: string): void;
}

/** An in-memory clipboard, the default when the host passes none. */
export function createMemoryStyleClipboard(): StyleClipboard {
  let held: string | undefined;
  return {
    read: () => held,
    write: (classes) => {
      held = classes;
    },
  };
}

export interface ElementActionContext {
  /** The bucket "Hide on this bucket" writes at. Default `base`. */
  readonly bucket?: StyleBucket | undefined;
  readonly styleClipboard?: StyleClipboard | undefined;
  /** Host hook: save the element as a library template (P5 `saveTemplate`). */
  readonly onSaveTemplate?: ((target: TreeTarget) => void) | undefined;
  /** Host hook: open the Interactions/Motion editor for the element. */
  readonly onAnimate?: ((target: TreeTarget) => void) | undefined;
  readonly author?: Author | undefined;
}

export type TreeTarget = Extract<ElementTarget, { kind: 'tree' }>;

const LABELS: Record<ElementActionId, string> = {
  selectParent: 'Select parent',
  duplicate: 'Duplicate',
  delete: 'Delete',
  moveEarlier: 'Move earlier',
  moveLater: 'Move later',
  wrap: 'Wrap in container',
  unwrap: 'Unwrap',
  copyStyle: 'Copy style',
  pasteStyle: 'Paste style',
  saveTemplate: 'Save as template',
  animate: 'Animate',
  hideOnBucket: 'Hide on this device',
  deselect: 'Deselect',
};

// ── Paths ──────────────────────────────────────────────────────────────────

function comparePaths(a: CustomCodePath, b: CustomCodePath): number {
  const length = Math.min(a.length, b.length);
  for (let at = 0; at < length; at += 1) {
    const difference = (a[at] ?? 0) - (b[at] ?? 0);
    if (difference !== 0) return difference;
  }
  return a.length - b.length;
}

function isAncestorPath(ancestor: CustomCodePath, path: CustomCodePath): boolean {
  return ancestor.length < path.length && ancestor.every((value, at) => path[at] === value);
}

function parentPath(path: CustomCodePath): CustomCodePath {
  return path.slice(0, -1);
}

function samePath(a: CustomCodePath, b: CustomCodePath): boolean {
  return a.length === b.length && a.every((value, at) => b[at] === value);
}

/** A path re-read after a node was inserted at `inserted`: later siblings shift by one. */
export function shiftAfterInsert(path: CustomCodePath, inserted: CustomCodePath): CustomCodePath {
  const depth = inserted.length - 1;
  if (depth < 0 || path.length <= depth) return [...path];
  for (let at = 0; at < depth; at += 1) {
    if (path[at] !== inserted[at]) return [...path];
  }
  const segment = path[depth];
  const insertedAt = inserted[depth];
  /* v8 ignore next -- both are defined by the length checks above. */
  if (segment === undefined || insertedAt === undefined) return [...path];
  if (segment < insertedAt) return [...path];
  const next = [...path];
  next[depth] = segment + 1;
  return next;
}

// ── Targets ────────────────────────────────────────────────────────────────

interface LiveTarget {
  readonly target: TreeTarget;
  readonly node: CustomCodeNode;
  readonly siblings: readonly CustomCodeNode[];
  readonly name: string;
}

function childrenOf(node: CustomCodeNode | { children: CustomCodeNode[] }): readonly CustomCodeNode[] {
  return 'kind' in node && node.kind === 'icon' ? [] : (node.children ?? []);
}

function liveTarget(kernel: BuilderKernel, target: TreeTarget): LiveTarget | undefined {
  const found = customCodeElementAt(kernel, target.nodeId, target.path);
  if (found === undefined) return undefined;
  const parent = parentPath(target.path);
  const container =
    parent.length === 0 ? found.tree : customCodeElementAt(kernel, target.nodeId, parent)?.element;
  /* v8 ignore next -- the parent of a resolvable path always resolves. */
  if (container === undefined) return undefined;
  return {
    target,
    node: found.element,
    siblings: childrenOf(container),
    name: treeNodeDisplayName(found.element),
  };
}

/**
 * The live tree targets, de-duplicated, with any target nested inside another
 * target of the same region dropped (deleting a card and its own heading is
 * deleting the card). Primary first.
 */
function liveTargets(kernel: BuilderKernel, targets: readonly ElementTarget[]): LiveTarget[] {
  const tree = targets.filter((target): target is TreeTarget => target.kind === 'tree');
  const live: LiveTarget[] = [];
  for (const target of tree) {
    const nested = tree.some(
      (other) => other.nodeId === target.nodeId && isAncestorPath(other.path, target.path),
    );
    const duplicate = live.some(
      (entry) => entry.target.nodeId === target.nodeId && samePath(entry.target.path, target.path),
    );
    if (nested || duplicate) continue;
    const resolved = liveTarget(kernel, target);
    if (resolved !== undefined) live.push(resolved);
  }
  return live;
}

/** Descending document order: removing or duplicating in this order keeps every other path valid. */
function descending(live: readonly LiveTarget[]): LiveTarget[] {
  return [...live].sort((a, b) => {
    if (a.target.nodeId !== b.target.nodeId) return a.target.nodeId < b.target.nodeId ? 1 : -1;
    return comparePaths(b.target.path, a.target.path);
  });
}

function classNameOf(node: CustomCodeNode): string {
  return node.kind === 'component' ? '' : (node.className ?? '');
}

function subjectOf(live: readonly LiveTarget[]): string {
  if (live.length === 1) return live[0]?.name ?? 'element';
  return `${String(live.length)} elements`;
}

function bucketWord(bucket: StyleBucket): string {
  if (bucket === 'base') return 'desktop';
  if (bucket === 'tablet') return 'tablet';
  if (bucket === 'mobile') return 'mobile';
  return `≤ ${String(bucket.maxWidth)}px`;
}

/** Whether every live target is hidden (`display: none`) set AT this bucket. */
function hiddenHere(live: readonly LiveTarget[], bucket: StyleBucket): boolean {
  return (
    live.length > 0 &&
    live.every((entry) => {
      const display = readStyle(classNameOf(entry.node), { bucket, state: 'default' }).get('display');
      return (
        display?.source === 'here' &&
        display.value.kind === 'keyword' &&
        display.value.keyword === 'none'
      );
    })
  );
}

// ── Gates ──────────────────────────────────────────────────────────────────

type Gate = { enabled: true } | { enabled: false; reason: string };
const OPEN: Gate = { enabled: true };

function sameParentContiguous(live: readonly LiveTarget[]): boolean {
  const first = live[0];
  if (first === undefined) return false;
  const parent = parentPath(first.target.path);
  if (
    !live.every(
      (entry) =>
        entry.target.nodeId === first.target.nodeId &&
        samePath(parentPath(entry.target.path), parent),
    )
  ) {
    return false;
  }
  const indexes = live.map((entry) => entry.target.path.at(-1) ?? 0).sort((a, b) => a - b);
  return indexes.every((value, at) => at === 0 || value === (indexes[at - 1] ?? 0) + 1);
}

function gatesFor(
  live: readonly LiveTarget[],
  context: ElementActionContext,
): Record<ElementActionId, Gate> {
  const none: Gate = { enabled: false, reason: 'No element is selected' };
  const single = live.length === 1 ? live[0] : undefined;
  const index = single?.target.path.at(-1) ?? 0;
  const singleOnly = (gate: Gate): Gate =>
    live.length === 0 ? none : single === undefined ? { enabled: false, reason: 'Select one element' } : gate;
  const any = (gate: Gate = OPEN): Gate => (live.length === 0 ? none : gate);
  const copied = context.styleClipboard?.read();
  return {
    selectParent: singleOnly(OPEN),
    duplicate: any(),
    delete: any(),
    moveEarlier: singleOnly(index === 0 ? { enabled: false, reason: 'Already first' } : OPEN),
    moveLater: singleOnly(
      single !== undefined && index >= single.siblings.length - 1
        ? { enabled: false, reason: 'Already last' }
        : OPEN,
    ),
    wrap: any(
      sameParentContiguous(live)
        ? OPEN
        : { enabled: false, reason: 'Only side-by-side siblings can be wrapped together' },
    ),
    unwrap: singleOnly(
      single?.node.kind === 'element' && childrenOf(single.node).length > 0
        ? OPEN
        : { enabled: false, reason: 'Only a container with children can be unwrapped' },
    ),
    copyStyle: singleOnly(
      single !== undefined && single.node.kind !== 'component'
        ? OPEN
        : { enabled: false, reason: 'A component has no classes to copy' },
    ),
    pasteStyle: any(
      copied === undefined || copied.trim() === ''
        ? { enabled: false, reason: 'Copy a style first' }
        : OPEN,
    ),
    saveTemplate: singleOnly(
      context.onSaveTemplate === undefined
        ? { enabled: false, reason: 'Templates are not available here' }
        : OPEN,
    ),
    animate: singleOnly(
      context.onAnimate === undefined
        ? { enabled: false, reason: 'Animation is not available here' }
        : OPEN,
    ),
    hideOnBucket: any(
      live.some((entry) => entry.node.kind === 'component')
        ? { enabled: false, reason: 'A component cannot be hidden by class' }
        : OPEN,
    ),
    deselect: OPEN,
  };
}

/**
 * The ordered actions for the current element targets (primary first). A
 * closed gate keeps its seat, disabled, with its reason.
 */
export function resolveElementActions(
  kernel: BuilderKernel,
  targets: readonly ElementTarget[],
  context: ElementActionContext = {},
): ElementAction[] {
  const live = liveTargets(kernel, targets);
  const gates = gatesFor(live, context);
  const bucket = context.bucket ?? 'base';
  const hidden = hiddenHere(live, bucket);
  return ELEMENT_ACTION_IDS.map((id) => {
    const gate = gates[id];
    const label =
      id === 'hideOnBucket'
        ? `${hidden ? 'Show' : 'Hide'} on ${bucketWord(bucket)}`
        : LABELS[id];
    return {
      id,
      label,
      enabled: gate.enabled,
      ...(gate.enabled ? {} : { reason: gate.reason }),
      ...(id === 'hideOnBucket' ? { pressed: hidden } : {}),
      ...(id === 'deselect' ? { hint: 'Esc' } : {}),
    };
  });
}

// ── Perform ────────────────────────────────────────────────────────────────

function dispatch(
  kernel: BuilderKernel,
  steps: readonly GroupStep[],
  label: string,
  context: ElementActionContext,
): { ok: true } | { ok: false; message: string } {
  const result = tryDispatchTreeEdits(kernel, steps, label, context.author ?? 'user');
  return result.ok ? { ok: true } : { ok: false, message: result.message };
}

function focus(kernel: BuilderKernel, target: TreeTarget | null, regionId: string): void {
  if (target === null) {
    kernel.setSelection([regionId]);
    return;
  }
  kernel.focusElement(target.nodeId, target.path);
}

/** Where focus lands after deleting `removed`: the sibling taking its seat, else the previous, else the parent. */
function survivorAfterDelete(entry: LiveTarget): TreeTarget | null {
  const { path, nodeId } = entry.target;
  const index = path.at(-1) ?? 0;
  const remaining = entry.siblings.length - 1;
  if (remaining > 0) {
    const seat = Math.min(index, remaining - 1);
    return { kind: 'tree', nodeId, path: [...parentPath(path), seat] };
  }
  const parent = parentPath(path);
  return parent.length === 0 ? null : { kind: 'tree', nodeId, path: parent };
}

/**
 * Perform one action over the element targets as EXACTLY ONE transaction (or
 * none, for selection and clipboard actions). The gate is re-checked from
 * live truth first; a refusal is announced, never thrown.
 */
export function performElementAction(
  kernel: BuilderKernel,
  targets: readonly ElementTarget[],
  actionId: string,
  context: ElementActionContext = {},
): ElementActionResult {
  if (actionId === 'deselect') {
    kernel.clearSelection();
    return { ok: true, announcement: 'Selection cleared' };
  }
  if (!(ELEMENT_ACTION_IDS as readonly string[]).includes(actionId)) {
    return { ok: false, announcement: `Unknown element action "${actionId}"` };
  }
  const id = actionId as ElementActionId;
  const live = liveTargets(kernel, targets);
  const gate = gatesFor(live, context)[id];
  if (!gate.enabled) {
    return { ok: false, announcement: gate.reason };
  }
  const primary = live[0];
  /* v8 ignore next 3 -- every gate but deselect is closed without a target. */
  if (primary === undefined) {
    return { ok: false, announcement: 'No element is selected' };
  }
  const subject = subjectOf(live);
  const { nodeId, path } = primary.target;
  const refused = (message: string): ElementActionResult => ({ ok: false, announcement: message });

  switch (id) {
    case 'selectParent': {
      const parent = parentPath(path);
      if (parent.length === 0) {
        kernel.clearElementFocus();
        return { ok: true, announcement: 'Selected the region' };
      }
      kernel.focusElement(nodeId, parent);
      const parentNode = customCodeElementAt(kernel, nodeId, parent)?.element;
      return {
        ok: true,
        announcement: `Selected ${parentNode === undefined ? 'parent' : treeNodeDisplayName(parentNode)}`,
      };
    }
    case 'delete': {
      const steps = descending(live).map((entry) => ({
        command: 'removeTreeNode',
        args: { id: entry.target.nodeId, path: [...entry.target.path] },
      }));
      const survivor = live.length === 1 ? survivorAfterDelete(primary) : null;
      const result = dispatch(kernel, steps, `Delete · ${subject}`, context);
      if (!result.ok) return refused(result.message);
      focus(kernel, survivor, nodeId);
      return { ok: true, announcement: `Deleted ${subject}` };
    }
    case 'duplicate': {
      const ordered = descending(live);
      const steps = ordered.map((entry) => ({
        command: 'duplicateTreeNode',
        args: { id: entry.target.nodeId, path: [...entry.target.path] },
      }));
      // The primary's copy sits right after it; copies of EARLIER targets in
      // the same region shift it later still.
      let copy: CustomCodePath = [...parentPath(path), (path.at(-1) ?? 0) + 1];
      for (const entry of ordered) {
        if (entry === primary || entry.target.nodeId !== nodeId) continue;
        const inserted = [
          ...parentPath(entry.target.path),
          (entry.target.path.at(-1) ?? 0) + 1,
        ];
        if (comparePaths(entry.target.path, path) < 0) copy = shiftAfterInsert(copy, inserted);
      }
      const result = dispatch(kernel, steps, `Duplicate · ${subject}`, context);
      if (!result.ok) return refused(result.message);
      kernel.focusElement(nodeId, copy);
      return { ok: true, announcement: `Duplicated ${subject}` };
    }
    case 'moveEarlier':
    case 'moveLater': {
      const index = path.at(-1) ?? 0;
      const toIndex = id === 'moveEarlier' ? index - 1 : index + 1;
      const result = dispatch(
        kernel,
        [
          {
            command: 'moveTreeNode',
            args: { id: nodeId, from: [...path], to: { parent: parentPath(path), index: toIndex } },
          },
        ],
        `${LABELS[id]} · ${subject}`,
        context,
      );
      if (!result.ok) return refused(result.message);
      kernel.focusElement(nodeId, [...parentPath(path), toIndex]);
      return {
        ok: true,
        announcement: `Moved ${subject} ${id === 'moveEarlier' ? 'earlier' : 'later'}`,
      };
    }
    case 'wrap': {
      const paths = live
        .map((entry) => [...entry.target.path])
        .sort((a, b) => comparePaths(a, b));
      const first = paths[0] ?? path;
      const result = dispatch(
        kernel,
        [{ command: 'wrapTreeNode', args: { id: nodeId, paths, wrapper: { tag: 'div' } } }],
        `Wrap · ${subject}`,
        context,
      );
      if (!result.ok) return refused(result.message);
      kernel.focusElement(nodeId, first);
      return { ok: true, announcement: `Wrapped ${subject} in a container` };
    }
    case 'unwrap': {
      const result = dispatch(
        kernel,
        [{ command: 'unwrapTreeNode', args: { id: nodeId, path: [...path] } }],
        `Unwrap · ${subject}`,
        context,
      );
      if (!result.ok) return refused(result.message);
      kernel.focusElement(nodeId, path);
      return { ok: true, announcement: `Unwrapped ${subject}` };
    }
    case 'copyStyle': {
      const classes = extractStyleClasses(classNameOf(primary.node));
      context.styleClipboard?.write(classes);
      return {
        ok: true,
        announcement: classes === '' ? `${subject} has no style to copy` : `Copied the style of ${subject}`,
      };
    }
    case 'pasteStyle': {
      const copied = context.styleClipboard?.read() ?? '';
      const steps = live
        .filter((entry) => entry.node.kind !== 'component')
        .map((entry) => ({
          command: 'patchTreeNode',
          args: {
            id: entry.target.nodeId,
            path: [...entry.target.path],
            set: { className: pasteStyleClasses(classNameOf(entry.node), copied) },
          },
        }));
      const result = dispatch(kernel, steps, `Paste style · ${subject}`, context);
      if (!result.ok) return refused(result.message);
      return { ok: true, announcement: `Pasted the style onto ${subject}` };
    }
    case 'saveTemplate': {
      context.onSaveTemplate?.(primary.target);
      return { ok: true, announcement: `Saving ${subject} as a template` };
    }
    case 'animate': {
      context.onAnimate?.(primary.target);
      return { ok: true, announcement: `Animation for ${subject}` };
    }
    case 'hideOnBucket': {
      const bucket = context.bucket ?? 'base';
      const hidden = hiddenHere(live, bucket);
      const steps: GroupStep[] = [];
      for (const entry of live) {
        const next = applyStyleIntents(
          classNameOf(entry.node),
          [
            {
              property: 'display',
              value: hidden ? null : { kind: 'keyword', keyword: 'none' },
              bucket,
              state: 'default',
            },
          ],
          { mode: 'free' },
        );
        if (!next.ok) return refused(next.message);
        steps.push({
          command: 'patchTreeNode',
          args: {
            id: entry.target.nodeId,
            path: [...entry.target.path],
            set: { className: next.className === '' ? null : next.className },
          },
        });
      }
      const verb = hidden ? 'Show' : 'Hide';
      const result = dispatch(kernel, steps, `${verb} on ${bucketWord(bucket)} · ${subject}`, context);
      if (!result.ok) return refused(result.message);
      return {
        ok: true,
        announcement: `${hidden ? 'Shown' : 'Hidden'} ${subject} on ${bucketWord(bucket)}`,
      };
    }
    /* v8 ignore next 2 -- every id is handled above; deselect returned first. */
    default:
      return { ok: false, announcement: `Unknown element action "${actionId}"` };
  }
}
