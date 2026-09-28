import type { BuilderDocument, NodeId } from '@craftkit/builder';

import type { MentionCandidateView } from './view-types';

/**
 * The `@` mention grammar (SPEC §4.17 MentionMenu, §3.2), decidable from a string and a
 * document: what the caret is pointing at, which blocks answer to it, and what the draft
 * reads once one is picked. No kernel, run or render needed.
 *
 * What changed from v1, and why:
 * - The fragment accepts letters in ANY script. v1's `/@([A-Za-z0-9_-]*)$/` closed the
 *   list on the first Arabic letter, so an Arabic speaker could only mention a block by
 *   its English id, which they never see.
 * - A person types a block's human NAME, and matches on names. v1 matched ids and types
 *   (`hero`, `pricing-table`); on an AI-built page every section is a `customCode` region
 *   with an engine id, so neither says anything a reader recognises.
 * - A pick becomes a CHIP that carries the node id, and the `@fragment` leaves the text
 *   (`consumeMentionFragment`). v1 wrote `@hero ` into the request: an id in the person's
 *   own words, and a mention that silently broke when the id did not survive a reload.
 */

/**
 * A mention BEING TYPED: an `@` and the word after it, anchored to the end of the text
 * before the caret (SPEC §4.17). Anchored because a finished `@name` earlier in the
 * sentence is not the one the person is writing now.
 *
 * SPEC §4.17 prints `/@([\p{L}\p{N}_-]*)$/u`; `\p{M}` is added here, and the amendment is
 * requested. Tashkeel are combining marks (category Mn), not letters: typing «@حسّ» put
 * a shadda after the letters, the pattern stopped matching, and the list closed mid-word
 * (found by probe, 2026-09-28). The panel's own starters write «عمّان». Matching is
 * unaffected: `foldForMatch` strips the marks before comparing.
 */
export const MENTION_PATTERN = /@([\p{L}\p{M}\p{N}_-]*)$/u;

/**
 * Every `@id` in a sent request, for text written before chips existed (a reused v1
 * request, a migrated session). Global: a request may name several.
 */
export const MENTION_IDS = /@([\p{L}\p{M}\p{N}_-]+)/gu;

/** How many rows the list holds; six show at a time and the rest scroll (SPEC §4.17). */
export const MENTION_LIMIT = 8;

/*
  An Arabic proclitic that starts a word: «و» "and", «ف» "so", «ب» "with", «ل» "for",
  «ك» "like", with any tashkeel on it. Arabic writes these attached to the word they lead,
  so «و@الفوتر» is how "and @footer" is typed, not a word that happens to contain an `@`.
*/
const PROCLITIC_BEFORE = /(?:^|[^\p{L}\p{M}\p{N}_])[وفبلك]\p{M}*$/u;

/*
  The mention open at the end of `textBeforeCaret`: where its `@` stands and the fragment
  after it. One rule beyond the pattern: the `@` must start a word, or follow a proclitic
  that does. An email address is a normal thing to write in a site request ("send the form
  to info@clinic.jo"), and opening a block list halfway through one takes the caret away
  from where the person's hands are; a plain word-start rule also refused «و@الب», so an
  Arabic speaker writing "and @footer" never got the list (found by probe, 2026-09-28).
  `mentionQuery` and `consumeMentionFragment` share it, so the list never opens on a
  fragment a pick would not remove, and a pick never removes half an address.
*/
function openMention(
  textBeforeCaret: string,
): { readonly start: number; readonly query: string } | null {
  const match = MENTION_PATTERN.exec(textBeforeCaret);
  if (match === null) return null;
  const head = textBeforeCaret.slice(0, match.index);
  const before = head.charAt(head.length - 1);
  const startsWord = before === '' || !/[\p{L}\p{M}\p{N}_]/u.test(before);
  if (!startsWord && !PROCLITIC_BEFORE.test(head)) return null;
  return { start: match.index, query: match[1] ?? '' };
}

/** The fragment being typed before the caret, or `null` when no list should open. */
export function mentionQuery(textBeforeCaret: string): string | null {
  return openMention(textBeforeCaret)?.query ?? null;
}

/*
  How a name is compared, not how it is shown: case, the Unicode spellings different
  keyboards produce (NFKC), tashkeel (U+064B to U+065F, U+0670) and tatweel (U+0640), and
  the alef forms a person may or may not type (U+0622, U+0623, U+0625, U+0671 → U+0627).
  «اراء» must find «آراء العملاء». Escaped, because a combining mark written as itself
  attaches to the bracket before it and cannot be read or reviewed.
*/
function foldForMatch(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/gu, '')
    .replace(/[\u0622\u0623\u0625\u0671]/gu, '\u0627')
    .replace(/ى/gu, 'ي')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** 0: the name starts with the query; 1: a later word does; 2: it appears anywhere. */
