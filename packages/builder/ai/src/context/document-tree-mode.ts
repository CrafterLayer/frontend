import type { BuilderDocument, Node, NodeId } from '@craftkit/builder-schema';

import { tokenize, type IntentToken } from '../intent/intent-tokens';
import { normalizeIntentText } from '../intent/normalize-arabic';
import type { IntentKind } from '../intent/route-intent';

/**
 * The page as an EDIT needs to see it: the section the request is about in
 * full, every other section as one line (fast-edits, 2026-09-28).
 *
 * ## The cost this removes
 *
 * «تغيير عنوان قسم التعليم والشهادات إلى مرحبا» — one heading on a nine-section
 * CV — was measured at 11,368 wire tokens (the "~11.3k" the owner saw): the
 * whole page's markup (1,601), the skill catalog (5,431, which no server
 * renders), and the escape hatch's authoring schema (1,251) for a region that
 * already exists. A person naming a section has already done the one thing
 * the rest of the page was there for — finding it — so an edit ships that
 * section whole and an outline of the rest: ids, labels, a shape summary.
 *
 * ## What it never does
 *
 * Guess. A request names a section when a section's label, heading or anchor
 * reads in its words (Arabic articles, conjunctions and possessives peeled,
 * English plurals folded); a request that names none, names more than three,
 * or speaks of the whole page ("كل", "all", "the page") keeps the full
 * document, exactly as before. The selection and @mentions still pin their
 * sections whole.
 */

/** One top-level section of a page, as a person would name it. */
export interface PageSectionOutline {
  readonly id: NodeId;
  readonly type: string;
  /** 0-based position among the page root's children, in reading order. */
  readonly index: number;
  /** A composed region's own label (the build names every region). */
  readonly label?: string;
  /** The region's first h1–h3 text, or a registered block's `heading` / `title`. */
  readonly heading?: string;
  /** The section element's `id` attribute — its anchor, e.g. `education`. */
  readonly anchor?: string;
}

/**
 * What an edit is about, carried on `AiCompositionPolicy.documentFocus`.
 *
 * `nodeIds` are shown WHOLE (each with every node under it); every other
 * top-level section is outlined. `kind` says whether the run authors a new
 * region (`add-section`, which keeps the escape hatch's full schema) or only
 * changes what exists (`edit`, which does not need it).
 */
export interface AiDocumentFocus {
  readonly nodeIds: readonly NodeId[];
  readonly kind: 'edit' | 'add-section';
}

/*
  The policy is the one per-run dial that reaches the assembler verbatim
  (generate-plan forwards `composition` untouched, spreading it at most), and
  its own docs promise that a new guard "arrives as one more optional key
  whose absence means as before". composition-policy.ts is another owner's
  file, so the key is declared here, beside the code that reads it; absent,
  nothing about assembly changes.
*/
declare module './composition-policy' {
  interface AiCompositionPolicy {
    /**
     * fast-edits (2026-09-28): the sections this run is about. Present ⇒ the
     * document context holds those sections whole plus a one-line outline of
     * the rest, no skill catalog, and — for an `edit` on a remote catalog —
     * no authoring schema for the escape hatch. Set by `runAiAgent` when the
     * route is an edit or a new section and the request names its target.
     */
    readonly documentFocus?: AiDocumentFocus;
  }
}

const CUSTOM_CODE = 'customCode';
const HEADING_TAGS: ReadonlySet<string> = new Set(['h1', 'h2', 'h3']);
/** A heading is a name, not a paragraph. */
const NAME_MAX_CHARS = 120;
/** A tree scan never costs more than this many nodes, however hostile the tree. */
const TREE_SCAN_LIMIT = 2_000;
/** Beyond this many named sections a request is about the page, not a section. */
const MAX_FOCUSED_SECTIONS = 3;
/** A partial name match counts from half the name's words. */
const PARTIAL_MATCH = 0.5;

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The ids in every slot of a node, in slot order. */
export function childIdsOf(node: Node | undefined): readonly NodeId[] {
  if (node?.slots === undefined) return [];
  return Object.values(node.slots).flat();
}

/** Child → parent, for every node reachable through a slot. */
export function parentsOf(document: BuilderDocument): ReadonlyMap<NodeId, NodeId> {
  const parents = new Map<NodeId, NodeId>();
  for (const node of Object.values(document.nodes)) {
    for (const child of childIdsOf(node)) {
      if (!parents.has(child)) parents.set(child, node.id);
    }
  }
  return parents;
}

