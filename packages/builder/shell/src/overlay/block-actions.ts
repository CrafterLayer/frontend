import { insertedNodeId, type BuilderKernel } from '@craftkit/builder-core';
import type { NodeId, SlotName } from '@craftkit/builder-schema';

import { customCodeElementAt } from '../custom-code/element-at';
import { blockDisplayName } from '../naming/block-display-name';
import { seatOf } from './drop-resolver';
import {
  performElementAction,
  resolveElementActions,
  type ElementActionId,
  type TreeTarget,
} from './element-actions';
import { inlineTargetOf } from './inline-session';

/**
 * Block action bar logic (009 contract §6) — pure kernel arithmetic, no React,
 * no DOM. `resolveBlockActions` says what is VALID for a node; an action that
 * cannot apply (delete on the root, move at an edge, duplicate into a full
 * slot) is reported DISABLED here and refused in `performBlockAction`, so it
 * never becomes a door failure (a3, US3/AC3). Every successful structural
 * `performBlockAction` call is EXACTLY one kernel dispatch, announced, with the
 * resulting selection defined (a2, US3/AC2): the duplicate, the surviving
 * sibling (or the parent when none remains), or the moved node. Edit text is
 * explicitly refused here because the canvas opens that view state directly.
 * Select parent and Deselect are selection-only: zero dispatches, never undo.
 */

type StructuralBlockActionId = 'duplicate' | 'delete' | 'moveEarlier' | 'moveLater';
export type BlockActionId =
  | StructuralBlockActionId
  | 'editText'
  | 'selectParent'
  | 'deselect'
  // gsap-pixi additions (2026-10-08): opens the block's Design › Motion control (the host does it).
  | 'animate';

export interface BlockAction {
  id: BlockActionId;
  label: string;
  enabled: boolean;
  /**
   * A keyboard shortcut the POINTER may be shown beside the label ("Esc").
   * Never part of the accessible name — one label, two surfaces.
   */
  hint?: string;
}

export interface BlockActionResult {
  ok: boolean;
  /** For the canvas's polite region — every outcome is announced (a2). */
  announcement: string;
  /** The node the selection should land on afterwards; null when none makes sense. */
  selection: NodeId | null;
}

const ACTION_ORDER: readonly StructuralBlockActionId[] = [
  'duplicate',
  'delete',
  'moveEarlier',
  'moveLater',
];

const ACTION_LABELS: Record<StructuralBlockActionId, string> = {
  duplicate: 'Duplicate',
  delete: 'Delete',
  moveEarlier: 'Move earlier',
  moveLater: 'Move later',
};

const isStructuralBlockActionId = (value: string): value is StructuralBlockActionId =>
  value === 'duplicate' || value === 'delete' || value === 'moveEarlier' || value === 'moveLater';

/*
  Deselect comes LAST and is never disabled.

  The owner's words: "when I select blocks there is no option to clear the
  selection". Clicking the page background selects the ROOT on purpose (its
  props live in the inspector), so even the root — which can be none of the
  structural things — must offer a way out. Escape does the same from the
  keyboard, which is the one hint the bar shows.
*/
const DESELECT_ACTION: BlockAction = {
  id: 'deselect',
  label: 'Deselect',
  enabled: true,
  hint: 'Esc',
};

/** Closed gates carry the reason — it doubles as the refusal announcement. */
type Gate = { enabled: true } | { enabled: false; reason: string };

const OPEN: Gate = { enabled: true };

interface ActionPlan {
  gates: Record<StructuralBlockActionId, Gate>;
  seat: { parentId: NodeId; slot: SlotName; index: number } | undefined;
  siblings: readonly NodeId[];
}

/**
 * One derivation feeds BOTH the resolve and the perform paths, so a disabled
 * button and a refused perform can never disagree — and each closed gate is a
 * case the door would genuinely reject (proven by the forced-dispatch tests).
 */
