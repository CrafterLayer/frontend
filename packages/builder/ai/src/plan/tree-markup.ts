import { Tokenizer } from 'htmlparser2';

/**
 * Custom-code trees written as markup, read into the stored tree shape.
 *
 * ## Why the model writes markup and the document stores a tree
 *
 * The stored form stays the tree (custom-code-tree.ts explains why: a tree
 * cannot express a `<script>`, so there is nothing to sanitize). But the tree
 * is a poor thing for a model to WRITE. Measured 2026-09-27 on the live
 * builder: every "not valid JSON" answer failed inside the run of closers
 * that ends a deeply nested tree (`…}]}]}]}]}}]`), and the same 15 sections
 * written as markup were 33% shorter — a third less to generate, on a stage
 * whose time is almost all generation. Models write Tailwind HTML fluently;
 * they count brackets badly.
 *
 * So a plan may carry a tree as a markup string, and it is read here, before
 * the door, into exactly the tree the model would otherwise have written.
 * The door then judges that tree like any other: an unknown tag or attribute
 * is still refused (or, earlier, normalized), because this reader invents
 * nothing — it only changes the spelling.
 *
 * ## The spelling
 *
 * - Elements as HTML: `<section class='py-16'>…</section>`. `class` becomes
 *   `className`; every other attribute goes to `attributes`.
 * - Icons: `<icon name='coffee' class='size-5' size='20' label='Coffee'/>`,
 *   a leaf — anything written inside one is lifted out after it.
 * - Registered blocks: `<ck-component type='hero' props='{"heading":"…"}'>
 *   …slot children…</ck-component>`. `props` is JSON; props that are not JSON
 *   are kept as written, so the door refuses them by name instead of this
 *   reader guessing.
 * - Text: an element's text before its first child element is its `text`;
 *   text after a child element becomes a `<span>` so reading order holds
 *   (the renderer draws `text` before `children`).
 *
 * ## Whitespace, and why the reader is the writer's exact inverse
 *
 * `editTree` (tree-edits.ts) writes a WHOLE region as markup, applies one
 * find/replace, and reads the whole region back — so anything this pair does
 * not round-trip is damaged in every section a follow-up touches, however
 * small the edit. On 2026-09-28 a class change on an `h2` joined the words of
 * every sentence beside it ("Pay onceand keep it"), because the reader
 * trimmed the spaces the writer had kept. The rules are therefore stated for
 * both directions at once:
 *
 * - Literal whitespace a model writes (` `, tab, newline) is layout: runs
 *   collapse to one space, a block's text is trimmed at its edges, and a
 *   whitespace-only run between blocks is dropped — as a browser renders it.
 *   Inside an inline element (`span`, `strong`, `a`…) edge spaces separate
 *   words, so they are kept.
 * - Inside `pre` and under a `whitespace-pre*` / `whitespace-break-spaces`
 *   class, literal whitespace is content and is kept verbatim.
 * - Whitespace written as a character reference (`&#32;`, `&#10;`) is always
 *   content. The writer spells every space the layout rules would otherwise
 *   eat that way, and a non-breaking space as `&nbsp;` (U+00A0 is not HTML
 *   whitespace, so it never collapses either way).
 * - Markup that closes every tag it opens is read exactly as nested — a
 *   stored `p` holding a `div` stays one. Only markup that leaves tags
 *   unbalanced gets a browser's implied closes (`<li>One<li>Two`).
 */

export interface MarkupTreeNode {
  kind: 'element' | 'icon' | 'component';
  [key: string]: unknown;
}

export interface MarkupTreeRoot {
  kind: 'root';
  children: MarkupTreeNode[];
}

/** The markup tag for a component reference. */
export const COMPONENT_MARKUP_TAG = 'ck-component';

/** Tags that are complete the moment they open: HTML's void elements, and icons. */
const LEAF_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'icon',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

/** The void tags the vocabulary has; written self-closed. */
const VOID_TAGS = new Set(['br', 'hr', 'img']);

