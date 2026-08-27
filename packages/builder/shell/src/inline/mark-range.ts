import { emptyRichText, type RichTextInline, type RichTextMark } from '@craftkit/builder-schema';

/**
 * Ranges over a STORED rich-text document (009 contract §15) — the pure half of
 * the built-in editing path, with no editing engine anywhere.
 *
 * THE OFFSET MODEL — shared verbatim with `dom-range.ts`: an offset indexes the
 * document's text with ONE newline position for every hard break and ONE
 * separator position between each pair of adjacent inline containers
 * (paragraph, heading, the paragraph inside a listItem — every block that
 * directly holds text). For doc(para('a', hardBreak, 'b'), para('cd')):
 *
 *     offsets:  0 a 1 ↵ 2 b 3 | 4 c 5 d 6      richTextLength === 6
 *                         ^ break  ^ separator    plainTextOf === 'a\nb\ncd'
 *
 * Both kinds of newline are positions. A hard break's interval distinguishes
 * the caret before it (1) from the caret after it (2), while the container
 * separator distinguishes the end of one block (3) from the start of the next
 * (4). Deleting a hard-break interval removes the break; deleting a container
 * separator MERGES the two blocks, the survivor keeping the FIRST block's type.
 * No mark ever applies to either newline position: toggling across one marks the
 * text on both sides and leaves the structure untouched. An EMPTY document
 * (doc(para())) has length 0, and offset 0 is a valid caret in it.
 *
 * Everything here reads stored JSON, which is `unknown` until the write door
 * says otherwise (Law J): a shape this cannot read is handed BACK untouched
 * rather than repaired into a document the author never wrote — hence the
 * `unknown` return types, which say exactly that. Reading is the tolerant
 * concern; writing stays the door's strict one. What this DOES produce from a
 * door-valid document is itself door-valid.
 *
 * PURE: no DOM, no globals, no time — and never a mutation of the input.
 */

export interface TextRange {
  from: number;
  to: number;
}

export type ToggleableMark = 'bold' | 'italic';

interface LooseNode {
  type?: unknown;
  text?: unknown;
  marks?: unknown;
  attrs?: unknown;
  content?: unknown;
}

/** Endpoints as a caller offered them — a range is no more trusted than a doc. */
interface LooseRange {
  from?: unknown;
  to?: unknown;
}

/** A node holding inline content, with the offset span its text occupies. */
interface TextContainer {
  content: unknown[];
  start: number;
  end: number;
}

/**
 * Structural ceiling, matching the door's own `RICH_TEXT_MAX_DEPTH`: nothing
 * deeper is storable, so nothing deeper is part of the offset space — and a
 * hostile document can never recurse this module into a stack overflow.
 */
const MAX_DEPTH = 30;

const INLINE_CONTAINERS = new Set(['paragraph', 'heading']);

/** What a separator position reads as when the document is read as text. */
const SEPARATOR = '\n';

const asNode = (value: unknown): LooseNode | null =>
  typeof value === 'object' && value !== null ? value : null;

const asRange = (value: unknown): LooseRange | null =>
  typeof value === 'object' && value !== null ? value : null;

const contentOf = (node: LooseNode): unknown[] => (Array.isArray(node.content) ? node.content : []);

/** The string a text node contributes to the offset space. */
const textOf = (value: unknown): string | null => {
  const node = asNode(value);
  return node?.type === 'text' && typeof node.text === 'string' ? node.text : null;
};

const isHardBreak = (value: unknown): boolean => asNode(value)?.type === 'hardBreak';

/** Text read through the offset model: a hard break is one newline position. */
const inlineTextOf = (value: unknown): string | null =>
  textOf(value) ?? (isHardBreak(value) ? SEPARATOR : null);

const inlineLengthOf = (value: unknown): number => inlineTextOf(value)?.length ?? 0;

const clamp = (value: number, low: number, high: number): number =>
  Math.min(Math.max(value, low), high);

/** An offset is a whole number of positions — anything else is not one. */
const isOffset = (value: unknown): value is number => Number.isInteger(value);

