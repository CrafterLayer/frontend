import type { BuilderKernel } from '@craftkit/builder-core';
import {
  bindPathOf,
  blockPartsOf,
  getAtPropPath,
  partStyleKey,
  partStylesKeyOf,
  planPartDir,
  planPartListOp,
  propSchemaAt,
  readPartStyles,
  type BlockPartDecl,
  type BlockParts,
  type Node,
  type PartListOp,
  type PartRef,
} from '@craftkit/builder-schema';

import type { ElementNameWords } from '../../custom-code/element-target';
import { blockDisplayName } from '../../naming/block-display-name';
import { enclosingItemRef, partInstanceName, type PartTarget } from '../../overlay/part-target';
import { dispatchPartPlan } from './part-bar-model';

/*
  ── Part actions (block-parts DESIGN §2.14) ─────────────────────────────────

  The second row of the quick bar over a registered block's part. Same
  contract as the element actions: `resolvePartActions` says what is valid (a
  closed gate carries its reason), `performPartAction` re-checks it from live
  document truth and writes EXACTLY ONE labelled transaction through the pure
  planners (`planPartListOp`, `planPartDir`) — one Undo.

  Host actions (edit text, link, scope, Edit with AI, More) only report what
  the canvas should open; Replace image and Alt text are the media bar's own
  groups (replace → the host asset picker, alt → `planPartValue`).

  Item actions work from the item AND from any part inside it: a person who
  selected the third card's title and presses "Remove item" means that card.
*/

export type PartActionId =
  | 'editText'
  | 'link'
  | 'addAfter'
  | 'duplicate'
  | 'moveUp'
  | 'moveDown'
  | 'remove'
  | 'scopeThis'
  | 'dirAuto'
  | 'dirLtr'
  | 'dirRtl'
  | 'selectBlock';

export const PART_ACTION_IDS: readonly PartActionId[] = [
  'editText',
  'link',
  'addAfter',
  'duplicate',
  'moveUp',
  'moveDown',
  'remove',
  'scopeThis',
  'dirAuto',
  'dirLtr',
  'dirRtl',
  'selectBlock',
];

/** Actions the canvas performs itself (they open something; they write nothing here). */
export const HOST_PART_ACTIONS: ReadonlySet<PartActionId> = new Set(['editText', 'link', 'scopeThis']);

export interface PartAction {
  readonly id: PartActionId;
  readonly enabled: boolean;
  /** Why a closed gate is closed — doubles as the refusal announcement. */
  readonly reason?: string | undefined;
  /** Toggle state (scope, direction); absent for one-shot actions. */
  readonly pressed?: boolean | undefined;
  /** Keyboard hint shown beside the label ("Delete", "Alt+↑"). */
  readonly hint?: string | undefined;
}

export interface PartActionResult {
  readonly ok: boolean;
  /** For the canvas's polite region — every outcome is announced. */
  readonly announcement: string;
}

/** The localized words this file announces with (the quick bar's `parts` labels). */
export interface PartActionWords {
  readonly actions: Readonly<Record<PartActionId, string>>;
  readonly alreadyFirst: string;
  readonly alreadyLast: string;
  readonly notInList: string;
  readonly notText: string;
}

export const PART_ACTION_WORDS_EN: PartActionWords = {
  actions: {
    editText: 'Edit text',
    link: 'Link',
    addAfter: 'Add item after',
    duplicate: 'Duplicate item',
    moveUp: 'Move item up',
    moveDown: 'Move item down',
    remove: 'Remove item',
    scopeThis: 'Style this item only',
    dirAuto: 'Direction from text',
    dirLtr: 'Left to right',
    dirRtl: 'Right to left',
    selectBlock: 'Select the whole block',
  },
  alreadyFirst: 'Already the first item',
  alreadyLast: 'Already the last item',
  notInList: 'This part is not inside a list',
  notText: 'This part holds no text',
};

export interface PartActionContext {
  /** The bar's current style scope. */
  readonly scope: 'all' | 'this';
  readonly locale: 'en' | 'ar';
  readonly words: PartActionWords;
  readonly nameWords?: ElementNameWords | undefined;
  /** False on a read-only canvas: every writing action closes. Default true. */
  readonly editable?: boolean | undefined;
}