function planFor(kernel: BuilderKernel, nodeId: NodeId): ActionPlan {
  const doc = kernel.getDocument();
  const seat = seatOf(doc, nodeId);
  if (seat === undefined) {
    // The document root (or an unplaced node): every structural action is a
    // door error by law — requireNonRoot / findMembership reject them all.
    const subject = nodeId === doc.rootId ? 'the document root' : 'an unplaced block';
    return {
      seat,
      siblings: [],
      gates: {
        duplicate: { enabled: false, reason: `Cannot duplicate ${subject}` },
        delete: { enabled: false, reason: `Cannot delete ${subject}` },
        moveEarlier: { enabled: false, reason: `Cannot move ${subject}` },
        moveLater: { enabled: false, reason: `Cannot move ${subject}` },
      },
    };
  }
  const siblings = doc.nodes[seat.parentId]?.slots?.[seat.slot] ?? [];
  // duplicateNode inserts a clone beside the origin — a full slot (max) is the
  // one legal placement it can still be refused for.
  const parentType = doc.nodes[seat.parentId]?.type ?? '';
  const max = kernel.context.registry.block(parentType)?.schema.slots?.[seat.slot]?.max;
  const slotFull = max !== undefined && siblings.length + 1 > max;
  return {
    seat,
    siblings,
    gates: {
      duplicate: slotFull
        ? { enabled: false, reason: `Cannot duplicate: slot "${seat.slot}" is full` }
        : OPEN,
      delete: OPEN,
      moveEarlier: seat.index === 0 ? { enabled: false, reason: 'Already first' } : OPEN,
      moveLater:
        seat.index === siblings.length - 1 ? { enabled: false, reason: 'Already last' } : OPEN,
    },
  };
}

/*
  ── Element focus wins (style-manager DESIGN.md §A.6, P7) ──────────────────

  The region bug: with an element focused INSIDE a custom-code region, the
  canvas still resolved and performed actions for the selected NODE — so
  Delete removed the whole region when the person meant the headline they had
  clicked. Both entry points now ask first whether the node's focus names a
  live element, and if so every structural action is the element's tree
  command (removeTreeNode, duplicateTreeNode, moveTreeNode). A stale focus
  (the element vanished) falls back to the region, as every reader must.
*/
function focusedElementOf(kernel: BuilderKernel, nodeId: NodeId): TreeTarget | undefined {
  const focus = kernel.context.store.getState().elementFocus;
  if (focus?.id !== nodeId) return undefined;
  if (customCodeElementAt(kernel, nodeId, focus.path) === undefined) return undefined;
  return { kind: 'tree', nodeId, path: [...focus.path] };
}

const ELEMENT_EQUIVALENT: Readonly<Partial<Record<BlockActionId, ElementActionId>>> = {
  selectParent: 'selectParent',
  duplicate: 'duplicate',
  delete: 'delete',
  moveEarlier: 'moveEarlier',
  moveLater: 'moveLater',
  deselect: 'deselect',
};

function elementBlockActions(kernel: BuilderKernel, target: TreeTarget): BlockAction[] {
  const byId = new Map(resolveElementActions(kernel, [target]).map((action) => [action.id, action]));
  const ids: readonly BlockActionId[] = [
    'selectParent',
    'duplicate',
    'delete',
    'moveEarlier',
    'moveLater',
    'deselect',
  ];
  return ids.map((id) => {
    const element = byId.get(ELEMENT_EQUIVALENT[id] ?? 'deselect');
    return id === 'deselect'
      ? DESELECT_ACTION
      : { id, label: element?.label ?? id, enabled: element?.enabled === true };
  });
}

// gsap-pixi additions (2026-10-08)
/** The "Animate" action's name in the editor's language. */
export const BLOCK_ANIMATE_LABELS: Readonly<Record<'en' | 'ar', string>> = { en: 'Animate', ar: 'تحريك' };

export interface BlockActionOptions {
  /**
   * The host can open the block's Design › Motion control: offer "Animate"
   * (in this language) on a block that declares a `kind: 'motion'` property.
   */
  readonly animate?: { readonly locale: 'en' | 'ar' } | undefined;
}

