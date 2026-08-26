import type { ReactNode } from 'react';

import { safeHref } from './safe-href';
import './RichText.css';

export interface RichTextProps {
  /**
   * Stored rich-text JSON. READ is tolerant by contract (r3): unknown node
   * types render their readable children, unknown marks are ignored, malformed
   * shapes render nothing — never a crash, never raw JSON.
   */
  value: unknown;
  className?: string | undefined;
}

/**
 * Recursion ceiling for the READ path (r3's "never a crash"): a hostile or
 * corrupted document nested deeper than any real prose degrades to plain text
 * instead of overflowing the stack — on the canvas AND in static markup, which
 * has no error boundary at all. The door refuses to store anything this deep.
 */
const MAX_DEPTH = 40;

interface LooseNode {
  type?: unknown;
  text?: unknown;
  marks?: unknown;
  attrs?: unknown;
  content?: unknown;
}

const asNode = (value: unknown): LooseNode | null =>
  typeof value === 'object' && value !== null ? value : null;

const childrenOf = (node: LooseNode): unknown[] =>
  Array.isArray(node.content) ? node.content : [];

function hrefOf(mark: LooseNode): string | undefined {
  const attrs = asNode(mark.attrs);
  const raw = attrs === null ? undefined : attrs['href' as keyof LooseNode];
  return typeof raw === 'string' ? safeHref(raw) : undefined;
}

function levelOf(node: LooseNode): number {
  const attrs = asNode(node.attrs);
  const raw = attrs === null ? undefined : attrs['level' as keyof LooseNode];
  return typeof raw === 'number' ? raw : 2;
}

/**
 * Readable text of any subtree — the terminal degradation for depth/junk.
 * ITERATIVE by construction: this is the depth ceiling's escape hatch, so it
 * must not be the thing that overflows the stack.
 */
function plainText(value: unknown): string {
  const out: string[] = [];
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    const node = asNode(current);
    if (node === null) {
      continue;
    }
    if (typeof node.text === 'string') {
      out.push(node.text);
      continue;
    }
    const children = childrenOf(node);
    for (let at = children.length - 1; at >= 0; at -= 1) {
      stack.push(children[at]);
    }
  }
  return out.join('');
}

function renderInline(value: unknown, key: number, depth: number): ReactNode {
  const node = asNode(value);
  if (node === null) {
    return null;
  }
  if (node.type === 'hardBreak') {
    return <br key={key} />;
  }
  if (node.type === 'text' && typeof node.text === 'string') {
    let rendered: ReactNode = node.text;
    let linked = false;
    const marks = Array.isArray(node.marks) ? node.marks : [];
    for (const rawMark of marks) {
      const mark = asNode(rawMark);
      if (mark === null) {
        continue;
      }
      if (mark.type === 'bold') {
        rendered = <strong>{rendered}</strong>;
      } else if (mark.type === 'italic') {
        rendered = <em>{rendered}</em>;
      } else if (mark.type === 'link' && !linked) {
        // FIRST link mark only: nested anchors are invalid HTML, and the DOM
        // and the static-markup parser disagree about how to repair them —
        // rendering one anchor keeps canvas/static parity exact (r4).
        linked = true;
        const safe = hrefOf(mark);
        rendered =
          safe === undefined ? (
            // Neutralized (r2): the TEXT stays visible, nothing navigable.
            <span className="bldr-richtext__dead-link">{rendered}</span>
          ) : (
            <a className="bldr-richtext__link" href={safe}>
              {rendered}
            </a>
          );
      }
      // Unknown mark types: ignored — the text survives (r3).
    }
    return <span key={key}>{rendered}</span>;
  }
  if (depth >= MAX_DEPTH) {
    return <span key={key}>{plainText(node)}</span>;
  }
  // Unknown inline shape: render any readable descendants.
  return (
    <span key={key}>{childrenOf(node).map((child, at) => renderInline(child, at, depth + 1))}</span>
  );
}

function renderListItem(value: unknown, key: number, depth: number): ReactNode {
  const node = asNode(value);
  if (node === null) {
    return null;
  }
  return (
    <li key={key}>{childrenOf(node).map((child, at) => renderBlock(child, at, depth + 1))}</li>
  );
}

function renderMixed(value: unknown, key: number, depth: number): ReactNode {
  const node = asNode(value);
  if (node === null) {
    return null;
  }
  return node.type === 'text' || node.type === 'hardBreak'
    ? renderInline(value, key, depth)
    : renderBlock(value, key, depth);
}

function renderBlock(value: unknown, key: number, depth: number): ReactNode {
  const node = asNode(value);
  if (node === null) {
    return null;
  }
  if (depth >= MAX_DEPTH) {
    // Ceiling reached: the text survives, the structure does not (r3).
    return <p key={key}>{plainText(node)}</p>;
  }
  const inline = () => childrenOf(node).map((child, at) => renderInline(child, at, depth + 1));
  switch (node.type) {
    case 'paragraph':
      return <p key={key}>{inline()}</p>;
    case 'heading': {
      const level = levelOf(node);
      if (level === 3) {
        return <h3 key={key}>{inline()}</h3>;
      }
      if (level === 4) {
        return <h4 key={key}>{inline()}</h4>;
      }
      return <h2 key={key}>{inline()}</h2>;
    }
    case 'bulletList':
      return (
        <ul key={key}>
          {childrenOf(node).map((child, at) => renderListItem(child, at, depth + 1))}
        </ul>
      );
    case 'orderedList':
      return (
        <ol key={key}>
          {childrenOf(node).map((child, at) => renderListItem(child, at, depth + 1))}
        </ol>
      );
    case 'listItem':
      // A stray list item outside a list: degrade to its content (r3). A DIV,
      // not a span — the children are block elements, and <span><p></p></span>
      // is invalid nesting the two render paths would repair differently.
      return (
        <div key={key}>
          {childrenOf(node).map((child, at) => renderBlock(child, at, depth + 1))}
        </div>
      );
    default:
      // Unknown BLOCK type: its readable children survive, the wrapper dies (r3).
      return (
        <div key={key}>
          {childrenOf(node).map((child, at) => renderMixed(child, at, depth + 1))}
        </div>
      );
  }
}

/**
 * The zero-dependency rich-text read path (008 contract §2): whitelisted
 * semantic output, token styling, logical properties. Plain React, so canvas
 * and static markup render identically by construction (r4).
 */
export function RichText({ value, className }: RichTextProps) {
  const doc = asNode(value);
  const blocks = doc?.type === 'doc' ? childrenOf(doc) : [];
  return (
    <div className={className === undefined ? 'bldr-richtext' : `bldr-richtext ${className}`}>
      {blocks.map((block, at) => renderBlock(block, at, 0))}
    </div>
  );
}
