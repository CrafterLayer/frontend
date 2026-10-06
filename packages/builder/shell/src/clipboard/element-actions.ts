import type { BuilderKernel, GroupStep } from '@craftkit/builder-core';
import {
  applyStyleIntents,
  readStyle,
  type Author,
  type CustomCodeNode,
  type CustomCodePath,
  type NodeId,
  type StyleBucket,
} from '@craftkit/builder-schema';

import {
  ELEMENT_NAME_WORDS_EN,
  elementTargetKey,
  resolveElementTarget,
  tryDispatchTreeEdits,
  type ElementNameWords,
  type ElementTarget,
  type ResolvedTreeTarget,
} from '../custom-code/element-target';
import { performMoveAction } from '../keyboard/move-actions';
import { ELEMENT_ACTION_LABELS_EN, type ElementActionLabels } from './element-actions.labels';

/*
  ── Element actions (style-manager DESIGN.md §E) ────────────────────────────

  The verbs the Layers context menu, the keyboard map and the canvas share:
  duplicate, delete, wrap, unwrap, move earlier/later, hide, lock, rename,
  select parent / first child. Every write is ONE labelled transaction through
  the tree commands ("Duplicate · Heading “Our story”"), so each is one Undo,
  and a refusal comes back as a message to announce, never a throw.

  Multi-selection: the actions that make sense on a set (duplicate, delete,
  hide, lock, wrap of contiguous siblings) act on every live target; the rest
  act on the primary (`targets[0]`).
*/

export interface ElementActionContext {
  readonly kernel: BuilderKernel;
  /** Primary first — `ElementSelection.targets()`. */
  readonly targets: readonly ElementTarget[];
  readonly labels?: ElementActionLabels | undefined;
  readonly words?: ElementNameWords | undefined;
  readonly author?: Author | undefined;
}

export interface ElementActionOutcome {
  readonly ok: boolean;
  /** What to announce: the history label on success, the reason on refusal. */
  readonly message: string;
}

const PATH_ORDER = (a: CustomCodePath, b: CustomCodePath): number => {
  const length = Math.min(a.length, b.length);
  for (let at = 0; at < length; at += 1) {
    const delta = (a[at] ?? 0) - (b[at] ?? 0);
    if (delta !== 0) return delta;
  }
  return a.length - b.length;
};

function isAncestorPath(ancestor: CustomCodePath, path: CustomCodePath): boolean {
  return ancestor.length < path.length && ancestor.every((value, at) => path[at] === value);
}

function labelsOf(context: ElementActionContext): ElementActionLabels {
  return context.labels ?? ELEMENT_ACTION_LABELS_EN;
}

/** Live tree targets, deduplicated, with targets inside another selected target dropped. */
export function liveTreeTargets(
  kernel: BuilderKernel,
  targets: readonly ElementTarget[],
  words: ElementNameWords = ELEMENT_NAME_WORDS_EN,
): ResolvedTreeTarget[] {
  const seen = new Set<string>();
  const resolved: ResolvedTreeTarget[] = [];
  for (const target of targets) {
    if (target.kind !== 'tree') continue;
    const key = elementTargetKey(target);
    if (seen.has(key)) continue;
    seen.add(key);
    const found = resolveElementTarget(kernel, target, words);
    if (found?.kind === 'tree') resolved.push(found);
  }
  return resolved.filter(
    (candidate) =>
      !resolved.some(
        (other) =>
          other !== candidate &&
          other.target.nodeId === candidate.target.nodeId &&
          isAncestorPath(other.target.path, candidate.target.path),
      ),
  );
}

/** Reverse document order inside each region: earlier paths stay valid while later ones change. */
function reverseDocumentOrder(targets: readonly ResolvedTreeTarget[]): ResolvedTreeTarget[] {
  return [...targets].sort((a, b) =>
    a.target.nodeId === b.target.nodeId
      ? PATH_ORDER(b.target.path, a.target.path)
      : a.target.nodeId.localeCompare(b.target.nodeId),
  );
}

function subjectOf(context: ElementActionContext, resolvedNames: readonly string[]): string {
  if (resolvedNames.length === 1) return resolvedNames[0] ?? '';
  return labelsOf(context).count(resolvedNames.length);
}

function commit(
  context: ElementActionContext,
  steps: readonly GroupStep[],
  verb: string,
  subject: string,
): ElementActionOutcome {
  const labels = labelsOf(context);
  const label = `${verb} · ${subject}`;
  const result = tryDispatchTreeEdits(context.kernel, steps, label, context.author ?? 'user');
  return result.ok
    ? { ok: true, message: labels.done(label) }
    : { ok: false, message: labels.refused(verb, result.message) };
}