/** The top-level section holding `id` (itself when it is one), or undefined for the root or an orphan. */
export function sectionOf(
  id: NodeId,
  document: BuilderDocument,
  parents: ReadonlyMap<NodeId, NodeId> = parentsOf(document),
): NodeId | undefined {
  const seen = new Set<NodeId>();
  let current: NodeId | undefined = id;
  while (current !== undefined && !seen.has(current)) {
    seen.add(current);
    const parent = parents.get(current);
    if (parent === document.rootId) return current;
    current = parent;
  }
  return undefined;
}

/** Every node under `id`, itself included; a cycle is walked once. */
export function subtreeIds(id: NodeId, document: BuilderDocument): readonly NodeId[] {
  const out: NodeId[] = [];
  const seen = new Set<NodeId>();
  const stack: NodeId[] = [id];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined || seen.has(current)) continue;
    const node = document.nodes[current];
    if (node === undefined) continue;
    seen.add(current);
    out.push(current);
    stack.push(...childIdsOf(node));
  }
  return out;
}

function clip(text: string): string | undefined {
  const tidy = text.replace(/\s+/gu, ' ').trim();
  if (tidy === '') return undefined;
  return tidy.length > NAME_MAX_CHARS ? tidy.slice(0, NAME_MAX_CHARS) : tidy;
}

/** An element's words: its own text and its descendants', bounded. */
export function treeElementText(element: Json): string {
  const parts: string[] = [];
  const stack: unknown[] = [element];
  let seen = 0;
  while (stack.length > 0 && seen < TREE_SCAN_LIMIT) {
    const current = stack.pop();
    seen += 1;
    if (!isRecord(current)) continue;
    if (typeof current['text'] === 'string') parts.push(current['text']);
    const children = current['children'];
    if (Array.isArray(children)) {
      for (let at = children.length - 1; at >= 0; at -= 1) stack.push(children[at]);
    }
  }
  return parts.join(' ');
}

/** A composed region's first h1–h3 in reading order, and its outermost element's `id`. */
function treeNames(tree: unknown): { heading?: string; anchor?: string } {
  if (!isRecord(tree) || !Array.isArray(tree['children'])) return {};
  const first = tree['children'][0];
  const anchor =
    isRecord(first) && isRecord(first['attributes']) && typeof first['attributes']['id'] === 'string'
      ? clip(first['attributes']['id'])
      : undefined;
  const stack: unknown[] = [...(tree['children'] as unknown[])].reverse();
  let seen = 0;
  while (stack.length > 0 && seen < TREE_SCAN_LIMIT) {
    const current = stack.pop();
    seen += 1;
    if (!isRecord(current)) continue;
    if (current['kind'] === 'element' && typeof current['tag'] === 'string') {
      if (HEADING_TAGS.has(current['tag'])) {
        const heading = clip(treeElementText(current));
        if (heading !== undefined) {
          return { heading, ...(anchor === undefined ? {} : { anchor }) };
        }
      }
    }
    const children = current['children'];
    if (Array.isArray(children)) {
      for (let at = children.length - 1; at >= 0; at -= 1) stack.push(children[at]);
    }
  }
  return anchor === undefined ? {} : { anchor };
}

/** A registered block's visible name: its heading or title prop. */
function blockHeading(node: Node): string | undefined {
  for (const key of ['heading', 'title', 'headline']) {
    const value = node.props[key];
    if (typeof value === 'string') {
      const name = clip(value);
      if (name !== undefined) return name;
    }
  }
  return undefined;
}

/** The page's top-level sections in reading order, each with the names a person would use. */
export function outlinePageSections(document: BuilderDocument): readonly PageSectionOutline[] {
  const root = document.nodes[document.rootId];
  return childIdsOf(root).flatMap((id, index): PageSectionOutline[] => {
    const node = document.nodes[id];
    if (node === undefined) return [];
    if (node.type === CUSTOM_CODE) {
      const rawLabel = node.props['label'];
      const label = typeof rawLabel === 'string' ? clip(rawLabel) : undefined;
      const names = treeNames(node.props['tree']);
      return [
        {
          id,
          type: node.type,
          index,
          ...(label === undefined ? {} : { label }),
          ...names,
        },
      ];
    }
    const heading = blockHeading(node);
    return [{ id, type: node.type, index, ...(heading === undefined ? {} : { heading }) }];
  });
}

