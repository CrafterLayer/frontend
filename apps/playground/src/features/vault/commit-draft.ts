import type { BuilderDocument, BuilderKernel, CoreCommands, JsonValue } from '@craftkit/builder';

import { fingerprintDocument } from './drafts';

/**
 * The one door a draft lands through.
 *
 * ## The three promises
 *
 * **One transaction.** Whatever a run did across its draft — a skeleton, eight
 * sections, a stylesheet — reaches the live document as a single
 * `dispatchGroup`, so history gains one entry and one undo takes the whole
 * generation back. A person who does not like the result should not have to
 * press undo nine times to find out where it started.
 *
 * **Attributed and labelled.** `author: 'ai'` with a sentence a person can read
 * in the history panel. `restoreDocument` already lands a whole document as one
 * transaction, but it hardcodes `author: 'codeview'` — an agent's work filed
 * under the code view is a lie in the one record that is supposed to say who
 * did what, which is why this is its own function rather than a flag on that
 * one.
 *
 * **Refused, not merged, when the page moved.** The fingerprint captured when
 * the draft was seeded is compared against the live document as it stands. If
 * they differ the commit is refused with ZERO writes. A run takes minutes; the
 * person is not required to sit still for them, and the alternative to refusing
 * is overwriting edits they made in the meantime and calling it success.
 *
 * ## Why it goes through the projection
 *
 * There is no command for "become this document". The canonical-json projection
 * is the route the code view already uses: project the draft to text, parse it
 * back against the LIVE document, and take the patches that parse produces.
 * That is what turns a whole document into a patch set the door accepts — and
 * it is validated on the way, so a draft that somehow went invalid is refused
 * here rather than landing and breaking the canvas.
 */

const CANONICAL_JSON_PROJECTION = 'canonical-json';

export type CommitRefusal =
  /** The live document moved while the run was building. */
  | 'stale'
  /** The draft and the live document are the same; there is nothing to land. */
  | 'unchanged'
  /** The draft did not parse against the live registry. */
  | 'invalid'
  /** The host has no canonical-json projection registered. */
  | 'unavailable';

export type CommitOutcome =
  | { readonly ok: true; readonly patches: number }
  | { readonly ok: false; readonly refusal: CommitRefusal; readonly reason: string };

export interface CommitDraftOptions {
  /** The kernel that owns the real page. The only thing this writes to. */
  readonly live: BuilderKernel;
  /** The document the run produced. Read only; never dispatched into. */
  readonly draft: BuilderDocument;
  /** What the live document was when the draft was seeded. */
  readonly baseFingerprint: string;
  /** One sentence, shown in history. Written by the caller, who knows the run. */
  readonly label: string;
}

export function commitDraft(options: CommitDraftOptions): CommitOutcome {
  const { live, draft, baseFingerprint, label } = options;

  /*
    Checked FIRST, before anything is computed. Not for speed — for the promise:
    "zero writes" is easy to state and easy to lose, and the way to keep it is
    to leave before there is anything to lose.
  */
  if (fingerprintDocument(live.getDocument()) !== baseFingerprint) {
    return {
      ok: false,
      refusal: 'stale',
      reason: 'The page changed while this was building, so nothing was applied.',
    };
  }

  const projection = live.context.registry.projection(CANONICAL_JSON_PROJECTION);
  if (projection === undefined) {
    return {
      ok: false,
      refusal: 'unavailable',
      reason: 'This build cannot land a whole document: no canonical-json projection.',
    };
  }

  const parsed = projection.parse(projection.project(draft), live.getDocument(), {
    blockExists: (type) => live.context.registry.block(type) !== undefined,
  });
  if (!parsed.ok) {
    return {
      ok: false,
      refusal: 'invalid',
      reason: 'The result did not validate against this page, so nothing was applied.',
    };
  }

  /*
    An empty patch set is refused rather than dispatched. A group with no steps
    would still write a transaction — an entry in history, an undo step, and a
    line in the panel — for a run that changed nothing. "It did nothing" and
    "it did nothing but I recorded it anyway" are different lies.
  */
  if (parsed.patches.length === 0) {
    return {
      ok: false,
      refusal: 'unchanged',
      reason: 'The result is identical to the page, so nothing was applied.',
    };
  }

  const patches: CoreCommands['applyPatches']['patches'] = parsed.patches.map((patch) => ({
    op: patch.op,
    path: [...patch.path],
    ...(patch.value === undefined ? {} : { value: patch.value as JsonValue }),
  }));

  live.dispatchGroup([{ command: 'applyPatches', args: { patches } }], {
    author: 'ai',
    label,
  });

  return { ok: true, patches: patches.length };
}