function projectMark(value: unknown): RichTextMark | null {
  const mark = asNode(value);
  if (mark === null) {
    return null;
  }
  if (mark.type === 'bold' || mark.type === 'italic') {
    return { type: mark.type };
  }
  if (mark.type === 'link') {
    const attrs = asNode(mark.attrs);
    const href = attrs === null ? undefined : (attrs as { href?: unknown }).href;
    return typeof href === 'string' ? { type: 'link', attrs: { href } } : null;
  }
  return null;
}

/**
 * A run's marks, projected onto the stored whitelist. A mark this cannot read
 * could not have been stored either, so dropping it while REWRITING a run loses
 * nothing a door would have kept — and runs that are never rewritten keep their
 * object identity, so nothing else in the document is touched at all.
 */
const marksOf = (value: unknown): RichTextMark[] => {
  const node = asNode(value);
  const raw = node !== null && Array.isArray(node.marks) ? node.marks : [];
  return raw.map(projectMark).filter((mark): mark is RichTextMark => mark !== null);
};

/** Link marks carry a target, so two links are the same mark only when it matches. */
const markKey = (mark: RichTextMark): string =>
  mark.type === 'link' ? `link:${mark.attrs.href}` : mark.type;

/** Order-insensitive identity of a run's mark set — what merging compares. */
const markSetKey = (marks: RichTextMark[]): string => JSON.stringify(marks.map(markKey).sort());

const hasMark = (marks: RichTextMark[], mark: ToggleableMark): boolean =>
  marks.some((entry) => entry.type === mark);

const withMark = (marks: RichTextMark[], mark: ToggleableMark): RichTextMark[] =>
  hasMark(marks, mark) ? marks : [...marks, { type: mark }];

const withoutMark = (marks: RichTextMark[], mark: ToggleableMark): RichTextMark[] =>
  marks.filter((entry) => entry.type !== mark);

const makeText = (text: string, marks: RichTextMark[]): RichTextInline =>
  marks.length === 0 ? { type: 'text', text } : { type: 'text', text, marks };

function readDoc(value: unknown): LooseNode | null {
  const node = asNode(value);
  return node?.type === 'doc' && Array.isArray(node.content) ? node : null;
}

/**
 * A node whose content is TEXT rather than blocks. Paragraphs and headings are
 * containers even when empty (a caret still sits in one); anything else counts
 * only when it actually holds text, which keeps doc, lists, list items — and
 * any node type this module has never heard of — on the recursion path.
 */
function isTextContainer(node: LooseNode): boolean {
  if (typeof node.type === 'string' && INLINE_CONTAINERS.has(node.type)) {
    return true;
  }
  return contentOf(node).some((child) => inlineTextOf(child) !== null);
}

const LIST_TYPES = new Set(['bulletList', 'orderedList']);

/**
 * A listItem that LOST its opening paragraph to a merge but still holds later
 * blocks is STRANDED: the door declares a list item as `[paragraph, ...blocks]`
 * and would refuse to save it as it stands. Handing it a replacement empty
 * paragraph is no repair at all — a paragraph is a NEW inline container, one
 * offset plus one separator, so the document would no longer read as the splice
 * the caller asked for. A stranded item DISSOLVES instead: its surviving blocks
 * take the item's place in the parent list (see `editContainers`), which keeps
 * every surviving inline container in exactly its old document order. Only an
 * item that OPENED with a paragraph dissolves — a document malformed on the way
 * in is left as found, never repaired into one the author did not write.
 */
const strandedListItem = (node: LooseNode, original: unknown[], content: unknown[]): boolean =>
  node.type === 'listItem' &&
  asNode(original[0])?.type === 'paragraph' &&
  asNode(content[0])?.type !== 'paragraph';

/**
 * A list one of whose stranded items dissolved now holds loose BLOCKS between
 * its intact items. Runs of intact items stay grouped as lists of the SAME
 * type; each loose block stands exactly where it stood, spliced into the
 * list's parent — a shape the door takes both at doc level and in a list
 * item's tail, with the offset space still reading as the splice asked for.
 */
function regroupedList(node: LooseNode, content: unknown[]): unknown[] {
  const out: unknown[] = [];
  let items: unknown[] = [];
  const flush = (): void => {
    if (items.length > 0) {
      out.push({ ...node, content: items });
      items = [];
    }
  };
  for (const child of content) {
    if (asNode(child)?.type === 'listItem') {
      items.push(child);
    } else {
      flush();
      out.push(child);
    }
  }
  flush();
  return out;
}