/**
 * Inline-level elements: a space between two of them is part of the sentence,
 * and a space at the edge of one separates it from its neighbour. The phrasing
 * tags the normalizer later respells (`b`, `i`, `mark`…) are here too, since
 * the markup is read before it respells them.
 */
const INLINE_TAGS = new Set([
  'a',
  'abbr',
  'b',
  'bdi',
  'bdo',
  'big',
  'button',
  'cite',
  'code',
  'data',
  'del',
  'dfn',
  'em',
  'i',
  'img',
  'ins',
  'kbd',
  'label',
  'mark',
  'q',
  's',
  'samp',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'time',
  'u',
  'var',
]);

/*
  What opening a tag closes, for markup that leaves its own tags open —
  htmlparser2's table (MIT, Felix Böhm), less its `body` and ruby `rt`/`rp`
  rows, which no region holds. The rules a browser applies, so a model's
  `<li>One<li>Two` is two items.
*/
const IMPLIED_CLOSE_ROWS: readonly (readonly [opened: string[], closes: string[]])[] = [
  [['tr'], ['tr', 'th', 'td']],
  [['th'], ['th']],
  [['td'], ['thead', 'th', 'td']],
  [['a'], ['a']],
  [['li'], ['li']],
  [['p'], ['p']],
  [
    ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'],
  ],
  [
    ['select', 'input', 'output', 'button', 'datalist', 'textarea'],
    ['input', 'option', 'optgroup', 'select', 'button', 'datalist', 'textarea'],
  ],
  [['option'], ['option']],
  [['optgroup'], ['optgroup', 'option']],
  [
    ['dd', 'dt'],
    ['dd', 'dt'],
  ],
  [
    [
      'address',
      'article',
      'aside',
      'blockquote',
      'details',
      'div',
      'dl',
      'fieldset',
      'figcaption',
      'figure',
      'footer',
      'form',
      'header',
      'hr',
      'main',
      'nav',
      'ol',
      'pre',
      'section',
      'table',
      'ul',
    ],
    ['p'],
  ],
  [
    ['tbody', 'tfoot'],
    ['thead', 'tbody'],
  ],
];

const IMPLIED_CLOSES: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  IMPLIED_CLOSE_ROWS.flatMap(([opened, closes]) =>
    opened.map((tag): [string, ReadonlySet<string>] => [tag, new Set(closes)]),
  ),
);

/** HTML whitespace — what a browser collapses. U+00A0 is deliberately not in it. */
const SPACE = /[ \t\n\r\f]/u;
const SPACE_RUN = /[ \t\n\r\f]+/gu;
const BLANK = /^[ \t\n\r\f]*$/u;
const PRESERVING_CLASS = /^!?whitespace-(?:pre|pre-line|pre-wrap|break-spaces)$/u;

function isSpace(char: string | undefined): boolean {
  return char !== undefined && SPACE.test(char);
}

/** Whether a class list makes whitespace render as written (any breakpoint counts). */
function preservesWhitespace(className: unknown): boolean {
  if (typeof className !== 'string') return false;
  return className
    .split(SPACE_RUN)
    .some((name) => PRESERVING_CLASS.test(name.slice(name.lastIndexOf(':') + 1)));
}

// ── Reading ──────────────────────────────────────────────────────────────────

type MarkupToken =
  | {
      readonly type: 'open';
      readonly tag: string;
      readonly attributes: Record<string, string>;
      readonly selfClosing: boolean;
    }
  | { readonly type: 'close'; readonly tag: string }
  | { readonly type: 'text'; readonly text: string; readonly exact: boolean };

/** A stretch of text between two tags; `exact` segments came from character references. */
interface TextRun {
  readonly segments: { text: string; readonly exact: boolean }[];
}

type Part = TextRun | MarkupTreeNode;

interface OpenElement {
  readonly tag: string;
  readonly attributes: Record<string, string>;
  /** Text and finished child nodes, in document order. */
  readonly parts: Part[];
  /** Whether whitespace inside it is content: in a `pre`, or under a whitespace-pre class. */
  readonly preserve: boolean;
}

