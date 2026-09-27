import { Parser } from 'htmlparser2';

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
 * - Text: an element's text before its first child element is its `text`;
 *   text after a child element becomes a `<span>` so reading order holds
 *   (the renderer draws `text` before `children`). Runs of whitespace
 *   collapse to one space, as the browser would render them.
 */

export interface MarkupTreeNode {
  kind: 'element' | 'icon';
  [key: string]: unknown;
}

export interface MarkupTreeRoot {
  kind: 'root';
  children: MarkupTreeNode[];
}

interface OpenElement {
  readonly tag: string;
  readonly attributes: Record<string, string>;
  /** Text and finished child nodes, in document order. */
  readonly parts: (string | MarkupTreeNode)[];
}

/** Tags that are complete the moment they open — nothing nests inside them. */
const LEAF_TAGS = new Set(['br', 'hr', 'img', 'icon']);

/** Phrasing elements: a space between two of them is part of the sentence. */
const INLINE_TAGS = new Set([
  'a',
  'code',
  'em',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'time',
  'icon',
]);

function isInline(part: string | MarkupTreeNode | undefined): boolean {
  if (part === undefined || typeof part === 'string') return false;
  if (part.kind === 'icon') return true;
  return typeof part['tag'] === 'string' && INLINE_TAGS.has(part['tag']);
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

/**
 * An element's parts as the tree spells them: leading text as `text`, later
 * text as spans, whitespace collapsed, and whitespace between two blocks gone.
 */
function elementNode(open: OpenElement): MarkupTreeNode {
  const node: MarkupTreeNode = { kind: 'element', tag: open.tag };
  const { class: className, ...attributes } = open.attributes;
  if (className !== undefined && className.trim() !== '') {
    node['className'] = className.trim().replace(/\s+/gu, ' ');
  }
  if (Object.keys(attributes).length > 0) node['attributes'] = attributes;
  const { text, children } = arrangeParts(open.parts);
  if (text !== undefined) node['text'] = text;
  if (children.length > 0) node['children'] = children;
  return node;
}

function arrangeParts(parts: readonly (string | MarkupTreeNode)[]): {
  text: string | undefined;
  children: MarkupTreeNode[];
} {
  let text: string | undefined;
  const children: MarkupTreeNode[] = [];
  parts.forEach((part, index) => {
    if (typeof part !== 'string') {
      children.push(part);
      return;
    }
    const collapsed = part.replace(/\s+/gu, ' ');
    const first = index === 0;
    const last = index === parts.length - 1;
    if (collapsed.trim() === '') {
      // A space between two inline nodes separates words; anywhere else it is layout noise.
      if (!first && !last && isInline(parts[index - 1]) && isInline(parts[index + 1])) {
        children.push({ kind: 'element', tag: 'span', text: ' ' });
      }
      return;
    }
    let value = collapsed;
    if (first) value = value.trimStart();
    if (last) value = value.trimEnd();
    if (children.length === 0 && text === undefined) text = value;
    else children.push({ kind: 'element', tag: 'span', text: value });
  });
  return { text, children };
}

const VOID_TAGS = new Set(['br', 'hr', 'img']);

function escapeText(text: string): string {
  return text.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
}

function escapeAttribute(value: string): string {
  return value.replace(/&/gu, '&amp;').replace(/'/gu, '&#39;').replace(/</gu, '&lt;');
}

function attributeText(name: string, value: string): string {
  return ` ${name}='${escapeAttribute(value)}'`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** One node as markup, or undefined when the node has no markup spelling. */
function nodeMarkup(node: unknown): string | undefined {
  if (!isRecord(node)) return undefined;
  if (node['kind'] === 'icon') {
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
  // A component reference carries props no markup spelling holds.
  if (node['kind'] !== 'element' || typeof node['tag'] !== 'string') return undefined;
  const tag = node['tag'];
  let open = `<${tag}`;
  if (typeof node['className'] === 'string' && node['className'] !== '') {
    open += attributeText('class', node['className']);
  }
  if (isRecord(node['attributes'])) {
    for (const name of Object.keys(node['attributes']).sort()) {
      const value = node['attributes'][name];
      if (typeof value === 'string') open += attributeText(name, value);
    }
  }
  if (VOID_TAGS.has(tag)) return `${open}/>`;
  const children = Array.isArray(node['children']) ? (node['children'] as unknown[]) : [];
  const inner = children.map(nodeMarkup);
  if (inner.some((part) => part === undefined)) return undefined;
  const text = typeof node['text'] === 'string' ? escapeText(node['text']) : '';
  return `${open}>${text}${inner.join('')}</${tag}>`;
}

/**
 * A custom-code tree as the markup `parseTreeMarkup` reads — its inverse, so a
 * model shown a region as markup can quote it exactly and write it back.
 * Deterministic (attributes sorted, single quotes), so an unchanged region
 * serializes to the same bytes on every turn and the prompt prefix holds.
 * Undefined when the tree holds a component reference, which markup cannot
 * spell; such a tree is shown as the tree itself.
 */
export function serializeTreeMarkup(tree: unknown): string | undefined {
  if (!isRecord(tree) || tree['kind'] !== 'root' || !Array.isArray(tree['children'])) {
    return undefined;
  }
  const parts = (tree['children'] as unknown[]).map(nodeMarkup);
  return parts.some((part) => part === undefined) ? undefined : parts.join('');
}

/** Whether a prop value is a tree written as markup rather than as the tree itself. */
export function isTreeMarkup(value: unknown): value is string {
  return typeof value === 'string' && value.trimStart().startsWith('<');
}

/**
 * Read a markup string into a custom-code tree.
 *
 * Forgiving by design — a model's HTML closes tags late, early or never, and
 * the parser closes them the way a browser would. What it produces is only a
 * candidate: the plan normalizer and the door still judge every node.
 */
export function parseTreeMarkup(markup: string): MarkupTreeRoot {
  const root: OpenElement = { tag: '#root', attributes: {}, parts: [] };
  const stack: OpenElement[] = [root];
  const current = (): OpenElement => stack[stack.length - 1] ?? root;

  const parser = new Parser(
    {
      onopentag(name, attributes) {
        const tag = name.toLowerCase();
        if (tag === 'icon') {
          current().parts.push(iconNode(attributes));
          return;
        }
        if (LEAF_TAGS.has(tag)) {
          current().parts.push(elementNode({ tag, attributes: { ...attributes }, parts: [] }));
          return;
        }
        stack.push({ tag, attributes: { ...attributes }, parts: [] });
      },
      ontext(text) {
        const parts = current().parts;
        const previous = parts[parts.length - 1];
        if (typeof previous === 'string') parts[parts.length - 1] = previous + text;
        else parts.push(text);
      },
      onclosetag(name) {
        const tag = name.toLowerCase();
        if (LEAF_TAGS.has(tag)) return;
        // Close up to the named element; a closer that matches nothing open is ignored.
        const at = stack.map((open) => open.tag).lastIndexOf(tag);
        if (at <= 0) return;
        while (stack.length > at) {
          const open = stack.pop();
          if (open === undefined) break;
          current().parts.push(elementNode(open));
        }
      },
    },
    { lowerCaseTags: true, lowerCaseAttributeNames: true, recognizeSelfClosing: true },
  );
  parser.write(markup);
  parser.end();
  // Anything still open at the end closes, innermost first.
  while (stack.length > 1) {
    const open = stack.pop();
    if (open === undefined) break;
    current().parts.push(elementNode(open));
  }
  return { kind: 'root', children: rootChildren(root.parts) };
}

/** Top-level parts: nodes as they are, stray top-level text as spans. */
function rootChildren(parts: readonly (string | MarkupTreeNode)[]): MarkupTreeNode[] {
  const children: MarkupTreeNode[] = [];
  for (const part of parts) {
    if (typeof part !== 'string') {
      children.push(part);
      continue;
    }
    const text = part.replace(/\s+/gu, ' ').trim();
    if (text !== '') children.push({ kind: 'element', tag: 'span', text });
  }
  return children;
}