/**
 * Rebuild the document, handing every inline container to `edit` in document
 * order — the ONE traversal both the reader and every transform use, so their
 * container ordinals always line up.
 *
 * Returning the container unchanged keeps its identity, so a transform that
 * touches one paragraph leaves every other object in the tree exactly as it
 * was. Returning null removes it, and with it any ancestor it empties — while
 * an ancestor that survives is left in a shape the door still takes: a list
 * item stranded without its opening paragraph dissolves into its surviving
 * blocks, and the list around it regroups (see `strandedListItem`).
 */
function editContainers(
  doc: LooseNode,
  edit: (container: LooseNode, index: number) => LooseNode | null,
): unknown {
  let index = -1;
  // An `unknown[]` return is a SPLICE: blocks a structural repair hands up to
  // stand in the parent's content where the visited node stood. Only this
  // traversal ever constructs one, and it never visits an array child (junk
  // arrays are pushed through untouched), so the marker cannot collide with
  // anything read from the document itself.
  const visit = (node: LooseNode, depth: number): LooseNode | unknown[] | null => {
    // Nesting past the ceiling is left exactly as found — see MAX_DEPTH.
    if (depth >= MAX_DEPTH) {
      return node;
    }
    if (isTextContainer(node)) {
      index += 1;
      return edit(node, index);
    }
    const children = contentOf(node);
    const next: unknown[] = [];
    let changed = false;
    let dissolved = false;
    for (const child of children) {
      const record = asNode(child);
      if (record === null || Array.isArray(child)) {
        next.push(child);
        continue;
      }
      const mapped = visit(record, depth + 1);
      if (mapped !== record) {
        changed = true;
      }
      if (Array.isArray(mapped)) {
        dissolved = true;
        next.push(...mapped);
      } else if (mapped !== null) {
        next.push(mapped);
      }
    }
    if (!changed) {
      return node;
    }
    if (next.length === 0) {
      return null;
    }
    if (strandedListItem(node, children, next)) {
      return next;
    }
    if (dissolved && typeof node.type === 'string' && LIST_TYPES.has(node.type)) {
      return regroupedList(node, next);
    }
    return { ...node, content: next };
  };
  const result = visit(doc, 0);
  /* v8 ignore next 6 -- the doc node is neither a list item nor a list, so it
     never dissolves into a splice, and the edited container always survives,
     so the document cannot empty out this way today; the guarantee is stated
     here anyway because a zero-block document is unloadable in every editor. */
  if (result === null || Array.isArray(result)) {
    return { ...doc, content: emptyRichText().content };
  }
  return result;
}

function readContainers(doc: LooseNode): TextContainer[] {
  const containers: TextContainer[] = [];
  let offset = 0;
  editContainers(doc, (node) => {
    const content = contentOf(node);
    // ONE separator between adjacent containers — the offset that keeps the end
    // of a block and the start of the next from being the same number.
    const start = containers.length === 0 ? offset : offset + 1;
    offset = start;
    for (const child of content) {
      offset += inlineLengthOf(child);
    }
    containers.push({ content, start, end: offset });
    return node;
  });
  return containers;
}

const totalLength = (containers: TextContainer[]): number =>
  containers[containers.length - 1]?.end ?? 0;

/**
 * The range as offsets this document actually has. An end past the last
 * position CLAMPS (a selection that overshoots still means "to the end"), but a
 * reversed, non-integer or missing range is refused outright — guessing what
 * such a caller meant is how documents get corrupted. A range that is not an
 * object at all is refused the same way, never thrown over.
 */
function resolveRange(range: unknown, length: number): TextRange | null {
  const offsets = asRange(range);
  if (offsets === null || !isOffset(offsets.from) || !isOffset(offsets.to)) {
    return null;
  }
  const from = clamp(offsets.from, 0, length);
  const to = clamp(offsets.to, 0, length);
  return to < from ? null : { from, to };
}