function isTextRun(part: Part | undefined): part is TextRun {
  return part !== undefined && 'segments' in part;
}

function isInline(part: Part | undefined): boolean {
  if (part === undefined || isTextRun(part)) return false;
  if (part.kind === 'icon') return true;
  return part.kind === 'element' && typeof part['tag'] === 'string' && INLINE_TAGS.has(part['tag']);
}

/**
 * The markup as tokens, through htmlparser2's tokenizer rather than its tree
 * builder: the builder applies HTML's implied closes unconditionally, and it
 * hands text over with character references already decoded — so a `&#32;`
 * the writer spelled on purpose could no longer be told from layout.
 */
function tokenize(markup: string): MarkupToken[] {
  const tokens: MarkupToken[] = [];
  let tag = '';
  let attributes: Record<string, string> = {};
  let attributeName = '';
  let attributeValue = '';
  const text = (value: string, exact: boolean): void => {
    const previous = tokens[tokens.length - 1];
    if (previous?.type === 'text' && previous.exact === exact) {
      tokens[tokens.length - 1] = { type: 'text', text: previous.text + value, exact };
    } else {
      tokens.push({ type: 'text', text: value, exact });
    }
  };
  // Comments, declarations, CDATA and processing instructions carry nothing a tree holds.
  const ignore = (): void => undefined;
  const tokenizer = new Tokenizer(
    { decodeEntities: true },
    {
      onopentagname(start, end) {
        tag = markup.slice(start, end).toLowerCase();
        attributes = {};
      },
      onattribname(start, end) {
        attributeName = markup.slice(start, end).toLowerCase();
        attributeValue = '';
      },
      onattribdata(start, end) {
        attributeValue += markup.slice(start, end);
      },
      onattribentity(codePoint) {
        attributeValue += String.fromCodePoint(codePoint);
      },
      onattribend() {
        // The first spelling of a repeated attribute wins, as in a browser.
        if (!Object.hasOwn(attributes, attributeName)) attributes[attributeName] = attributeValue;
        attributeValue = '';
      },
      onopentagend() {
        tokens.push({ type: 'open', tag, attributes, selfClosing: false });
      },
      onselfclosingtag() {
        tokens.push({ type: 'open', tag, attributes, selfClosing: true });
      },
      onclosetag(start, end) {
        tokens.push({ type: 'close', tag: markup.slice(start, end).toLowerCase() });
      },
      ontext(start, end) {
        text(markup.slice(start, end), false);
      },
      ontextentity(codePoint) {
        text(String.fromCodePoint(codePoint), true);
      },
      oncdata: ignore,
      oncomment: ignore,
      ondeclaration: ignore,
      onprocessinginstruction: ignore,
      onend: ignore,
    },
  );
  tokenizer.write(markup);
  tokenizer.end();
  return tokens;
}

/** Whether every tag the markup opens is closed, innermost first — as the writer always writes. */
function isBalanced(tokens: readonly MarkupToken[]): boolean {
  const open: string[] = [];
  for (const token of tokens) {
    if (token.type === 'open' && !token.selfClosing && !LEAF_TAGS.has(token.tag)) {
      open.push(token.tag);
    } else if (token.type === 'close' && !LEAF_TAGS.has(token.tag) && open.pop() !== token.tag) {
      return false;
    }
  }
  return open.length === 0;
}

function iconNode(attributes: Readonly<Record<string, string>>): MarkupTreeNode {
  const node: MarkupTreeNode = { kind: 'icon', name: attributes['name'] ?? '' };
  if (attributes['class'] !== undefined) node['className'] = attributes['class'];
  const size = Number(attributes['size']);
  if (attributes['size'] !== undefined && Number.isFinite(size)) node['size'] = size;
  const strokeWidth = Number(attributes['stroke-width'] ?? attributes['strokewidth']);
  if (Number.isFinite(strokeWidth) && strokeWidth > 0) node['strokeWidth'] = strokeWidth;
  if (attributes['label'] !== undefined) node['label'] = attributes['label'];
  return node;
}