function refuse(message: string): ElementActionOutcome {
  return { ok: false, message };
}

function blockSubject(context: ElementActionContext, ids: readonly NodeId[]): string {
  if (ids.length !== 1) return labelsOf(context).count(ids.length);
  const id = ids[0] ?? '';
  return resolveElementTarget(context.kernel, { kind: 'block', nodeId: id }, context.words)?.displayName ?? id;
}

function liveBlockTargets(kernel: BuilderKernel, targets: readonly ElementTarget[]): NodeId[] {
  const doc = kernel.getDocument();
  const ids = targets
    .filter((target): target is Extract<ElementTarget, { kind: 'block' }> => target.kind === 'block')
    .map((target) => target.nodeId)
    .filter((id) => doc.nodes[id] !== undefined && id !== doc.rootId);
  return [...new Set(ids)];
}

/** Duplicate every target (the copy lands right after its original). */
export function duplicateElements(context: ElementActionContext): ElementActionOutcome {
  const { kernel } = context;
  const labels = labelsOf(context);
  const trees = liveTreeTargets(kernel, context.targets, context.words);
  if (trees.length > 0) {
    const steps = reverseDocumentOrder(trees).map(
      (target): GroupStep => ({
        command: 'duplicateTreeNode',
        args: { id: target.target.nodeId, path: [...target.target.path] },
      }),
    );
    const outcome = commit(context, steps, labels.duplicate, subjectOf(context, trees.map((t) => t.displayName)));
    const only = trees.length === 1 ? trees[0] : undefined;
    if (outcome.ok && only !== undefined) {
      const path = only.target.path;
      kernel.focusElement(only.target.nodeId, [...path.slice(0, -1), (path.at(-1) ?? 0) + 1]);
    }
    return outcome;
  }
  const blocks = liveBlockTargets(kernel, context.targets);
  if (blocks.length === 0) return refuse(labels.nothingSelected);
  return commit(
    context,
    blocks.map((id): GroupStep => ({ command: 'duplicateNode', args: { id } })),
    labels.duplicate,
    blockSubject(context, blocks),
  );
}

/** Delete every target; the selection falls back to the region (or clears for blocks). */
export function deleteElements(context: ElementActionContext, verb?: string): ElementActionOutcome {
  const { kernel } = context;
  const labels = labelsOf(context);
  const trees = liveTreeTargets(kernel, context.targets, context.words);
  if (trees.length > 0) {
    const steps = reverseDocumentOrder(trees).map(
      (target): GroupStep => ({
        command: 'removeTreeNode',
        args: { id: target.target.nodeId, path: [...target.target.path] },
      }),
    );
    const outcome = commit(context, steps, verb ?? labels.delete, subjectOf(context, trees.map((t) => t.displayName)));
    const region = trees[0]?.target.nodeId;
    if (outcome.ok && region !== undefined) kernel.setSelection([region]);
    return outcome;
  }
  const blocks = liveBlockTargets(kernel, context.targets);
  if (blocks.length === 0) return refuse(labels.nothingSelected);
  const outcome = commit(
    context,
    blocks.map((id): GroupStep => ({ command: 'removeNode', args: { id } })),
    verb ?? labels.delete,
    blockSubject(context, blocks),
  );
  if (outcome.ok) kernel.clearSelection();
  return outcome;
}

/** Whether every path is a sibling of the others and together they form one run. */
function contiguousSiblings(paths: readonly CustomCodePath[]): boolean {
  if (paths.length < 2) return true;
  const sorted = [...paths].sort(PATH_ORDER);
  const parent = sorted[0]?.slice(0, -1) ?? [];
  return sorted.every((path, at) => {
    const sameParent = path.length === parent.length + 1 && parent.every((value, i) => path[i] === value);
    return sameParent && (path.at(-1) ?? 0) === (sorted[0]?.at(-1) ?? 0) + at;
  });
}

/**
 * Wrap the targets in a new container. A set of contiguous siblings in one
 * region is wrapped together; otherwise only the primary is.
 */