/** The prop a registered block keeps its motion in (`propertyGroups[key].kind === 'motion'`), if any. */
export function blockMotionProperty(kernel: BuilderKernel, nodeId: NodeId): string | undefined {
  const type = kernel.getDocument().nodes[nodeId]?.type;
  const groups = type === undefined ? undefined : kernel.context.registry.block(type)?.schema.propertyGroups;
  if (groups === undefined) return undefined;
  const found = Object.entries(groups as Readonly<Record<string, { readonly kind?: string } | undefined>>).find(
    ([, group]) => group?.kind === 'motion',
  );
  return found?.[0];
}
// ── end gsap-pixi additions ──

/**
 * The ordered action list for THAT node: Select parent, the four structural
 * actions, Edit text when the block declares an inline target, Animate when
 * the host asks for it and the block has a motion control, and Deselect
 * last. Structural actions keep stable seats and become disabled when
 * unavailable (a3); Edit text is absent when undeclared because there is no
 * session the canvas could open. A node that no longer exists resolves to no
 * actions at all.
 */
export function resolveBlockActions(
  kernel: BuilderKernel,
  nodeId: NodeId,
  options: BlockActionOptions = {},
): BlockAction[] {
  if (kernel.getDocument().nodes[nodeId] === undefined) {
    return [];
  }
  const element = focusedElementOf(kernel, nodeId);
  if (element !== undefined) {
    return elementBlockActions(kernel, element);
  }
  const { gates, seat } = planFor(kernel, nodeId);
  /*
    Select parent comes FIRST, and changes no document at all.

    Blocks nest — a link row inside a header's `end` slot inside the page — and
    once they do, the commonest thing a person needs is to step OUT of what
    they clicked into. Clicking the parent on the canvas is often impossible:
    the child covers it. GrapesJS puts this control first in its element
    toolbar for exactly that reason.

    It is disabled on the document root, which has no parent to step to.
  */
  const parentAction: BlockAction[] = [
    { id: 'selectParent', label: 'Select parent', enabled: seat !== undefined },
  ];
  const structural: BlockAction[] = ACTION_ORDER.map((id) => ({
    id,
    label: ACTION_LABELS[id],
    enabled: gates[id].enabled,
  }));
  const actions = [...parentAction, ...structural];
  const withEditText: BlockAction[] =
    inlineTargetOf(kernel, nodeId) === null
      ? actions
      : [...actions, { id: 'editText', label: 'Edit text', enabled: true }];
  // gsap-pixi additions (2026-10-08): Cinematic motion / Animated background for the whole section.
  const animate: BlockAction[] =
    options.animate !== undefined && blockMotionProperty(kernel, nodeId) !== undefined
      ? [{ id: 'animate', label: BLOCK_ANIMATE_LABELS[options.animate.locale], enabled: true }]
      : [];
  return [...withEditText, ...animate, DESELECT_ACTION];
}

/**
 * Perform one structural action as EXACTLY ONE kernel dispatch (a2). The gate
 * is re-checked at call time from live document truth — a stale bar can press
 * a button the document has since outgrown, and the answer is a refusal with a
 * reason, never a door failure. Edit text and unknown ids are refused with no
 * dispatch. The resulting structural selection is applied to the kernel, so
 * callers and tests read one truth.
 */
