import type { BuilderDocument } from '@craftkit/builder';

/**
 * The @-mention grammar, and the three pure functions around it.
 *
 * Split out of the panel because every one of them is decidable from a string
 * and a document: what the caret is pointing at, which blocks answer to it, and
 * what the field should read once one is chosen. None of them needs a kernel,
 * a run, or a render — and while they lived inside the panel none of them could
 * be tested without one.
 */

/**
 * A mention BEING TYPED: an `@` and the word after it, anchored to the end.
 *
 * Anchored, because it is matched against the text BEFORE the caret — a `@hero`
 * earlier in the sentence is a finished mention, not the one the person is
 * writing now, and offering a picker for it would move the caret away from
 * where their hands are.
 */
export const MENTION_PATTERN = /@([A-Za-z0-9_-]*)$/;

/** Every finished mention in a sent request. Global: a request may name several. */
export const MENTION_IDS = /@([A-Za-z0-9_-]+)/g;

/** One row of the picker: what a person needs to recognise a block by. */
export interface MentionCandidate {
  readonly id: string;
  readonly type: string;
  /** The first non-empty string prop, so a block is known by its words. */
  readonly excerpt?: string | undefined;
}

/** How many rows the picker will show. More is a list to read, not a choice. */
const MENTION_LIMIT = 8;

/** How much of a prop is enough to recognise a block by. */
const EXCERPT_LENGTH = 48;

/**
 * Every block a trailing `@` can point at, filtered as the person types.
 *
 * The root is excluded on purpose: it is the page, it is always there, and a
 * request that mentions it says nothing a request with no mention does not
 * already say. Matching is on id OR type, because a person reaching for "the
 * hero" may know it by either and should not have to know which.
 */
export function mentionCandidatesFor(
  document: BuilderDocument,
  query: string | null,
): readonly MentionCandidate[] {
  if (query === null) return [];
  const needle = query.toLowerCase();
  return Object.values(document.nodes)
    .filter(
      (node) =>
        node.id !== document.rootId &&
        (node.id.toLowerCase().includes(needle) || node.type.toLowerCase().includes(needle)),
    )
    .slice(0, MENTION_LIMIT)
    .map((node) => {
      const excerpt = Object.values(node.props).find(
        (value): value is string => typeof value === 'string' && value.trim() !== '',
      );
      return { id: node.id, type: node.type, excerpt: excerpt?.slice(0, EXCERPT_LENGTH) };
    });
}

/**
 * The draft with the mention in progress REPLACED by the chosen id.
 *
 * Replaced, not appended: the person typed `@he` and picked `hero`, so what
 * they typed must become `@hero ` in place. Appending would leave the fragment
 * behind, and `@he @hero` names one block that does not exist and one that
 * does. The fallback appends only when the fragment is no longer findable —
 * the field changed under the picker — which is the one case where there is
 * nothing to replace.
 */
export function insertMention(draft: string, query: string | null, id: string): string {
  const fragment = query ?? '';
  const at = draft.lastIndexOf(`@${fragment}`);
  if (at < 0) return `${draft}@${id} `;
  return `${draft.slice(0, at)}@${id} ${draft.slice(at + fragment.length + 1)}`;
}

/**
 * The ids a sent request names AND the document really has, in writing order.
 *
 * Filtered against the document on purpose: a mention is a pointer, and a
 * pointer to nothing must not become the request's focus. Without the filter a
 * typo — `@her` for `@hero` — would replace the canvas selection with an id no
 * node answers to, and the request would arrive scoped to a block that does not
 * exist rather than to the one the person had selected all along.
 */
export function mentionedIds(request: string, document: BuilderDocument): string[] {
  return [...request.matchAll(MENTION_IDS)]
    .map((match) => match[1] ?? '')
    .filter((id) => document.nodes[id] !== undefined);
}
