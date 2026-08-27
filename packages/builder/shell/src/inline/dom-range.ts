/**
 * DOM ⇄ document-offset mapping for the built-in (engine-free) rich-text path.
 *
 * THE OFFSET MODEL — shared verbatim with `mark-range.ts`: an offset indexes the
 * document's text with ONE newline position for every `<br>` hard break and
 * ONE separator position between each pair of adjacent INLINE CONTAINERS
 * (paragraph, heading, the paragraph inside a list item — every block that
 * directly holds text). For doc(para('a', hardBreak, 'b'), para('cd')):
 *
 *     0 a 1 ↵ 2 b 3 | 4 c 5 d 6     length 6, plain text 'a\nb\ncd'
 *             ^ break  ^ separator
 *
 * Both newline kinds are positions. The hard break distinguishes the caret
 * before it (1) from the caret after it (2); the container separator keeps the
 * end of one paragraph (3) distinct from the start of the next (4). The DOM
 * and stored-document modules therefore map every visible caret identically.
 *
 * That is why this module walks the text nodes AND the containers they belong
 * to: `mark-range` counts inline containers in the stored document, this one
 * counts them in the rendered DOM, and the two cannot drift.
 *
 * An EMPTY document (no text at all) has length 0, and offset 0 is a real,
 * addressable caret position there — a root with nothing in it is still
 * somewhere to type.
 *
 * This is the only module on the built-in rich path that may touch the DOM
 * (`mark-range.ts` stays pure), and it touches nothing beyond the root's own
 * document — no engine, no document mutation, no globals.
 */

export interface TextRange {
  from: number;
  to: number;
}

export interface RangeBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RangeGeometry {
  box: RangeBox;
  rects: RangeBox[];
}

/** The boundary-point contract shared by live `Range` and browser `StaticRange`. */
export interface DomRangeLike {
  readonly startContainer: Node;
  readonly startOffset: number;
  readonly endContainer: Node;
  readonly endOffset: number;
}

const clamp = (value: number, low: number, high: number): number =>
  Math.min(Math.max(value, low), high);

/**
 * Elements that never interrupt a run of text. Everything else counts as a
 * BLOCK: it closes the run before it and may open one of its own, which is how
 * a separator gets between two paragraphs without this module ever having to
 * read the stored document's node types.
 */
const INLINE_TAGS = new Set([
  'A',
  'ABBR',
  'B',
  'BDI',
  'BDO',
  'BR',
  'CITE',
  'CODE',
  'DATA',
  'DEL',
  'DFN',
  'EM',
  'I',
  'IMG',
  'INS',
  'KBD',
  'MARK',
  'Q',
  'S',
  'SAMP',
  'SMALL',
  'SPAN',
  'STRONG',
  'SUB',
  'SUP',
  'TIME',
  'U',
  'VAR',
  'WBR',
]);

/**
 * Blocks that hold a caret even with NO text — `mark-range`'s INLINE_CONTAINERS
 * (paragraph, heading) in rendered form. Every other block joins the offset
 * space only when it actually holds text, which keeps wrappers, lists, list
 * items — and rules, images, anything this module has never heard of — out of
 * it, exactly as the stored side keeps them off its container list.
 */
const EMPTY_CONTAINER_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

type InlineUnit = Text | HTMLBRElement;

/** One inline container's run, with the span its text and breaks occupy. */
interface Segment {
  /** The container itself — where an EMPTY one puts its caret. */
  block: Element;
  units: InlineUnit[];
  /** Span in inline units (no block separators); the offset adds the ordinal. */
  contentStart: number;
  contentEnd: number;
}

interface Position {
  node: Node;
  offset: number;
}

const isInline = (element: Element): boolean => INLINE_TAGS.has(element.tagName);

const isHardBreak = (node: Node): node is HTMLBRElement =>
  node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'BR';

const isTextUnit = (unit: InlineUnit): unit is Text => unit.nodeType === Node.TEXT_NODE;

const unitLength = (unit: InlineUnit): number => (isTextUnit(unit) ? unit.data.length : 1);

/** The inline container a text node or hard break belongs to. */
function blockOf(node: Node, root: HTMLElement): Element {
  for (
    let current: Node | null = node.parentNode;
    current !== null && current !== root;
    current = current.parentNode
  ) {
    if (current.nodeType === Node.ELEMENT_NODE && !isInline(current as Element)) {
      return current as Element;
    }
  }
  return root;
}

/**
 * Every inline container under `root`, in DOCUMENT order — the offset model's
 * spine. Text nodes and `<br>` hard breaks group into the container that holds
 * them, and a paragraph or heading with no content is a container all the same.
 *
 * ITERATIVE on purpose: this walks whatever DOM it is handed, and a hostile
 * nesting depth must degrade, never overflow the stack.
 */
