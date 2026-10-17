import type { BuilderDocument, BuilderKernel, CoreCommands, NodeId } from '@craftkit/builder';

import { restoreDocument, type RestoreOutcome } from './restore';

/**
 * Taking back what a run wrote — the whole of it, or one section of it.
 *
 * ## Why neither of these is `undo()`
 *
 * The history stack is the wrong instrument for both jobs, for two different
 * reasons.
 *
 * For the WHOLE generation: a build lands one commit today, so a single
 * `undo()` works — until the person does anything afterwards, at which point
 * the top of the stack is theirs and undoing it takes back their edit instead.
 * The panel's old per-section undo made exactly that mistake in a loop:
 * `while (undone < steps) kernel.undo()` pops whatever is on top, counting
 * blindly, with no idea whose work it is removing.
 *
 * For ONE section: there is no undo entry that corresponds to it. A section's
 * fill is one step inside a grouped commit, and a group is atomic by design —
 * one undo takes the group. Reaching one section means computing the change
 * that reverts it and dispatching that FORWARD, which is the same shape
 * `restoreDocument` already uses and for the same reason: the stored inverse
 * patches cannot be replayed safely, because undo and redo write no
 * transaction and the log would disagree with the history about what happened.
 *
 * ## What "restores" means for a section
 *
 * Whatever the snapshot says. A section the run CREATED is removed; a section
 * that existed before and was rewritten has its props put back exactly. Both as
 * ONE group, so one undo puts the section back again — a person who reverts a
 * section by mistake presses ctrl-Z once, like everywhere else.
 */

/**
 * Undo the whole generation by restoring the state before it.
 *
 * One transaction, whatever the run did and whatever happened since. The author
 * is the caller's, because a revert is not the agent's work — the agent wrote
 * the page, the person is taking it back.
 */
export function undoGeneration(
  kernel: BuilderKernel,
  before: BuilderDocument,
  options: { readonly author?: 'user' | 'ai' | 'codeview'; readonly label?: string } = {},
): RestoreOutcome {
  return restoreDocument(kernel, before, options);
}

export type SectionUndoOutcome =
  | { readonly ok: true; readonly action: 'removed' | 'restored' | 'unchanged' }
  | { readonly ok: false; readonly reason: string };

/**
 * Undo ONE section, and nothing else on the page.
 *
 * The snapshot decides which of two things that means. If the node is absent
 * from it, the run created the section and undoing it is a removal. If the node
 * was there, undoing is putting its props back — the fill overwrote them, and
 * the snapshot holds what they were.
 *
 * It never touches another node. That is the whole point of the task: the old
 * behaviour reverted a section by popping N entries off the history stack, so a
 * person who had edited a different section since lost that edit too, silently.
 */
export function undoSection(
  kernel: BuilderKernel,
  before: BuilderDocument,
  nodeId: NodeId,
  options: { readonly author?: 'user' | 'ai' | 'codeview'; readonly label?: string } = {},
): SectionUndoOutcome {
  const live = kernel.getDocument();
  const author = options.author ?? 'user';
  const group = { author, ...(options.label === undefined ? {} : { label: options.label }) };

  const current = live.nodes[nodeId];
  const original = before.nodes[nodeId];

  if (current === undefined) {
    /*
      Already gone. Not an error and not a no-op worth a transaction: a section
      somebody removed by hand, or a keep that pruned it, is a section that is
      already in the state this call wants.
    */
    return { ok: true, action: 'unchanged' };
  }

  if (original === undefined) {
    /*
      The run created it. `removeNode` takes the subtree and does the slot
      bookkeeping — splicing the parent's list, dropping the key when it empties
      — which is exactly the work a hand-written patch would get subtly wrong.
    */
    try {
      kernel.dispatchGroup([{ command: 'removeNode', args: { id: nodeId } }], group);
      return { ok: true, action: 'removed' };
    } catch (cause: unknown) {
      return { ok: false, reason: messageOf(cause) };
    }
  }

  /*
    It existed before, so put its props back — and ONLY its props.

    Expressed as patches rooted at this node rather than a whole-document
    restore: a restore would also revert every OTHER section the same run wrote,
    which is the opposite of what a per-section undo is for.

    `slots` are deliberately not touched. A fill is one `setProp` on the
    section's own tree; it cannot move children, so a difference in slots came
    from somewhere else and is not this call's to revert.
  */
  const patches: CoreCommands['applyPatches']['patches'] = [];
  for (const key of Object.keys(current.props)) {
    if (!(key in original.props)) {
      patches.push({ op: 'remove', path: ['nodes', nodeId, 'props', key] });
    }
  }
  for (const [key, value] of Object.entries(original.props)) {
    if (JSON.stringify(current.props[key]) === JSON.stringify(value)) continue;
    patches.push({
      op: key in current.props ? 'replace' : 'add',
      path: ['nodes', nodeId, 'props', key],
      value,
    });
  }

  if (patches.length === 0) {
    return { ok: true, action: 'unchanged' };
  }

  try {
    kernel.dispatchGroup([{ command: 'applyPatches', args: { patches } }], group);
    return { ok: true, action: 'restored' };
  } catch (cause: unknown) {
    /*
      `applyPatches` revalidates the WHOLE document registry-aware and throws
      rather than landing something invalid, so a throw leaves the document, the
      log and the history exactly as they were.
    */
    return { ok: false, reason: messageOf(cause) };
  }
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'The section could not be reverted.';
}