export function wrapElements(
  context: ElementActionContext,
  wrapper: { readonly tag: string; readonly className?: string } = { tag: 'div' },
): ElementActionOutcome {
  const { kernel } = context;
  const labels = labelsOf(context);
  const trees = liveTreeTargets(kernel, context.targets, context.words);
  const primary = trees[0];
  if (primary === undefined) return refuse(labels.notAnElement);
  const together = trees.filter((target) => target.target.nodeId === primary.target.nodeId);
  const group =
    together.length === trees.length && contiguousSiblings(together.map((t) => t.target.path)) ? together : [primary];
  const paths = group.map((target) => [...target.target.path]).sort(PATH_ORDER);
  const outcome = commit(
    context,
    [{ command: 'wrapTreeNode', args: { id: primary.target.nodeId, paths, wrapper: { ...wrapper } } }],
    labels.wrap,
    subjectOf(context, group.map((t) => t.displayName)),
  );
  const first = paths[0];
  if (outcome.ok && first !== undefined) kernel.focusElement(primary.target.nodeId, first);
  return outcome;
}

/** Replace the primary container by its children. */
export function unwrapElement(context: ElementActionContext): ElementActionOutcome {
  const { kernel } = context;
  const labels = labelsOf(context);
  const primary = liveTreeTargets(kernel, context.targets.slice(0, 1), context.words)[0];
  if (primary === undefined) return refuse(labels.notAnElement);
  const outcome = commit(
    context,
    [{ command: 'unwrapTreeNode', args: { id: primary.target.nodeId, path: [...primary.target.path] } }],
    labels.unwrap,
    primary.displayName,
  );
  if (outcome.ok) {
    const path = primary.target.path;
    const childCount = primary.node.kind === 'icon' ? 0 : (primary.node.children?.length ?? 0);
    if (childCount > 0) kernel.focusElement(primary.target.nodeId, [...path]);
    else kernel.setSelection([primary.target.nodeId]);
  }
  return outcome;
}

function siblingsOf(target: ResolvedTreeTarget): readonly CustomCodeNode[] {
  const parentPath = target.target.path.slice(0, -1);
  let children: readonly CustomCodeNode[] = target.tree.children;
  for (const index of parentPath) {
    const next = children[index];
    if (next === undefined || next.kind === 'icon') return [];
    children = next.children ?? [];
  }
  return children;
}

/** Alt+↑ / Alt+↓: one step among the siblings (blocks use the canvas's own move rule). */
export function moveElement(context: ElementActionContext, direction: 'earlier' | 'later'): ElementActionOutcome {
  const { kernel } = context;
  const labels = labelsOf(context);
  const first = context.targets[0];
  if (first === undefined) return refuse(labels.nothingSelected);
  if (first.kind === 'block') {
    const message = performMoveAction(kernel, first.nodeId, direction === 'earlier' ? 'up' : 'down');
    return { ok: true, message };
  }
  const primary = liveTreeTargets(kernel, [first], context.words)[0];
  if (primary === undefined) return refuse(labels.nothingSelected);
  const path = primary.target.path;
  const index = path.at(-1) ?? 0;
  const last = siblingsOf(primary).length - 1;
  const nextIndex = direction === 'earlier' ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex > last) return refuse(labels.cannotMove);
  const parent = path.slice(0, -1);
  const outcome = commit(
    context,
    [
      {
        command: 'moveTreeNode',
        args: { id: primary.target.nodeId, from: [...path], to: { parent, index: nextIndex } },
      },
    ],
    direction === 'earlier' ? labels.moveEarlier : labels.moveLater,
    primary.displayName,
  );
  if (outcome.ok) kernel.focusElement(primary.target.nodeId, [...parent, nextIndex]);
  return outcome;
}

export interface HiddenState {
  readonly hidden: boolean;
  /** `here` when this bucket hides it; `inherited` when a wider screen does. */
  readonly source: 'here' | 'inherited' | 'none';
}

/** Whether a className hides its element at a bucket (the `display: none` family). */
export function hiddenStateAt(className: string | undefined, bucket: StyleBucket): HiddenState {
  const display = readStyle(className ?? '', { bucket, state: 'default' }).get('display');
  if (display?.value.kind !== 'keyword' || display.value.keyword !== 'none') {
    return { hidden: false, source: 'none' };
  }
  return { hidden: true, source: display.source === 'here' ? 'here' : 'inherited' };
}

function classNameOf(node: CustomCodeNode): string | undefined {
  return node.kind === 'component' ? undefined : node.className;
}

/**
 * Hide or show at the CURRENT bucket (desktop-first: base, tablet, mobile).
 * The primary decides the direction; every target follows it, in one group.
 */