// ── Naming: which section a request's words point at ────────────────────────

/** A vocabulary written as folded words separated by spaces, one or more lines of them. */
function wordSet(...lines: readonly string[]): ReadonlySet<string> {
  return new Set(lines.flatMap((line) => line.trim().split(/\s+/u)));
}

/**
 * Words that never NAME a section: the word "section" itself, the page, the
 * function words around a name and the verbs that start an edit. Folded
 * spellings (normalizeIntentText), compared against every reading of a
 * token, so «القسم» and «قسمها» are both «قسم». Role nouns (title, button,
 * price…) are NOT here: a section can be called «الأسعار» or "Pricing", and
 * the direct-edit parser drops the edit's own role word itself.
 */
const NOT_A_NAME: ReadonlySet<string> = wordSet(
  'قسم اقسام سكشن سكشنات جزء صفحه موقع اسم في من الي علي عن مع او و ب ل تبع تبعه تاع حق',
  'خاص هذا هذه هاد هاي هذي اللي الذي التي لي لنا يا ابو غضب غير تغيير بدل تبديل استبدل عدل',
  'تعديل اجعل خلي حط ضع اكتب سمي ممكن لو سمحت فضلك رجاء',
  'the a an of in on at to for with and or my our your this that it its is be please',
  'section part block area page name change rename set make update replace edit',
);

/** Words that put the whole page in scope: an edit that says them is not about one section. */
const WHOLE_PAGE: ReadonlySet<string> = wordSet(
  'all every everything everywhere whole entire page site website sections',
  'كل كله كلها جميع كامل كامله صفحه موقع اقسام',
);

/** Every reading of a token, plus the plural and feminine endings folded away. */
export function stemsOf(token: IntentToken): ReadonlySet<string> {
  const stems = new Set<string>();
  for (const { stem } of token.readings) {
    stems.add(stem);
    if (token.arabic) {
      // «الشهادات» and «شهادة» are one word to a person naming a section.
      if (stem.length >= 5 && stem.endsWith('ات')) stems.add(stem.slice(0, -2));
      if (stem.length >= 4 && stem.endsWith('ه')) stems.add(stem.slice(0, -1));
    } else {
      if (stem.length > 4 && stem.endsWith('es')) stems.add(stem.slice(0, -2));
      if (stem.length > 3 && stem.endsWith('s')) stems.add(stem.slice(0, -1));
    }
  }
  return stems;
}

/** One word of a request or a name, with every stem it can be matched by. */
export interface NamingWord {
  readonly raw: string;
  readonly stems: ReadonlySet<string>;
}

function isNameWord(token: IntentToken): boolean {
  return !token.readings.some(({ stem }) => NOT_A_NAME.has(stem)) && /\p{L}/u.test(token.raw);
}

/** The words of `text` that can name something, folded and stemmed. */
export function namingWords(text: string): readonly NamingWord[] {
  return tokenize(normalizeIntentText(text))
    .filter(isNameWord)
    .map((token) => ({ raw: token.raw, stems: stemsOf(token) }));
}

/** Whether the words speak of the whole page rather than one section. */
export function speaksOfWholePage(text: string): boolean {
  return tokenize(normalizeIntentText(text)).some((token) =>
    token.readings.some(({ stem }) => WHOLE_PAGE.has(stem)),
  );
}

function sharesStem(left: NamingWord, right: NamingWord): boolean {
  for (const stem of left.stems) if (right.stems.has(stem)) return true;
  return false;
}

/** How much of a name the words say: each name word matched to at most one request word. */
function nameMatch(
  name: readonly NamingWord[],
  words: readonly NamingWord[],
): { readonly matched: number; readonly used: ReadonlySet<number>; readonly letters: number } {
  const used = new Set<number>();
  let matched = 0;
  let letters = 0;
  for (const part of name) {
    const at = words.findIndex((word, index) => !used.has(index) && sharesStem(part, word));
    if (at < 0) continue;
    used.add(at);
    matched += 1;
    letters += part.raw.length;
  }
  return { matched, used, letters };
}