/**
 * The caret a REFUSED edit leaves the caller with: the one they still have,
 * clamped into the document. Jumping to the start of the document because a
 * range could not be read is a caret the user never asked for — but a caret
 * must always be an offset the returned document can ADDRESS (`isOffset`,
 * within [0, length]), so a `from` that never was one falls back to 0.
 */
function refusedCaret(range: unknown, length: number): number {
  const from = asRange(range)?.from;
  return isOffset(from) && from >= 0 ? Math.min(from, length) : 0;
}

/**
 * True when the span covers at least one character and EVERY run it overlaps
 * carries the mark. A zero-length run holds no characters, so it can neither
 * satisfy nor refute a claim about every character in a range — it is skipped,
 * and a range covering nothing but separators or empty runs is not "fully
 * marked" at all.
 */
function everyRunCarries(
  containers: TextContainer[],
  span: TextRange,
  mark: ToggleableMark,
): boolean {
  let covered = false;
  for (const container of containers) {
    let offset = container.start;
    for (const child of container.content) {
      const text = textOf(child);
      if (text === null || text.length === 0) {
        offset += inlineLengthOf(child);
        continue;
      }
      const start = offset;
      offset += text.length;
      if (start >= span.to || offset <= span.from) {
        continue;
      }
      if (!hasMark(marksOf(child), mark)) {
        return false;
      }
      covered = true;
    }
  }
  return covered;
}

/**
 * The anti-fragmentation rule: adjacent runs with the same mark set are ONE
 * run, and a zero-length run is not a run at all. Without it every toggle would
 * leave a seam behind, and "bold on, bold off" would never return the document
 * it started from.
 */
function mergeRuns(content: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const child of content) {
    const text = textOf(child);
    if (text === null) {
      out.push(child);
      continue;
    }
    if (text.length === 0) {
      continue;
    }
    const previous = out[out.length - 1];
    const previousText = textOf(previous);
    if (previousText !== null && markSetKey(marksOf(previous)) === markSetKey(marksOf(child))) {
      out[out.length - 1] = makeText(previousText + text, marksOf(previous));
      continue;
    }
    out.push(child);
  }
  return out;
}

function withContent(node: LooseNode, content: unknown[]): LooseNode {
  if (content.length > 0) {
    return { ...node, content };
  }
  // An emptied container drops the key entirely — emptyRichText()'s shape, and
  // what the door's optional `content` expects.
  const next = { ...node };
  delete next.content;
  return next;
}

function markContainer(
  container: TextContainer,
  span: TextRange,
  mark: ToggleableMark,
  add: boolean,
): unknown[] {
  const out: unknown[] = [];
  let offset = container.start;
  for (const child of container.content) {
    const text = textOf(child);
    if (text === null) {
      out.push(child);
      offset += inlineLengthOf(child);
      continue;
    }
    const start = offset;
    offset += text.length;
    const from = Math.max(start, span.from);
    const to = Math.min(offset, span.to);
    if (from >= to) {
      out.push(child);
      continue;
    }
    const marks = marksOf(child);
    const marked = add ? withMark(marks, mark) : withoutMark(marks, mark);
    // The split halves keep the run's ORIGINAL marks: a partial toggle never
    // disturbs the formatting it was not asked about.
    if (start < from) {
      out.push(makeText(text.slice(0, from - start), marks));
    }
    out.push(makeText(text.slice(from - start, to - start), marked));
    if (to < offset) {
      out.push(makeText(text.slice(to - start), marks));
    }
  }
  return mergeRuns(out);
}

/** True only when the span reaches a TEXT character, never a break position. */
function overlapsText(container: TextContainer, span: TextRange): boolean {
  let offset = container.start;
  for (const child of container.content) {
    const text = textOf(child);
    if (text === null) {
      offset += inlineLengthOf(child);
      continue;
    }
    const end = offset + text.length;
    if (text.length > 0 && offset < span.to && end > span.from) {
      return true;
    }
    offset = end;
  }
  return false;
}