export function performBlockAction(
  kernel: BuilderKernel,
  nodeId: NodeId,
  actionId: string,
): BlockActionResult {
  const element = focusedElementOf(kernel, nodeId);
  const equivalent = ELEMENT_EQUIVALENT[actionId as BlockActionId];
  if (element !== undefined && equivalent !== undefined && actionId !== 'deselect') {
    const result = performElementAction(kernel, [element], equivalent);
    return { ok: result.ok, announcement: result.announcement, selection: nodeId };
  }
  if (actionId === 'deselect') {
    /*
      Selection-only, like select parent: no dispatch, nothing to undo. Not
      gated on the node still existing either — a stale bar pressing Deselect
      after its block vanished wants exactly this outcome. The kernel's own
      door, so the canvas live region and the inspector hear the same write.
    */
    kernel.clearSelection();
    return { ok: true, announcement: 'Selection cleared', selection: null };
  }
  if (actionId === 'selectParent') {
    /*
      Selection-only: no dispatch, no transaction, nothing to undo. Stepping to
      a parent is navigation, and putting it in the history would make Undo mean
      two different things depending on what you last did.
    */
    const doc = kernel.getDocument();
    if (doc.nodes[nodeId] === undefined) {
      return { ok: false, announcement: 'The block no longer exists', selection: null };
    }
    const seat = seatOf(doc, nodeId);
    if (seat === undefined) {
      return { ok: false, announcement: 'Already at the outermost block', selection: nodeId };
    }
    kernel.setSelection([seat.parentId]);
    return {
      ok: true,
      announcement: `Selected ${blockDisplayName(kernel, seat.parentId)}`,
      selection: seat.parentId,
    };
  }
  if (actionId === 'editText') {
    return {
      ok: false,
      announcement: 'Edit text must be opened by the canvas',
      selection: kernel.getDocument().nodes[nodeId] === undefined ? null : nodeId,
    };
  }
  // gsap-pixi additions (2026-10-08): a panel to open, not a document write.
  if (actionId === 'animate') {
    return {
      ok: false,
      announcement: 'Animate must be opened by the host',
      selection: kernel.getDocument().nodes[nodeId] === undefined ? null : nodeId,
    };
  }
  if (!isStructuralBlockActionId(actionId)) {
    return { ok: false, announcement: `Unknown block action "${actionId}"`, selection: null };
  }
  const doc = kernel.getDocument();
  if (doc.nodes[nodeId] === undefined) {
    return { ok: false, announcement: 'The block no longer exists', selection: null };
  }
  const plan = planFor(kernel, nodeId);
  const gate = plan.gates[actionId];
  if (!gate.enabled) {
    return { ok: false, announcement: gate.reason, selection: nodeId };
  }
  /* v8 ignore next 3 -- without a seat every gate above is closed. */
  if (plan.seat === undefined) {
    return { ok: false, announcement: 'The block has no place in the document', selection: nodeId };
  }
  const { seat, siblings } = plan;
  const label = blockDisplayName(kernel, nodeId);

  const select = (id: NodeId): NodeId => {
    kernel.setSelection([id]);
    return id;
  };

  switch (actionId) {
    case 'duplicate': {
      const tx = kernel.dispatch('duplicateNode', { id: nodeId });
      // The clone's id is read from the transaction, exactly as the drop path
      // does — the first added node is the clone's subtree root.
      const clone = insertedNodeId(tx.patches) ?? nodeId;
      return { ok: true, announcement: `Duplicated ${label}`, selection: select(clone) };
    }
    case 'delete': {
      // The survivor is decided BEFORE the dispatch, from the same order the
      // user sees: the sibling that takes the seat, else the new last sibling,
      // else the parent when the slot empties (US3/AC2).
      const survivors = siblings.filter((id) => id !== nodeId);
      const survivor = survivors[Math.min(seat.index, survivors.length - 1)] ?? seat.parentId;
      kernel.dispatch('removeNode', { id: nodeId });
      return { ok: true, announcement: `Deleted ${label}`, selection: select(survivor) };
    }
    case 'moveEarlier':
    case 'moveLater': {
      const toIndex = actionId === 'moveEarlier' ? seat.index - 1 : seat.index + 1;
      kernel.dispatch('moveNode', {
        id: nodeId,
        toParentId: seat.parentId,
        toSlot: seat.slot,
        toIndex,
      });
      return {
        ok: true,
        announcement: `Moved ${label} ${actionId === 'moveEarlier' ? 'earlier' : 'later'}`,
        selection: select(nodeId),
      };
    }
  }
}