interface PartFacts {
  readonly node: Node;
  readonly parts: BlockParts;
  readonly decl: BlockPartDecl;
  readonly schemaProps: Parameters<typeof partStylesKeyOf>[0];
  /** The item the part lives in, with its list facts. */
  readonly item?: {
    readonly ref: PartRef;
    readonly decl: BlockPartDecl;
    readonly position: number;
    readonly count: number;
    readonly pattern: string;
  };
}

function factsOf(kernel: BuilderKernel, target: PartTarget): PartFacts | undefined {
  const node = kernel.getDocument().nodes[target.nodeId];
  const schema = node === undefined ? undefined : kernel.context.registry.block(node.type)?.schema;
  if (node === undefined || schema === undefined) return undefined;
  const parts = blockPartsOf(schema);
  const decl = Object.hasOwn(parts, target.part) ? parts[target.part] : undefined;
  if (decl === undefined) return undefined;
  const itemRef = enclosingItemRef(parts, target);
  const itemDecl = itemRef === undefined ? undefined : parts[itemRef.part];
  const pattern = typeof itemDecl?.bind === 'string' ? itemDecl.bind : undefined;
  const position = itemRef?.index[itemRef.index.length - 1];
  if (itemRef === undefined || itemDecl === undefined || pattern === undefined || position === undefined) {
    return { node, parts, decl, schemaProps: schema.props };
  }
  const listPath = bindPathOf({ ...itemDecl, bind: pattern.slice(0, -2) }, itemRef.index.slice(0, -1));
  const list = listPath === undefined ? undefined : getAtPropPath(node.props, listPath);
  const count = Array.isArray(list) ? list.length : 0;
  return {
    node,
    parts,
    decl,
    schemaProps: schema.props,
    item: { ref: itemRef, decl: itemDecl, position, count, pattern },
  };
}

const TEXTUAL = new Set<BlockPartDecl['kind']>(['text', 'rich', 'link']);

/** The direction override stored for this instance (`this` wins over `all`). */
export function storedPartDir(facts: Pick<PartFacts, 'node' | 'schemaProps'>, ref: PartRef): 'auto' | 'ltr' | 'rtl' | undefined {
  const styles = readPartStyles(facts.node.props, partStylesKeyOf(facts.schemaProps) ?? 'partStyles');
  return styles[partStyleKey(ref, 'this')]?.dir ?? styles[partStyleKey(ref, 'all')]?.dir;
}

/** What the part's bar offers, in order. Closed gates keep their seat with a reason. */
export function resolvePartActions(
  kernel: BuilderKernel,
  target: PartTarget,
  context: PartActionContext,
): readonly PartAction[] {
  const facts = factsOf(kernel, target);
  if (facts === undefined) return [];
  const editable = context.editable ?? true;
  const { decl, item } = facts;
  const words = context.words;
  const actions: PartAction[] = [];
  const gate = (id: PartActionId, open: boolean, reason?: string, extra: Partial<PartAction> = {}) => {
    actions.push({ id, enabled: open && editable, ...(open ? {} : { reason }), ...extra });
  };

  if (TEXTUAL.has(decl.kind)) gate('editText', true, undefined, { hint: 'Enter' });
  if (decl.kind === 'link') gate('link', true);
  if (item !== undefined) {
    gate('addAfter', true);
    gate('duplicate', true);
    gate('moveUp', item.position > 0, words.alreadyFirst, { hint: 'Alt+↑' });
    gate('moveDown', item.position < item.count - 1, words.alreadyLast, { hint: 'Alt+↓' });
    gate('remove', true, undefined, { hint: 'Delete' });
  }
  if (target.index.length > 0) {
    // ── block-parts (2026-10-06) ── the scope is visible: how many instances a style reaches
    const count = facts.item?.count ?? 0;
    const reach = count === 0 ? undefined : context.scope === 'this' ? `1/${String(count)}` : `${String(count)}/${String(count)}`;
    actions.push({
      id: 'scopeThis',
      enabled: true,
      pressed: context.scope === 'this',
      ...(reach === undefined ? {} : { hint: reach }),
    });
    // ── /block-parts ──
  }
  if (TEXTUAL.has(decl.kind)) {
    const dir = storedPartDir(facts, target) ?? 'auto';
    gate('dirAuto', true, undefined, { pressed: dir === 'auto' });
    gate('dirLtr', true, undefined, { pressed: dir === 'ltr' });
    gate('dirRtl', true, undefined, { pressed: dir === 'rtl' });
  }
  actions.push({ id: 'selectBlock', enabled: true, hint: 'Esc' });
  return actions;
}

