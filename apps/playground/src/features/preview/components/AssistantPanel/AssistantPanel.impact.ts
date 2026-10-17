import {
  AI_PLAN_WIRE_VERSION,
  estimateAiPlanWireRequestTokens,
  type AiChatTurn,
  type AssembledAiContext,
  type BuilderDocument,
  type Node,
} from '@craftkit/builder';

/**
 * What a plan would change, computed by DIFFING documents.
 *
 * Not a second model call, and not a re-reading of the plan's own commands.
 * `previewAiPlan` already runs the plan on a scratch kernel through the real
 * door, so the previewed document IS the outcome — the only honest source for
 * "what will change", because it accounts for what the commands actually did
 * rather than what they were named.
 *
 * A step list answers "what was asked for". This answers "what happens", and
 * the two differ exactly where it matters: an `insertNode` that the schema
 * placed elsewhere, a `setProp` that changed nothing because the value already
 * matched, a command whose effect was undone by a later one in the same plan.
 */
export interface PlanImpact {
  /**
   * Document-level metadata this plan changed — `dir`, `surface`.
   *
   * Not a node, so no node diff would ever mention it, and `setDocMeta` is a
   * perfectly ordinary command. A plan that flips a page to RTL rearranges
   * everything a person can see and touches not one node: without this the card
   * said "changes nothing" about the largest change the panel can make.
   */
  readonly meta: readonly ('dir' | 'surface')[];
  /** Node ids that exist after and did not before. */
  readonly added: readonly string[];
  /** Node ids that exist in both and whose content differs. */
  readonly changed: readonly string[];
  /** Node ids that existed before and do not after. */
  readonly removed: readonly string[];
  /** Blocks by type, for a sentence a person reads rather than a list of ids. */
  readonly addedTypes: readonly string[];
  /** True when the plan validated and applied cleanly but moved nothing. */
  readonly empty: boolean;
}

/**
 * Everything about a node EXCEPT which children sit in its slots, as a string
 * that does not depend on key ORDER.
 *
 * `JSON.stringify` walks keys in insertion order, so two nodes with identical
 * props built in different orders — which a plan's commands routinely produce —
 * stringify differently and would be reported as changed when nothing about
 * them differs. Sorting every level is what makes the comparison about content.
 */
function contentOf(node: Node | undefined): string {
  if (node === undefined) return '';
  const rest: Record<string, unknown> = { ...node };
  delete rest['slots'];
  return stableJson(rest);
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return entry;
    return Object.fromEntries(
      Object.entries(entry as Record<string, unknown>).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    );
  });
}

/** The children of each slot, as a stable string. */
function slotsOf(node: Node | undefined): string {
  return JSON.stringify(node?.slots ?? {});
}

/**
 * A node's slots with the ids that were ADDED or REMOVED by this plan taken out.
 *
 * This is what makes "already accounted for" precise. A parent that gained a
 * new child differs only by that child, which the summary already reports — so
 * with the added ids stripped, before and after match and the parent is not
 * counted again. A parent involved in a MOVE does not match, because the id
 * that left is neither added nor removed: it exists on both sides of the plan
 * and simply sits somewhere else.
 *
 * That is the case the first version missed. Its rule was "a membership change
 * is explained by an add or a remove", which is true for those two and false
 * for a move — so a plan that rearranged the page reported that it changed
 * nothing. Found by an adversarial probe, not by its author.
 */
function slotsWithout(node: Node | undefined, ignore: ReadonlySet<string>): string {
  const slots = node?.slots ?? {};
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(slots).map(([slot, ids]) => [slot, ids.filter((id) => !ignore.has(id))]),
    ),
  );
}

/**
 * Did this node change in a way worth telling somebody about?
 *
 * Its own content, always. Its slots, only when the difference is NOT already
 * explained by a child this plan added or removed — which leaves exactly the
 * two structural changes nothing else in the summary would say: a reorder, and
 * a move.
 */
function meaningfullyChanged(
  previous: Node | undefined,
  next: Node | undefined,
  addedOrRemoved: ReadonlySet<string>,
): boolean {
  if (contentOf(previous) !== contentOf(next)) return true;
  if (slotsOf(previous) === slotsOf(next)) return false;
  return slotsWithout(previous, addedOrRemoved) !== slotsWithout(next, addedOrRemoved);
}

/**
 * The nodes of a document, in the order they read down the page.
 *
 * Document order, not `Object.keys` order: keys come back in insertion order,
 * which for an edited document is the order things were CREATED — a different
 * and meaningless sequence to a person looking at a page top to bottom.
 */
function orderedIds(document: BuilderDocument): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const walk = (id: string): void => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push(id);
    const node = document.nodes[id];
    if (node?.slots === undefined) return;
    for (const children of Object.values(node.slots)) {
      for (const child of children) walk(child);
    }
  };
  walk(document.rootId);
  /*
    Anything the walk did not reach is still part of the document as far as a
    diff is concerned — an orphan is exactly the kind of thing worth reporting,
    and silently dropping it would make the summary say less than the truth.
  */
  for (const id of Object.keys(document.nodes)) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

