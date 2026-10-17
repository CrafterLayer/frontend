import { emptyRichText, type RichTextBlockNode, type RichTextDoc } from '@craftkit/builder-schema';

import { no, ok, type Parsed } from './address';

/**
 * The value checks the part.* tools share (block-parts DESIGN §2.12): plain
 * text as rich text, the link and image address allowlists, and a bounded
 * string field. Split from part-tools.ts (art catalog, 2026-10-14) so the
 * tools file keeps to one idea.
 */

/** A plain text as the stored rich-text shape: one paragraph per line. */
export function richTextFromPlain(text: string): RichTextDoc {
  const lines = text.replace(/\r\n?/gu, '\n').split('\n');
  while (lines.length > 0 && (lines[lines.length - 1] ?? '').trim() === '') lines.pop();
  if (lines.length === 0) return emptyRichText();
  const content = lines.map((line): RichTextBlockNode => {
    const words = line.trim();
    return words === ''
      ? { type: 'paragraph' }
      : { type: 'paragraph', content: [{ type: 'text', text: words }] };
  });
  return { type: 'doc', content: content as RichTextDoc['content'] };
}

/** The allowlist the renderer's links use: https/http, mailto, tel and clearly relative paths. */
export function safePartHref(href: string): string | undefined {
  if (
    /[\u0000-\u0020\u007f-\u00a0\u1680\u2000-\u200f\u2028\u2029\u202e\u205f\u3000\ufeff]/u.test(
      href,
    )
  )
    return undefined;
  if (href === '' || href.includes('\\')) return undefined;
  if (/^(?:https?:|mailto:|tel:)/iu.test(href)) return href;
  if (href.startsWith('//')) return undefined;
  return /^[/.#?]/u.test(href) ? href : undefined;
}

/** An image address the door can keep: https or a relative path, no whitespace. */
export function safeImageSrc(src: string): string | undefined {
  if (/\s/u.test(src) || src.includes('\\') || src.startsWith('//')) return undefined;
  return /^(?:https:\/\/|\/|\.\.?\/)/iu.test(src) ? src : undefined;
}

export function stringField(
  record: Record<string, unknown>,
  key: string,
  max: number,
  allowEmpty: boolean,
): Parsed<string | undefined> {
  const value = record[key];
  if (value === undefined) return ok(undefined);
  if (typeof value !== 'string') return no(`"${key}" must be a string.`);
  if (!allowEmpty && value.trim() === '') return no(`"${key}" must not be empty.`);
  if (value.length > max) return no(`"${key}" must be at most ${String(max)} characters.`);
  return ok(value);
}