interface RunContext {
  /** Edge spaces separate words: kept, and a whitespace-only run is a space. */
  readonly inline: boolean;
  readonly preserve: boolean;
  /** A `pre`: a newline written right after its start tag is not content. */
  readonly pre: boolean;
}

/** One run of text as the tree stores it, or undefined when it is only layout. */
function runText(parts: readonly Part[], index: number, context: RunContext): string | undefined {
  const run = parts[index];
  if (!isTextRun(run)) return undefined;
  const first = index === 0;
  const last = index === parts.length - 1;
  if (context.preserve) {
    let value = run.segments.map((segment) => segment.text).join('');
    if (context.pre && first && run.segments[0]?.exact === false && value.startsWith('\n')) {
      value = value.slice(1);
    }
    return value === '' ? undefined : value;
  }
  const segments = run.segments.map((segment) =>
    segment.exact ? segment : { text: segment.text.replace(SPACE_RUN, ' '), exact: false },
  );
  if (segments.every((segment) => !segment.exact && BLANK.test(segment.text))) {
    const betweenInline =
      !first && !last && isInline(parts[index - 1]) && isInline(parts[index + 1]);
    return context.inline || betweenInline ? ' ' : undefined;
  }
  if (!context.inline) {
    const head = segments[0];
    const tail = segments[segments.length - 1];
    // Only literal edges are layout; an edge written as `&#32;` is kept.
    if (first && head !== undefined && !head.exact) {
      head.text = head.text.replace(/^[ \t\n\r\f]+/u, '');
    }
    if (last && tail !== undefined && !tail.exact) {
      tail.text = tail.text.replace(/[ \t\n\r\f]+$/u, '');
    }
  }
  return segments.map((segment) => segment.text).join('');
}

/**
 * An element's parts as the tree spells them: its leading text as `text`
 * (when it has a `text`), every later run as a span.
 */
function arrangeParts(
  parts: readonly Part[],
  context: RunContext,
  hasTextField: boolean,
): { text: string | undefined; children: MarkupTreeNode[] } {
  let text: string | undefined;
  const children: MarkupTreeNode[] = [];
  parts.forEach((part, index) => {
    if (!isTextRun(part)) {
      children.push(part);
      return;
    }
    const value = runText(parts, index, context);
    if (value === undefined) return;
    if (hasTextField && children.length === 0 && text === undefined) text = value;
    else children.push({ kind: 'element', tag: 'span', text: value });
  });
  return { text, children };
}

function elementNode(open: OpenElement): MarkupTreeNode {
  const node: MarkupTreeNode = { kind: 'element', tag: open.tag };
  const { class: className, ...attributes } = open.attributes;
  if (className !== undefined && !BLANK.test(className)) {
    node['className'] = className.trim().replace(SPACE_RUN, ' ');
  }
  if (Object.keys(attributes).length > 0) node['attributes'] = attributes;
  const { text, children } = arrangeParts(
    open.parts,
    { inline: INLINE_TAGS.has(open.tag), preserve: open.preserve, pre: open.tag === 'pre' },
    true,
  );
  if (text !== undefined) node['text'] = text;
  if (children.length > 0) node['children'] = children;
  return node;
}

function componentNode(open: OpenElement): MarkupTreeNode {
  const node: MarkupTreeNode = { kind: 'component', component: open.attributes['type'] ?? '' };
  const props = open.attributes['props'];
  if (props !== undefined) {
    try {
      node['props'] = JSON.parse(props) as unknown;
    } catch {
      // Kept as written: the door refuses a string where props belong, and says where.
      node['props'] = props;
    }
  }
  const { children } = arrangeParts(
    open.parts,
    { inline: false, preserve: open.preserve, pre: false },
    false,
  );
  if (children.length > 0) node['children'] = children;
  return node;
}

function finishedNode(open: OpenElement): MarkupTreeNode {
  return open.tag === COMPONENT_MARKUP_TAG ? componentNode(open) : elementNode(open);
}

