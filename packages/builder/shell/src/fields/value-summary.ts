import type { FieldLabels } from './field-labels';
import { richTextPlainText } from './rich-text-plain-text';

const MAX_TEXT = 80;

function clip(text: string): string {
  const flat = text.replace(/\s+/gu, ' ').trim();
  return flat.length > MAX_TEXT ? `${flat.slice(0, MAX_TEXT - 1)}…` : flat;
}

function isRichTextDoc(value: object): boolean {
  return (value as { type?: unknown }).type === 'doc';
}

/**
 * A value as a person would describe it: "3 items", "4 fields", "Empty", the
 * text itself, or a stored rich-text document's words. NEVER JSON — this is
 * what a property the Inspector has no editor for shows instead of
 * `JSON.stringify` (block-parts DESIGN §2.10 step 5).
 */
export function summarizeValue(value: unknown, labels: FieldLabels): string {
  if (value === undefined || value === null || value === '') {
    return labels.empty;
  }
  if (typeof value === 'string') {
    return clip(value);
  }
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? labels.yes : labels.no;
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? labels.empty : labels.items(value.length);
  }
  if (typeof value === 'object') {
    if (isRichTextDoc(value)) {
      const text = richTextPlainText(value);
      return text === '' ? labels.empty : clip(text);
    }
    const count = Object.keys(value).length;
    return count === 0 ? labels.empty : labels.fields(count);
  }
  return labels.empty;
}