/** The document-level fields a plan may change, and a person would notice. */
function changedMeta(before: BuilderDocument, after: BuilderDocument): ('dir' | 'surface')[] {
  const out: ('dir' | 'surface')[] = [];
  if (before.dir !== after.dir) out.push('dir');
  if (before.surface !== after.surface) out.push('surface');
  /*
    `schemaVersion` is deliberately NOT here. Migrations own it (Law M), no
    command may change it, and a number a person cannot act on is noise on a
    card whose whole job is to make one decision readable.
  */
  return out;
}

export function planImpact(before: BuilderDocument, after: BuilderDocument): PlanImpact {
  const added: string[] = [];
  const changed: string[] = [];
  const addedTypes: string[] = [];

  const afterIds = orderedIds(after);
  /*
    A node the plan deleted. `orderedIds` includes ids that are still LISTED in
    a slot but absent from `nodes` — a dangling reference — and such an id must
    be reported once, as removed, not counted again among the ids walked in
    `after`. The guard below in the change pass is what keeps it to one.
  */
  const removed = orderedIds(before).filter((id) => after.nodes[id] === undefined);
  /*
    Computed BEFORE the change pass, because deciding whether a parent's slot
    difference is "already accounted for" needs to know which ids this plan
    added or removed — and a parent is usually visited before the child that
    explains it.
  */
  const addedOrRemoved = new Set<string>([
    ...afterIds.filter((id) => before.nodes[id] === undefined),
    ...removed,
  ]);

  for (const id of afterIds) {
    const previous = before.nodes[id];
    const next = after.nodes[id];
    /*
      Listed in a slot but gone from `nodes`: already reported as removed above.
      Without this it was ALSO reported as changed, so deleting one block read
      as "1 removed, 1 changed" — two facts about one block.
    */
    if (next === undefined) continue;
    if (previous === undefined) {
      added.push(id);
      addedTypes.push(next.type);
      continue;
    }
    if (meaningfullyChanged(previous, next, addedOrRemoved)) {
      changed.push(id);
    }
  }

  const meta = changedMeta(before, after);
  return {
    added,
    changed,
    removed,
    addedTypes,
    meta,
    empty: added.length === 0 && changed.length === 0 && removed.length === 0 && meta.length === 0,
  };
}

/**
 * The impact as one sentence, in the panel's language.
 *
 * Counts, not ids. An id is the right thing to jump to and the wrong thing to
 * read: "3 blocks added, 1 changed" is what a person needs before pressing
 * Apply, and the ids are already reachable by looking at the page the preview
 * shows.
 */
export function describeImpact(impact: PlanImpact, locale: 'ar' | 'en'): string {
  if (impact.empty) {
    return locale === 'ar' ? 'لا يغيّر شيئًا على الصفحة.' : 'Changes nothing on the page.';
  }
  const parts: string[] = [];
  const add = (count: number, ar: string, en: string): void => {
    if (count === 0) return;
    parts.push(locale === 'ar' ? `${ar} ${String(count)}` : `${String(count)} ${en}`);
  };
  add(impact.added.length, 'إضافة', impact.added.length === 1 ? 'block added' : 'blocks added');
  add(
    impact.changed.length,
    'تعديل',
    impact.changed.length === 1 ? 'block changed' : 'blocks changed',
  );
  add(
    impact.removed.length,
    'حذف',
    impact.removed.length === 1 ? 'block removed' : 'blocks removed',
  );
  /*
    Named, not counted. "1 changed" would be true and useless — a person needs
    to know it is the page's DIRECTION that turns, which is a different kind of
    change from a block moving.
  */
  for (const field of impact.meta) {
    parts.push(
      field === 'dir'
        ? locale === 'ar'
          ? 'تغيير اتجاه الصفحة'
          : 'page direction changed'
        : locale === 'ar'
          ? 'تغيير سطح الصفحة'
          : 'page surface changed',
    );
  }
  return parts.join(locale === 'ar' ? '، ' : ', ') + '.';
}

/**
 * What this request cost to SEND, estimated with the engine's own estimator.
 *
 * The same function `generateAiPlan` uses to enforce its context budget, over
 * the same three inputs — so the number a person reads is the number the budget
 * was checked against, not a second calculation wearing the same name.
 *
 * It is the REQUEST, not the answer, and it is an estimate: tokens are counted
 * from canonical JSON, and no model was asked. Both facts belong in the label,
 * which is why this returns a number and lets the caller say so.
 */
export function estimateRequestTokens(
  request: string,
  context: AssembledAiContext,
  history: readonly AiChatTurn[] | undefined,
): number {
  return estimateAiPlanWireRequestTokens({
    version: AI_PLAN_WIRE_VERSION,
    request,
    context,
    ...(history === undefined || history.length === 0 ? {} : { history }),
  });
}

/**
 * The estimate as a person reads it: two significant figures, never a false
 * precision. "~4.2k" is honest about being an estimate in a way "4,237" is not.
 */
export function describeCost(tokens: number, locale: 'ar' | 'en'): string {
  const rounded =
    tokens >= 1000 ? `${(Math.round(tokens / 100) / 10).toFixed(1)}k` : String(Math.round(tokens));
  return locale === 'ar' ? `تقدير: ~${rounded} توكن` : `Estimate: ~${rounded} tokens`;
}