export function toggleElementsHidden(context: ElementActionContext, bucket: StyleBucket): ElementActionOutcome {
  const { kernel } = context;
  const labels = labelsOf(context);
  const trees = liveTreeTargets(kernel, context.targets, context.words).filter(
    (target) => target.node.kind !== 'component',
  );
  const primary = trees[0];
  if (primary === undefined) return refuse(labels.notAnElement);
  const hide = !hiddenStateAt(classNameOf(primary.node), bucket).hidden;
  const steps: GroupStep[] = [];
  for (const target of trees) {
    const current = classNameOf(target.node) ?? '';
    const state = hiddenStateAt(current, bucket);
    if (state.hidden === hide) continue;
    const result = applyStyleIntents(
      current,
      [
        {
          property: 'display',
          bucket,
          state: 'default',
          // Showing: drop this bucket's `hidden`; when a wider screen hides it,
          // this bucket says `block` so it shows here only.
          value: hide
            ? { kind: 'keyword', keyword: 'none' }
            : state.source === 'here'
              ? null
              : { kind: 'keyword', keyword: 'block' },
        },
      ],
      { mode: 'free' },
    );
    if (!result.ok) return refuse(labels.refused(hide ? labels.hide : labels.show, result.message));
    steps.push({
      command: 'patchTreeNode',
      args: {
        id: target.target.nodeId,
        path: [...target.target.path],
        set: { className: result.className === '' ? null : result.className },
      },
    });
  }
  if (steps.length === 0) return { ok: true, message: '' };
  return commit(context, steps, hide ? labels.hide : labels.show, subjectOf(context, trees.map((t) => t.displayName)));
}

/** Lock or unlock (editor metadata, never rendered); the primary decides the direction. */
export function toggleElementsLocked(context: ElementActionContext): ElementActionOutcome {
  const { kernel } = context;
  const labels = labelsOf(context);
  const trees = liveTreeTargets(kernel, context.targets, context.words);
  const primary = trees[0];
  if (primary === undefined) return refuse(labels.notAnElement);
  const lock = primary.node.locked !== true;
  const steps = trees
    .filter((target) => (target.node.locked === true) !== lock)
    .map(
      (target): GroupStep => ({
        command: 'patchTreeNode',
        args: { id: target.target.nodeId, path: [...target.target.path], set: { locked: lock } },
      }),
    );
  return commit(context, steps, lock ? labels.lock : labels.unlock, subjectOf(context, trees.map((t) => t.displayName)));
}

/** Write the Layers name (`label`, ≤ 60); an empty name clears it. Icons keep their accessible name. */
export function renameElement(
  context: ElementActionContext,
  target: ElementTarget,
  name: string,
): ElementActionOutcome {
  const labels = labelsOf(context);
  const resolved = liveTreeTargets(context.kernel, [target], context.words)[0];
  if (resolved === undefined || resolved.node.kind === 'icon') return refuse(labels.notAnElement);
  const trimmed = name.replace(/\s+/gu, ' ').trim().slice(0, 60);
  const current = resolved.node.label ?? '';
  if (trimmed === current) return { ok: true, message: '' };
  return commit(
    context,
    [
      {
        command: 'patchTreeNode',
        args: {
          id: resolved.target.nodeId,
          path: [...resolved.target.path],
          set: { label: trimmed === '' ? null : trimmed },
        },
      },
    ],
    labels.rename,
    trimmed === '' ? resolved.displayName : trimmed,
  );
}

/** Shift+Enter: the parent element, or the region itself from a top-level element. */
export function selectParentElement(kernel: BuilderKernel, target: ElementTarget | undefined): boolean {
  if (target?.kind !== 'tree') return false;
  if (target.path.length <= 1) {
    kernel.setSelection([target.nodeId]);
    return true;
  }
  kernel.focusElement(target.nodeId, target.path.slice(0, -1));
  return true;
}

/** Enter: the first child element (a region's first top-level element). */
export function selectFirstChildElement(kernel: BuilderKernel, target: ElementTarget | undefined): boolean {
  if (target === undefined) return false;
  if (target.kind === 'block') {
    const found = resolveElementTarget(kernel, { kind: 'tree', nodeId: target.nodeId, path: [0] });
    if (found === undefined) return false;
    kernel.focusElement(target.nodeId, [0]);
    return true;
  }
  const resolved = resolveElementTarget(kernel, target);
  if (resolved?.kind !== 'tree' || resolved.node.kind === 'icon') return false;
  if ((resolved.node.children?.length ?? 0) === 0) return false;
  kernel.focusElement(target.nodeId, [...target.path, 0]);
  return true;
}
