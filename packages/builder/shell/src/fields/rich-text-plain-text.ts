/**
 * The words a stored rich-text document holds, as plain text — what the
 * Inspector can show WITHOUT the editing engine.
 *
 * The Inspector's rich-text row is a lazily loaded contribution. Before it
 * lands (or if it fails to), the row used to fall back to `JSON.stringify` of
 * the ProseMirror document, which is how a person ended up looking at
 * `{"type":"doc","content":[…` in a one-line box (owner screenshot,
 * 2026-10-06). This projection is what the skeleton shows instead: blocks
 * become lines, list items get a bullet or their number, a hard break is a
 * line break, and marks simply disappear.
 *
 * It walks ANY value defensively — the input is document data the shell does
 * not own, so an unknown node type contributes its text children and nothing
 * else, and a non-object yields ''.
 */

interface WalkNode {
  readonly type?: unknown;
  readonly text?: unknown;
  readonly content?: unknown;
}

const BLOCK_TYPES = new Set(['paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock']);

function childrenOf(node: WalkNode): readonly WalkNode[] {
  return Array.isArray(node.content)
    ? node.content.filter((child): child is WalkNode => typeof child === 'object' && child !== null)
    : [];
}

function inlineText(node: WalkNode): string {
  if (node.type === 'text') {
    return typeof node.text === 'string' ? node.text : '';
  }
  if (node.type === 'hardBreak') {
    return '\n';
  }
  return childrenOf(node).map(inlineText).join('');
}

function blockLines(node: WalkNode, out: string[]): void {
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    childrenOf(node).forEach((item, index) => {
      const marker = node.type === 'orderedList' ? `${String(index + 1)}.` : '•';
      const lines: string[] = [];
      for (const child of childrenOf(item)) {
        blockLines(child, lines);
      }
      lines.forEach((line, lineIndex) => {
        out.push(lineIndex === 0 ? `${marker} ${line}` : `  ${line}`);
      });
    });
    return;
  }
  if (typeof node.type === 'string' && BLOCK_TYPES.has(node.type)) {
    const hasBlockChildren = childrenOf(node).some(
      (child) =>
        child.type === 'paragraph' || child.type === 'bulletList' || child.type === 'orderedList',
    );
    if (hasBlockChildren) {
      for (const child of childrenOf(node)) {
        blockLines(child, out);
      }
      return;
    }
    out.push(inlineText(node));
    return;
  }
  if (node.type === 'text' || node.type === 'hardBreak') {
    out.push(inlineText(node));
    return;
  }
  for (const child of childrenOf(node)) {
    blockLines(child, out);
  }
}

/** Plain text of a stored rich-text doc: one line per block, '' for anything unreadable. */
export function richTextPlainText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value !== 'object' || value === null) {
    return '';
  }
  const lines: string[] = [];
  blockLines(value, lines);
  // Trailing empty paragraphs (an empty doc is `[{ type: 'paragraph' }]`) add nothing.
  while (lines.length > 0 && lines.at(-1)?.trim() === '') {
    lines.pop();
  }
  return lines.join('\n');
}