/**
 * Read a markup string into a custom-code tree.
 *
 * Forgiving by design — a model's HTML closes tags late, early or never, and
 * unbalanced markup is closed the way a browser would. Balanced markup (all
 * the writer ever produces) is read exactly as nested. What it produces is
 * only a candidate: the plan normalizer and the door still judge every node.
 */
export function parseTreeMarkup(markup: string): MarkupTreeRoot {
  const tokens = tokenize(markup);
  const repair = !isBalanced(tokens);
  const root: OpenElement = { tag: '#root', attributes: {}, parts: [], preserve: false };
  const stack: OpenElement[] = [root];
  const current = (): OpenElement => stack[stack.length - 1] ?? root;
  const closeCurrent = (): void => {
    const open = stack.pop();
    if (open !== undefined) current().parts.push(finishedNode(open));
  };

  for (const token of tokens) {
    if (token.type === 'text') {
      const parts = current().parts;
      const previous = parts[parts.length - 1];
      const segment = { text: token.text, exact: token.exact };
      if (isTextRun(previous)) previous.segments.push(segment);
      else parts.push({ segments: [segment] });
      continue;
    }
    if (token.type === 'close') {
      if (LEAF_TAGS.has(token.tag)) continue;
      // Close up to the named element; a closer that matches nothing open is ignored.
      const at = stack.map((open) => open.tag).lastIndexOf(token.tag);
      if (at <= 0) continue;
      while (stack.length > at) closeCurrent();
      continue;
    }
    const closes = repair ? IMPLIED_CLOSES.get(token.tag) : undefined;
    while (closes !== undefined && stack.length > 1 && closes.has(current().tag)) closeCurrent();
    if (token.tag === 'icon') {
      current().parts.push(iconNode(token.attributes));
      continue;
    }
    const open: OpenElement = {
      tag: token.tag,
      attributes: { ...token.attributes },
      parts: [],
      preserve:
        current().preserve || token.tag === 'pre' || preservesWhitespace(token.attributes['class']),
    };
    if (token.selfClosing || LEAF_TAGS.has(token.tag)) current().parts.push(finishedNode(open));
    else stack.push(open);
  }
  // Anything still open at the end closes, innermost first.
  while (stack.length > 1) closeCurrent();
  // Stray top-level text becomes spans; the root has no text of its own.
  const { children } = arrangeParts(
    root.parts,
    { inline: false, preserve: false, pre: false },
    false,
  );
  return { kind: 'root', children };
}

/** Whether a prop value is a tree written as markup rather than as the tree itself. */
export function isTreeMarkup(value: unknown): value is string {
  return typeof value === 'string' && value.trimStart().startsWith('<');
}

// ── Writing ──────────────────────────────────────────────────────────────────