function matchRank(label: string, query: string): number | null {
  if (query === '') return 0;
  if (label.startsWith(query)) return 0;
  if (label.split(/[\s\-_]+/u).some((word) => word.startsWith(query))) return 1;
  return label.includes(query) ? 2 : null;
}

/** Every node id below the root, in reading order: sections first as the page lists them. */
function readingOrder(document: BuilderDocument): NodeId[] {
  const out: NodeId[] = [];
  const seen = new Set<NodeId>([document.rootId]);
  const walk = (id: NodeId): void => {
    const node = document.nodes[id];
    if (node?.slots === undefined) return;
    for (const children of Object.values(node.slots)) {
      for (const child of children) {
        if (seen.has(child) || document.nodes[child] === undefined) continue;
        seen.add(child);
        out.push(child);
        walk(child);
      }
    }
  };
  walk(document.rootId);
  // A block the walk never reached is still on the page and still nameable.
  for (const id of Object.keys(document.nodes)) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

export interface MentionCandidateOptions {
  /** The block's human name: its instance label, else its type's display name. */
  readonly nameOf: (nodeId: NodeId) => string;
  /** Ids already chipped; offering them again would add a second chip for one block. */
  readonly exclude?: readonly NodeId[] | undefined;
  readonly limit?: number | undefined;
}

/**
 * The blocks a trailing `@query` can point at, by human name (SPEC §3.2: "a listbox of
 * the page's sections and blocks by human name").
 *
 * The page's own sections come first, as the spine lists them, each with its place
 * ("2 of 8"); then every other block in reading order. Within that order a name that
 * starts with the query ranks above one where a later word does, and both above a match
 * mid-word. The root is never offered: it is the page, and naming it says nothing a
 * request without a mention does not already say.
 */
export function mentionCandidatesFor(
  document: BuilderDocument,
  query: string | null,
  options: MentionCandidateOptions,
): readonly MentionCandidateView[] {
  if (query === null) return [];
  const needle = foldForMatch(query);
  const excluded = new Set(options.exclude ?? []);
  const sections = Object.values(document.nodes[document.rootId]?.slots ?? {})
    .flat()
    .filter((id) => document.nodes[id] !== undefined);
  const sectionIds = new Set(sections);
  const ordered = [...sections, ...readingOrder(document).filter((id) => !sectionIds.has(id))];

  const ranked: {
    readonly rank: number;
    readonly order: number;
    readonly view: MentionCandidateView;
  }[] = [];
  ordered.forEach((id, order) => {
    if (id === document.rootId || excluded.has(id)) return;
    const label = options.nameOf(id);
    const rank = matchRank(foldForMatch(label), needle);
    if (rank === null) return;
    const position = sections.indexOf(id);
    ranked.push({
      rank,
      order,
      view:
        position < 0
          ? { id, label }
          : { id, label, section: { position: position + 1, total: sections.length } },
    });
  });

  return ranked
    .sort((left, right) => left.rank - right.rank || left.order - right.order)
    .slice(0, options.limit ?? MENTION_LIMIT)
    .map(({ view }) => view);
}

/**
 * The draft once a candidate is picked: the `@fragment` before the caret removed, the
 * rest untouched, and where the caret now belongs. The pick itself becomes a chip that
 * carries the node id (`AgentController.addMention`); no id is ever written into the
 * person's words. With no fragment open, nothing changes.
 */
export function consumeMentionFragment(
  draft: string,
  caret: number = draft.length,
): { readonly text: string; readonly caret: number } {
  const head = draft.slice(0, caret);
  const open = openMention(head);
  if (open === null) return { text: draft, caret };
  return { text: `${head.slice(0, open.start)}${draft.slice(caret)}`, caret: open.start };
}

/**
 * The ids a sent request's text names AND the document really has, in writing order.
 * Filtered on purpose: a mention is a pointer, and a pointer to nothing must not become
 * the request's focus, replacing the selection with a block that does not exist.
 */
export function mentionedIds(request: string, document: BuilderDocument): NodeId[] {
  return [...request.matchAll(MENTION_IDS)]
    .map((match) => match[1] ?? '')
    .filter((id) => document.nodes[id] !== undefined);
}