/** Inline nodes covering [0, cut) — a container's surviving head. */
function headOf(content: unknown[], cut: number): unknown[] {
  const out: unknown[] = [];
  let offset = 0;
  for (const child of content) {
    const text = textOf(child);
    if (text === null) {
      const length = inlineLengthOf(child);
      if (length > 0) {
        // A hard break owns [offset, offset + 1): the head takes it only once
        // the cut is AFTER it. At its start the break belongs to the tail, so
        // inserting before and after the visual line break are distinct edits.
        if (offset + length <= cut) {
          out.push(child);
        }
        offset += length;
      } else if (offset <= cut) {
        // Unknown zero-width inline nodes retain the old left-leaning rule.
        out.push(child);
      }
      continue;
    }
    if (offset >= cut) {
      break;
    }
    const take = Math.min(text.length, cut - offset);
    out.push(take === text.length ? child : makeText(text.slice(0, take), marksOf(child)));
    offset += text.length;
  }
  return out;
}

/** Inline nodes covering [cut, end) — a container's surviving tail. */
function tailOf(content: unknown[], cut: number): unknown[] {
  const out: unknown[] = [];
  let offset = 0;
  for (const child of content) {
    const text = textOf(child);
    if (text === null) {
      const length = inlineLengthOf(child);
      if (length > 0) {
        // At the break's start it survives in the tail; at its end it has been
        // crossed and does not. Together with `headOf`, this removes exactly
        // [before-break, after-break) when Backspace targets that interval.
        if (offset >= cut) {
          out.push(child);
        }
        offset += length;
      } else if (offset > cut) {
        out.push(child);
      }
      continue;
    }
    const end = offset + text.length;
    if (end > cut) {
      const drop = Math.max(cut - offset, 0);
      out.push(drop === 0 ? child : makeText(text.slice(drop), marksOf(child)));
    }
    offset = end;
  }
  return out;
}

/**
 * The marks of the character at `index`. A separator position holds no
 * character — no run spans it — so it carries no marks either.
 */
function marksAtCharacter(containers: TextContainer[], index: number): RichTextMark[] | null {
  if (index < 0) {
    return null;
  }
  for (const container of containers) {
    let offset = container.start;
    for (const child of container.content) {
      const text = textOf(child);
      if (text === null) {
        offset += inlineLengthOf(child);
        continue;
      }
      if (index >= offset && index < offset + text.length) {
        return marksOf(child);
      }
      offset += text.length;
    }
  }
  return null;
}

/**
 * Marks the inserted text inherits: those of the character BEFORE the caret, so
 * typing continues the run you are typing at the end of. At the start of a
 * block there is no such character — the separator before it carries none — and
 * the run the caret opens decides instead, which is why typing at the visible
 * start of a paragraph takes ITS formatting rather than the previous block's.
 */
const inheritedMarks = (containers: TextContainer[], at: number): RichTextMark[] =>
  marksAtCharacter(containers, at - 1) ?? marksAtCharacter(containers, at) ?? [];

/** Number of offset positions in the document — text plus block separators. */
export function richTextLength(doc: unknown): number {
  const parsed = readDoc(doc);
  return parsed === null ? 0 : totalLength(readContainers(parsed));
}

/** The document's text in document order, separators reading as newlines. */
export function plainTextOf(doc: unknown): string {
  const parsed = readDoc(doc);
  if (parsed === null) {
    return '';
  }
  const blocks = readContainers(parsed).map((container) =>
    container.content.reduce<string>((text, child) => text + (inlineTextOf(child) ?? ''), ''),
  );
  return blocks.join(SEPARATOR);
}

/**
 * True when EVERY character in [from, to) carries the mark. A collapsed range,
 * an empty one, or one covering nothing but separators is false (there is
 * nothing that is fully marked).
 */
export function isMarkActive(doc: unknown, range: TextRange, mark: ToggleableMark): boolean {
  const parsed = readDoc(doc);
  if (parsed === null) {
    return false;
  }
  const containers = readContainers(parsed);
  const span = resolveRange(range, totalLength(containers));
  if (span === null || span.from === span.to) {
    return false;
  }
  return everyRunCarries(containers, span, mark);
}

/**
 * Toggle the mark across [from, to): REMOVE it when isMarkActive is already
 * true for that range, otherwise ADD it to every character in the range.
 * A collapsed/empty/out-of-range selection returns the document unchanged, as
 * does a document this cannot read — which is why the return is `unknown`: it
 * is the document you passed, unchanged, when it cannot be read. Unchanged
 * means IDENTICAL: a range that overlaps no character at all — separators and
 * zero-width containers only — has nothing a mark could change, so the very
 * same document comes back, no rebuilt copy and no run dropped.
 */