/** The names a section answers to: its label, heading, anchor and (for a block) its type. */
function namesOf(section: PageSectionOutline): readonly (readonly NamingWord[])[] {
  const names: string[] = [];
  if (section.label !== undefined) names.push(section.label);
  if (section.heading !== undefined) names.push(section.heading);
  if (section.anchor !== undefined) names.push(section.anchor.replace(/[-_]+/gu, ' '));
  if (section.type !== CUSTOM_CODE) {
    const bare = section.type.slice(section.type.lastIndexOf('.') + 1);
    names.push(bare.replace(/([a-z\d])([A-Z])/gu, '$1 $2').replace(/[-_]+/gu, ' '));
  }
  return names.map(namingWords).filter((words) => words.length > 0);
}

/** A section a request's words name, and how surely. */
export interface SectionMention {
  readonly section: PageSectionOutline;
  /** 0–1: the share of the best-matching name the words say. */
  readonly score: number;
  /** The share of the request's naming words that name explains. */
  readonly coverage: number;
}

/**
 * Every section the words name at least half of, best first. Three letters
 * of matched name at least, so a stray «و» never names anything.
 */
export function sectionMentions(
  words: readonly NamingWord[],
  sections: readonly PageSectionOutline[],
): readonly SectionMention[] {
  if (words.length === 0) return [];
  const mentions: SectionMention[] = [];
  for (const section of sections) {
    let best: SectionMention | undefined;
    for (const name of namesOf(section)) {
      const match = nameMatch(name, words);
      if (match.matched === 0 || match.letters < 3) continue;
      const score = match.matched / name.length;
      if (score < PARTIAL_MATCH) continue;
      const coverage = match.used.size / words.length;
      if (
        best === undefined ||
        score > best.score ||
        (score === best.score && coverage > best.coverage)
      ) {
        best = { section, score, coverage };
      }
    }
    if (best !== undefined) mentions.push(best);
  }
  return mentions.sort(
    (left, right) =>
      right.score - left.score ||
      right.coverage - left.coverage ||
      left.section.index - right.section.index,
  );
}

/**
 * The ONE section the words name, or undefined when they name none or more
 * than one with equal confidence. A whole-name match beats partial ones; two
 * whole names, or two best partials, are a tie and name nothing.
 */
export function namedSection(
  words: readonly NamingWord[],
  sections: readonly PageSectionOutline[],
): PageSectionOutline | undefined {
  const [best, second] = sectionMentions(words, sections);
  if (best === undefined) return undefined;
  if (second !== undefined && second.score === best.score) return undefined;
  if (best.score < 1 && second !== undefined) return undefined;
  return best.section;
}

/**
 * The sections a request is about, for the model path: every section named in
 * full (else the one best partial), plus the sections holding the selection.
 * Undefined — the full document — when the route is not an edit or a new
 * section, the words speak of the whole page, more than three sections are
 * named, or focusing would hide nothing.
 */
export function resolveDocumentFocus(input: {
  readonly request: string;
  readonly document: BuilderDocument;
  readonly selection: readonly NodeId[];
  readonly intent: IntentKind;
}): AiDocumentFocus | undefined {
  const kind = input.intent;
  if (kind !== 'edit' && kind !== 'add-section') return undefined;
  if (speaksOfWholePage(input.request)) return undefined;
  const sections = outlinePageSections(input.document);
  if (sections.length < 2) return undefined;
  const mentions = sectionMentions(namingWords(input.request), sections);
  const whole = mentions.filter(({ score }) => score === 1);
  const named =
    whole.length > 0
      ? whole.map(({ section }) => section.id)
      : mentions.length === 1 && mentions[0] !== undefined
        ? [mentions[0].section.id]
        : [];
  if (named.length > MAX_FOCUSED_SECTIONS) return undefined;
  const parents = parentsOf(input.document);
  const pinned = input.selection.flatMap((id) => {
    if (id === input.document.rootId) return [];
    const section = sectionOf(id, input.document, parents);
    return section === undefined ? [] : [section];
  });
  const focused = new Set([...named, ...pinned]);
  if (focused.size === 0 || focused.size >= sections.length) return undefined;
  return Object.freeze({
    nodeIds: Object.freeze(sections.filter(({ id }) => focused.has(id)).map(({ id }) => id)),
    kind,
  });
}