function escapeAttribute(value: string): string {
  return value.replace(/&/gu, '&amp;').replace(/'/gu, '&#39;').replace(/</gu, '&lt;');
}

function attributeText(name: string, value: string): string {
  return ` ${name}='${escapeAttribute(value)}'`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface TextContext extends RunContext {
  /** Children follow the text, so its end is not the element's end. */
  readonly followed: boolean;
}

/** Whether a literal space at `index` reads back as itself under `runText`. */
function spaceSurvives(text: string, index: number, context: TextContext): boolean {
  if (text[index] !== ' ') return false;
  if (BLANK.test(text)) return context.inline && text === ' ';
  const before = index === 0 ? context.inline : !isSpace(text[index - 1]);
  const after =
    index === text.length - 1 ? context.inline || context.followed : !isSpace(text[index + 1]);
  return before && after;
}

/**
 * Text as markup that `runText` reads back as exactly this text: `&`, `<`,
 * `>` escaped, U+00A0 visible as `&nbsp;`, and every whitespace character the
 * layout rules would collapse or trim written as a character reference.
 */
function textMarkup(text: string, context: TextContext): string {
  let out = '';
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? '';
    if (char === '&') out += '&amp;';
    else if (char === '<') out += '&lt;';
    else if (char === '>') out += '&gt;';
    else if (char === ' ') out += '&nbsp;';
    else if (!isSpace(char)) out += char;
    else if (context.preserve && !(context.pre && index === 0 && char === '\n')) out += char;
    else if (!context.preserve && spaceSurvives(text, index, context)) out += char;
    else out += `&#${String(char.charCodeAt(0))};`;
  }
  return out;
}

function childrenMarkup(node: Record<string, unknown>, preserve: boolean): string[] | undefined {
  const children = Array.isArray(node['children']) ? (node['children'] as unknown[]) : [];
  const inner = children.map((child) => nodeMarkup(child, preserve));
  return inner.some((part) => part === undefined) ? undefined : (inner as string[]);
}

function iconMarkup(node: Record<string, unknown>): string | undefined {
  if (typeof node['name'] !== 'string') return undefined;
  let out = `<icon${attributeText('name', node['name'])}`;
  if (typeof node['className'] === 'string') out += attributeText('class', node['className']);
  if (typeof node['size'] === 'number') out += attributeText('size', String(node['size']));
  if (typeof node['strokeWidth'] === 'number') {
    out += attributeText('stroke-width', String(node['strokeWidth']));
  }
  if (typeof node['label'] === 'string') out += attributeText('label', node['label']);
  return `${out}/>`;
}

function componentMarkup(node: Record<string, unknown>, preserve: boolean): string | undefined {
  if (typeof node['component'] !== 'string') return undefined;
  let open = `<${COMPONENT_MARKUP_TAG}${attributeText('type', node['component'])}`;
  if (node['props'] !== undefined) {
    let props: string | undefined;
    try {
      props = JSON.stringify(node['props']);
    } catch {
      return undefined;
    }
    if (typeof props !== 'string') return undefined;
    open += attributeText('props', props);
  }
  const inner = childrenMarkup(node, preserve);
  if (inner === undefined) return undefined;
  return inner.length === 0 ? `${open}/>` : `${open}>${inner.join('')}</${COMPONENT_MARKUP_TAG}>`;
}

/** One node as markup, or undefined when the node has no markup spelling. */
function nodeMarkup(node: unknown, preserve: boolean): string | undefined {
  if (!isRecord(node)) return undefined;
  if (node['kind'] === 'icon') return iconMarkup(node);
  if (node['kind'] === 'component') return componentMarkup(node, preserve);
  if (node['kind'] !== 'element' || typeof node['tag'] !== 'string') return undefined;
  const tag = node['tag'];
  let open = `<${tag}`;
  if (typeof node['className'] === 'string' && !BLANK.test(node['className'])) {
    open += attributeText('class', node['className']);
  }
  if (isRecord(node['attributes'])) {
    for (const name of Object.keys(node['attributes']).sort()) {
      const value = node['attributes'][name];
      if (typeof value === 'string') open += attributeText(name, value);
    }
  }
  if (VOID_TAGS.has(tag)) return `${open}/>`;
  const inside = preserve || tag === 'pre' || preservesWhitespace(node['className']);
  const inner = childrenMarkup(node, inside);
  if (inner === undefined) return undefined;
  const text =
    typeof node['text'] === 'string'
      ? textMarkup(node['text'], {
          inline: INLINE_TAGS.has(tag),
          preserve: inside,
          pre: tag === 'pre',
          followed: inner.length > 0,
        })
      : '';
  return `${open}>${text}${inner.join('')}</${tag}>`;
}

/**
 * A custom-code tree as the markup `parseTreeMarkup` reads — its exact
 * inverse, so a model shown a region as markup can quote it and write it back,
 * and `editTree` can rewrite one part of a region without disturbing the rest.
 * Deterministic (attributes sorted, single quotes), so an unchanged region
 * serializes to the same bytes on every turn and the prompt prefix holds.
 * Undefined only for a value that is not a tree.
 */
export function serializeTreeMarkup(tree: unknown): string | undefined {
  if (!isRecord(tree) || tree['kind'] !== 'root' || !Array.isArray(tree['children'])) {
    return undefined;
  }
  const parts = (tree['children'] as unknown[]).map((child) => nodeMarkup(child, false));
  return parts.some((part) => part === undefined) ? undefined : parts.join('');
}