export function toggleMark(doc: unknown, range: TextRange, mark: ToggleableMark): unknown {
  const parsed = readDoc(doc);
  if (parsed === null) {
    return doc;
  }
  const containers = readContainers(parsed);
  const span = resolveRange(range, totalLength(containers));
  if (span === null || span.from === span.to) {
    return doc;
  }
  // A range that is ALREADY fully marked loses the mark; anything else gains it
  // everywhere, so a half-bold selection bolds the rest rather than flipping it.
  const add = !everyRunCarries(containers, span, mark);
  const edits = new Map<number, unknown[]>();
  containers.forEach((container, index) => {
    // A container overlaps the span only when at least one of its CHARACTERS
    // does, which needs `start < end`: a zero-width container (an empty block)
    // holds nothing a mark could change, and rewriting it anyway would hand
    // back a new document — and canonicalise its empty runs — for an edit
    // that edited nothing, breaking "unchanged means identical".
    if (overlapsText(container, span)) {
      edits.set(index, markContainer(container, span, mark, add));
    }
  });
  return editContainers(parsed, (node, index) => {
    const content = edits.get(index);
    return content === undefined ? node : withContent(node, content);
  });
}

/**
 * Replace [from, to) with `text` (either side may be empty: pure insert or
 * pure delete). Inserted text inherits the marks of the character at from-1
 * when there is one, else the marks of the character at from (typing
 * continues the run you are typing at the end of). Returns the new document —
 * `unknown`, being the document you passed, unchanged, when it cannot be read —
 * and the caret offset AFTER the change (from + text.length), or the caret the
 * caller still had when the edit was refused.
 *
 * THE SPLICE LAW: for a door-valid document the result reads as EXACTLY the
 * splice asked for — `plainTextOf(out)` is `plainTextOf(doc)` with [from, to)
 * replaced by `text` — and is itself a document the door accepts. Structural
 * repairs (block merges, dissolved list items) never add or remove a separator
 * the caller did not ask about.
 */
export function replaceRange(
  doc: unknown,
  range: TextRange,
  text: string,
): { doc: unknown; caret: number } {
  const parsed = readDoc(doc);
  if (parsed === null) {
    return { doc, caret: refusedCaret(range, 0) };
  }
  const containers = readContainers(parsed);
  const length = totalLength(containers);
  const span = resolveRange(range, length);
  if (span === null) {
    return { doc, caret: refusedCaret(range, length) };
  }
  if (span.from === span.to && text.length === 0) {
    return { doc, caret: span.from };
  }
  const caret = span.from + text.length;
  // Every offset belongs to exactly ONE container — that is what the separator
  // between two blocks buys — so the container a caret sits in is simply the
  // first whose end it has not passed. An insert at the visible start of a
  // block therefore lands in THAT block, not in the one before it.
  const startIndex = containers.findIndex((container) => span.from <= container.end);
  const start = containers[startIndex];
  if (start === undefined) {
    // Nowhere to put the text: a document with no inline container at all gains
    // the paragraph it lacks rather than losing the keystroke.
    const content = [...contentOf(parsed), { type: 'paragraph', content: [makeText(text, [])] }];
    return { doc: { ...parsed, content }, caret };
  }
  // The container `to` sits in. When it is a LATER one the range swallowed at
  // least one separator, so those blocks MERGE into the first.
  const endIndex = containers.findIndex((container) => span.to <= container.end);
  const end = containers[endIndex] ?? start;
  const inserted = text.length === 0 ? [] : [makeText(text, inheritedMarks(containers, span.from))];
  const content = mergeRuns([
    ...headOf(start.content, span.from - start.start),
    ...inserted,
    ...tailOf(end.content, span.to - end.start),
  ]);
  return {
    doc: editContainers(parsed, (node, index) => {
      if (index === startIndex) {
        return withContent(node, content);
      }
      // Everything the range swallowed after the first container goes with it:
      // the blocks MERGE, and the survivor keeps the FIRST block's type.
      return index > startIndex && index <= endIndex ? null : node;
    }),
    caret,
  };
}
