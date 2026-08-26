import type {
  RichTextBlockNode,
  RichTextDoc,
  RichTextInline,
  RichTextListItem,
  RichTextMark,
} from '@craftkit/builder-schema';

/**
 * Project the editor's JSON onto the STORED whitelist (008 contract §1).
 * The engine's marks carry extra attributes (link: target/rel/class defaults)
 * that the strict door rightly rejects — the projection keeps exactly the
 * whitelisted fields. Node/mark types outside the whitelist cannot be created
 * (the StarterKit subset disables them), so projection never loses content in
 * normal operation; the door stays the final authority either way.
 */

interface LooseNode {
  type?: unknown;
  text?: unknown;
  marks?: unknown;
  attrs?: unknown;
  content?: unknown;
}

const asNode = (value: unknown): LooseNode | null =>
  typeof value === 'object' && value !== null ? value : null;

const contentOf = (node: LooseNode): unknown[] => (Array.isArray(node.content) ? node.content : []);

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

function projectInline(value: unknown): RichTextInline | null {
  const node = asNode(value);
  if (node === null) {
    return null;
  }
  if (node.type === 'hardBreak') {
    return { type: 'hardBreak' };
  }
  if (node.type === 'text' && typeof node.text === 'string') {
    // At most ONE mark of a kind (the door's rule, and every ProseMirror
    // schema's): the first wins, matching how the renderer resolves links.
    const seen = new Set<string>();
    const marks = (Array.isArray(node.marks) ? node.marks : [])
      .map(projectMark)
      .filter((mark): mark is RichTextMark => mark !== null)
      .filter((mark) => {
        if (seen.has(mark.type)) {
          return false;
        }
        seen.add(mark.type);
        return true;
      });
    return marks.length === 0
      ? { type: 'text', text: node.text }
      : { type: 'text', text: node.text, marks };
  }
  return null;
}

function projectListItem(value: unknown): RichTextListItem | null {
  const node = asNode(value);
  if (node?.type !== 'listItem') {
    return null;
  }
  const content = contentOf(node)
    .map(projectBlock)
    .filter((block): block is RichTextBlockNode => block !== null);
  if (content.length === 0) {
    return null;
  }
  // The door requires a list item to OPEN with a paragraph (the shape every
  // ProseMirror list schema enforces) — the projection guarantees it rather
  // than emitting something the door would reject (§10 review fix).
  const [first, ...rest] = content;
  return first?.type === 'paragraph'
    ? { type: 'listItem', content: [first, ...rest] }
    : { type: 'listItem', content: [{ type: 'paragraph' }, ...content] };
}

function projectBlock(value: unknown): RichTextBlockNode | null {
  const node = asNode(value);
  if (node === null) {
    return null;
  }
  const inline = () =>
    contentOf(node)
      .map(projectInline)
      .filter((entry): entry is RichTextInline => entry !== null);
  switch (node.type) {
    case 'paragraph': {
      const content = inline();
      return content.length === 0 ? { type: 'paragraph' } : { type: 'paragraph', content };
    }
    case 'heading': {
      const attrs = asNode(node.attrs);
      const rawLevel = attrs === null ? undefined : (attrs as { level?: unknown }).level;
      const level = rawLevel === 3 ? 3 : rawLevel === 4 ? 4 : 2;
      const content = inline();
      return content.length === 0
        ? { type: 'heading', attrs: { level } }
        : { type: 'heading', attrs: { level }, content };
    }
    case 'bulletList':
    case 'orderedList': {
      const items = contentOf(node)
        .map(projectListItem)
        .filter((item): item is RichTextListItem => item !== null);
      return items.length === 0 ? null : { type: node.type, content: items };
    }
    default:
      return null;
  }
}

/** Editor JSON → the stored whitelist form (never throws). */
export function toStoredRichText(json: unknown): RichTextDoc {
  const doc = asNode(json);
  const content =
    doc?.type === 'doc'
      ? contentOf(doc)
          .map(projectBlock)
          .filter((block): block is RichTextBlockNode => block !== null)
      : [];
  // A document always holds at least one block — the canonical empty document
  // is ONE empty paragraph, never an empty array (the door refuses that too).
  const [first, ...rest] = content;
  return first === undefined
    ? { type: 'doc', content: [{ type: 'paragraph' }] }
    : { type: 'doc', content: [first, ...rest] };
}