function withPosition(ref: PartRef, depth: number, position: number): PartRef {
  const index = [...ref.index];
  index[depth - 1] = position;
  return { part: ref.part, index };
}

/**
 * Perform one planner-backed action: ONE transaction, then the focus follows
 * the item it acted on (the added copy, the moved item, the removed item's
 * neighbour). Host actions return `ok: false` with nothing written — the
 * canvas handles those itself.
 */
export function performPartAction(
  kernel: BuilderKernel,
  target: PartTarget,
  id: PartActionId,
  context: PartActionContext,
): PartActionResult {
  const facts = factsOf(kernel, target);
  const words = context.words;
  if (facts === undefined) return { ok: false, announcement: words.notInList };
  const blockName = blockDisplayName(kernel, target.nodeId);
  const name = partInstanceName(kernel, target.nodeId, target, context.locale);
  const done = (announcement: string): PartActionResult => ({ ok: true, announcement });
  const refused = (message: string): PartActionResult => ({ ok: false, announcement: message });

  if (id === 'selectBlock') {
    kernel.clearPartFocus();
    return done(blockDisplayName(kernel, target.nodeId, context.nameWords));
  }
  if (id === 'dirAuto' || id === 'dirLtr' || id === 'dirRtl') {
    if (!TEXTUAL.has(facts.decl.kind)) return refused(words.notText);
    const dir = id === 'dirAuto' ? null : id === 'dirLtr' ? 'ltr' : 'rtl';
    const result = dispatchPartPlan(kernel, planPartDir(facts.node, facts.schemaProps, target, dir, blockName));
    return result.ok ? done(`${words.actions[id]} · ${name}`) : refused(result.message);
  }

  const item = facts.item;
  const isListAction = id === 'addAfter' || id === 'duplicate' || id === 'moveUp' || id === 'moveDown' || id === 'remove';
  if (!isListAction) return refused(words.actions[id]);
  if (item === undefined) return refused(words.notInList);
  const at = item.position;
  let op: PartListOp;
  let focusAt: number | null;
  switch (id) {
    case 'addAfter':
      op = { kind: 'add', at: at + 1 };
      focusAt = at + 1;
      break;
    case 'duplicate':
      op = { kind: 'duplicate', at };
      focusAt = at + 1;
      break;
    case 'moveUp':
      if (at === 0) return refused(words.alreadyFirst);
      op = { kind: 'move', from: at, to: at - 1 };
      focusAt = at - 1;
      break;
    case 'moveDown':
      if (at >= item.count - 1) return refused(words.alreadyLast);
      op = { kind: 'move', from: at, to: at + 1 };
      focusAt = at + 1;
      break;
    default:
      op = { kind: 'remove', at };
      focusAt = item.count <= 1 ? null : Math.min(at, item.count - 2);
  }
  const itemSchema = propSchemaAt(facts.schemaProps, item.pattern);
  const result = dispatchPartPlan(
    kernel,
    planPartListOp(facts.node, facts.parts, item.ref, op, blockName, itemSchema),
  );
  if (!result.ok) return refused(result.message);
  // The focus follows the item; a removed last item leaves the block selected.
  if (focusAt === null) {
    kernel.clearPartFocus();
  } else {
    kernel.focusPart(target.nodeId, withPosition(target, item.ref.index.length, focusAt));
  }
  const itemName = partInstanceName(kernel, target.nodeId, item.ref, context.locale);
  return done(`${words.actions[id]} · ${itemName}`);
}