function segmentsOf(root: HTMLElement): Segment[] {
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );
  const segments: Segment[] = [];
  // The container the run in progress belongs to — null once a block boundary
  // has closed it, so the next text opens a container of its own.
  let openBlock: Element | null = null;
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node as Text;
      const block = blockOf(text, root);
      if (openBlock !== block) {
        segments.push({ block, units: [], contentStart: 0, contentEnd: 0 });
        openBlock = block;
      }
      // The run just opened, or the one this text continues: always the last.
      lastOf(segments)?.units.push(text);
      continue;
    }
    const element = node as Element;
    if (isHardBreak(element)) {
      const block = blockOf(element, root);
      if (openBlock !== block) {
        segments.push({ block, units: [], contentStart: 0, contentEnd: 0 });
        openBlock = block;
      }
      lastOf(segments)?.units.push(element);
      continue;
    }
    if (isInline(element)) {
      continue;
    }
    // A block CLOSES the run before it — text on either side of it belongs to
    // different containers even when both sides share a parent — and a
    // paragraph or heading opens one of its own even while it is still empty.
    if (EMPTY_CONTAINER_TAGS.has(element.tagName)) {
      segments.push({ block: element, units: [], contentStart: 0, contentEnd: 0 });
      openBlock = element;
    } else {
      openBlock = null;
    }
  }
  let content = 0;
  for (const segment of segments) {
    segment.contentStart = content;
    for (const unit of segment.units) {
      content += unitLength(unit);
    }
    segment.contentEnd = content;
  }
  return segments;
}

const lastOf = (segments: readonly Segment[]): Segment | undefined => segments[segments.length - 1];

/** Text and hard-break units the document holds — block separators excluded. */
const contentLengthOf = (segments: readonly Segment[]): number => lastOf(segments)?.contentEnd ?? 0;

/** Offsets the document spans — one separator per container boundary. */
function lengthOf(segments: readonly Segment[]): number {
  const last = lastOf(segments);
  return last === undefined ? 0 : last.contentEnd + segments.length - 1;
}

/**
 * Offsets are INDEXES. A fractional or non-finite one is refused outright rather
 * than rounded: `mark-range` refuses it too, and WebIDL would otherwise truncate
 * it silently into a caret nobody asked for.
 */
const isAddressable = (range: TextRange): boolean =>
  Number.isInteger(range.from) && Number.isInteger(range.to);

/**
 * The range as offsets this document actually HAS: a reversed pair normalises
 * (direction is a caret concern), and an end past the last position clamps — a
 * caller holding a stale offset gets the nearest real caret, never an exception.
 * Every offset that reaches `locate` has come through here.
 */
function resolveRange(segments: readonly Segment[], range: TextRange): TextRange {
  const length = lengthOf(segments);
  return {
    from: clamp(Math.min(range.from, range.to), 0, length),
    to: clamp(Math.max(range.from, range.to), 0, length),
  };
}

/**
 * The DOM point that holds a RESOLVED document offset.
 *
 * A boundary between two text nodes INSIDE one container resolves to the end of
 * the earlier one: the same caret visually, and the offset it maps back to is
 * identical, so the round trip is stable. A boundary BETWEEN containers is not
 * ambiguous at all — the separator gives each side its own offset.
 */
function locate(root: HTMLElement, segments: readonly Segment[], at: number): Position {
  let target = lastOf(segments);
  if (target === undefined) {
    // No inline container anywhere: root itself is the only caret site there is.
    return { node: root, offset: 0 };
  }
  let index = segments.length - 1;
  for (const [ordinal, segment] of segments.entries()) {
    // `+ ordinal` is the separators already crossed — see THE OFFSET MODEL.
    if (at <= segment.contentEnd + ordinal) {
      target = segment;
      index = ordinal;
      break;
    }
  }
  let seen = target.contentStart + index;
  for (const unit of target.units) {
    const next = seen + unitLength(unit);
    if (isTextUnit(unit)) {
      if (at <= next) {
        return { node: unit, offset: at - seen };
      }
    } else if (at <= next) {
      const parent = unit.parentNode;
      if (parent !== null) {
        const childIndex = Array.prototype.indexOf.call(parent.childNodes, unit);
        // `at === seen` is BEFORE the break; `at === seen + 1` is AFTER it.
        return { node: parent, offset: childIndex + (at > seen ? 1 : 0) };
      }
    }
    seen = next;
  }
  // A container with no content of its own — an empty paragraph — still holds
  // a caret at the block's own start.
  return { node: target.block, offset: 0 };
}

/**
 * Whether the boundary lies after `root` when it is not inside root. An
 * ancestor boundary (the select-all shape) is decided by the child index that
 * contains root; unrelated points use document order.
 */
function isAfterRoot(root: HTMLElement, container: Node, offset: number): boolean {
  if (container.contains(root)) {
    let child: Node = root;
    while (child.parentNode !== null && child.parentNode !== container) {
      child = child.parentNode;
    }
    const childIndex = Array.prototype.indexOf.call(container.childNodes, child);
    return clamp(offset, 0, container.childNodes.length) > childIndex;
  }
  return (root.compareDocumentPosition(container) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

/** The direct child of `ancestor` that contains `node`. */
function childUnder(ancestor: Node, node: Node): Node {
  let child = node;
  while (child.parentNode !== null && child.parentNode !== ancestor) {
    child = child.parentNode;
  }
  return child;
}

/** Whether one complete inline unit lies before a DOM boundary point. */
function unitBeforePoint(unit: InlineUnit, container: Node, offset: number): boolean {
  if (container.contains(unit)) {
    const child = childUnder(container, unit);
    const childIndex = Array.prototype.indexOf.call(container.childNodes, child);
    return childIndex < clamp(offset, 0, container.childNodes.length);
  }
  return (container.compareDocumentPosition(unit) & Node.DOCUMENT_POSITION_PRECEDING) !== 0;
}

/**
 * Text characters PLUS hard-break units before a DOM boundary point.
 *
 * Range#toString cannot be used here: it concatenates text but gives `<br>` no
 * character, recreating the exact ambiguity this model exists to remove. The
 * already-built unit walk is the authority in both directions instead.
 */
function contentBefore(
  root: HTMLElement,
  segments: readonly Segment[],
  container: Node,
  offset: number,
): number {
  const length = contentLengthOf(segments);
  if (!root.contains(container)) {
    return isAfterRoot(root, container, offset) ? length : 0;
  }
  let before = 0;
  for (const segment of segments) {
    for (const unit of segment.units) {
      if (unit === container && isTextUnit(unit)) {
        before += clamp(offset, 0, unit.data.length);
      } else if (unitBeforePoint(unit, container, offset)) {
        before += unitLength(unit);
      }
    }
  }
  return clamp(before, 0, length);
}

/**
 * How many separators lie before a point — that is, WHICH container holds it.
 *
 * The container that contains the point decides, and that is the whole reason
 * the model has separators: at a block boundary the character count alone
 * cannot tell the end of one paragraph from the start of the next, but the DOM
 * can. The innermost container wins, so a paragraph nested inside a wrapper
 * this module does not recognise still owns its own text.
 *
 * A point inside NO container — root's own gap between two blocks, or a point
 * outside root entirely — falls to the first text position at or after it,
 * which is the LAST container the character count reaches.
 */
function containerOfPoint(segments: readonly Segment[], container: Node, content: number): number {
  let held = -1;
  let after = 0;
  for (const [ordinal, segment] of segments.entries()) {
    if (content < segment.contentStart || content > segment.contentEnd) {
      continue;
    }
    after = ordinal;
    if (segment.block.contains(container)) {
      held = ordinal;
    }
  }
  return held === -1 ? after : held;
}

const offsetOfPoint = (
  root: HTMLElement,
  segments: readonly Segment[],
  container: Node,
  offset: number,
): number => {
  const content = contentBefore(root, segments, container, offset);
  return content + containerOfPoint(segments, container, content);
};

/**
 * Map two DOM boundary points through the module's ONE offset walk. A range
 * that wraps `root` from an ancestor still resolves to the whole document;
 * one that sits wholly outside on the same side is not a range in this editor.
 */
function offsetsOfPoints(
  root: HTMLElement,
  segments: readonly Segment[],
  firstNode: Node,
  firstOffset: number,
  secondNode: Node,
  secondOffset: number,
): TextRange | null {
  const first = offsetOfPoint(root, segments, firstNode, firstOffset);
  const second = offsetOfPoint(root, segments, secondNode, secondOffset);
  const from = Math.min(first, second);
  const to = Math.max(first, second);
  if (from === to && !root.contains(firstNode) && !root.contains(secondNode)) {
    return null;
  }
  return { from, to };
}

/** Length of the DOM in the exact offset model shared with `mark-range.ts`. */
export function richTextLengthOfDom(root: HTMLElement): number {
  return lengthOf(segmentsOf(root));
}

/** DOM text in the shared model: `<br>` and block separators render as `\n`. */
export function plainTextOfDom(root: HTMLElement): string {
  return segmentsOf(root)
    .map((segment) => segment.units.map((unit) => (isTextUnit(unit) ? unit.data : '\n')).join(''))
    .join('\n');
}

/**
 * A browser-provided target range expressed in the shared document offsets.
 * `beforeinput.getTargetRanges()` returns `StaticRange`; accepting only its
 * boundary contract also keeps this directly testable with an ordinary Range.
 */
export function offsetsOfDomRange(root: HTMLElement, range: DomRangeLike): TextRange | null {
  return offsetsOfPoints(
    root,
    segmentsOf(root),
    range.startContainer,
    range.startOffset,
    range.endContainer,
    range.endOffset,
  );
}

/**
 * The current selection expressed in offsets within `root`, or null when there
 * is no selection or it lies entirely outside root. A collapsed caret yields
 * from === to — including in a root that holds no text at all, where offset 0
 * is a real position and reporting "no selection" would hand the raw
 * contenteditable a keystroke the document never sees.
 */
export function offsetsOfSelection(
  root: HTMLElement,
  selection: Selection | null,
): TextRange | null {
  if (selection === null || selection.rangeCount === 0) {
    return null;
  }
  const { anchorNode, focusNode } = selection;
  if (anchorNode === null || focusNode === null) {
    return null;
  }
  // A BACKWARD selection (focus before anchor) is the same span to the
  // document; direction is a caret concern, not an offset one.
  return offsetsOfPoints(
    root,
    segmentsOf(root),
    anchorNode,
    selection.anchorOffset,
    focusNode,
    selection.focusOffset,
  );
}

/**
 * Put the selection back at these offsets inside root (clamped to root's
 * length). Used after a re-render so a commit never loses the caret. Returns
 * true when it could be applied — a root with no text at all still takes a
 * caret at offset 0. A non-integer offset is refused rather than rounded.
 */
export function applyOffsets(
  root: HTMLElement,
  range: TextRange,
  selection: Selection | null,
): boolean {
  if (selection === null || !isAddressable(range)) {
    return false;
  }
  const segments = segmentsOf(root);
  const span = resolveRange(segments, range);
  const start = locate(root, segments, span.from);
  const end = locate(root, segments, span.to);

  const domRange = root.ownerDocument.createRange();
  domRange.setStart(start.node, start.offset);
  domRange.setEnd(end.node, end.offset);
  selection.removeAllRanges();
  selection.addRange(domRange);
  // addRange is a NO-OP when the range's root is not the selection's document —
  // a detached subtree, or a root living in another frame. Report that rather
  // than claiming a caret that was never placed.
  return selection.rangeCount > 0;
}

/**
 * Per-line rects with real area.
 *
 * jsdom implements NO Range geometry — `getClientRects` is absent there, not
 * empty — so it is looked up rather than assumed; tests stub it, and browsers,
 * the only place this geometry is real, always ship it. A method that answers
 * with NOTHING is the same non-answer as a missing method, and is read as one.
 */
function lineRectsOf(domRange: Range): RangeBox[] {
  const measure: (() => ArrayLike<DOMRect> | null | undefined) | undefined = (
    domRange as { getClientRects?: () => ArrayLike<DOMRect> | null | undefined }
  ).getClientRects;
  if (measure === undefined) {
    return [];
  }
  const boxes: RangeBox[] = [];
  for (const rect of Array.from(measure.call(domRange) ?? [])) {
    // Browsers emit zero-area rects at line breaks and around collapsed inline
    // boxes; a toolbar cannot hug something that renders nothing.
    if (rect.width > 0 && rect.height > 0) {
      boxes.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    }
  }
  return boxes;
}

/** The union of the rects that survived the filter — never the raw bounding box. */
function unionOf(rects: readonly RangeBox[]): RangeBox {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const rect of rects) {
    left = Math.min(left, rect.x);
    top = Math.min(top, rect.y);
    right = Math.max(right, rect.x + rect.width);
    bottom = Math.max(bottom, rect.y + rect.height);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Geometry of [from, to) inside root, in the coordinate space of root's own
 * document viewport (getBoundingClientRect / getClientRects, unmodified —
 * the caller's overlay layer shares that origin). `rects` carries ONE entry
 * per rendered line, so a selection spanning lines can be hugged line by
 * line; `box` is their union. Returns null when the range is collapsed,
 * unaddressable, or has no rendered geometry.
 */
export function rangeGeometry(root: HTMLElement, range: TextRange): RangeGeometry | null {
  if (!isAddressable(range)) {
    return null;
  }
  const segments = segmentsOf(root);
  const span = resolveRange(segments, range);
  // An empty document collapses here too: it has one position, so nothing to
  // measure.
  if (span.from === span.to) {
    return null;
  }
  const start = locate(root, segments, span.from);
  const end = locate(root, segments, span.to);

  const domRange = root.ownerDocument.createRange();
  domRange.setStart(start.node, start.offset);
  domRange.setEnd(end.node, end.offset);
  const rects = lineRectsOf(domRange);
  if (rects.length === 0) {
    return null;
  }
  return { box: unionOf(rects), rects };
}
