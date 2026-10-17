import type { SectionKit, SectionKitSlot } from './types';

/**
 * What every slot check shares (DESIGN §B): the check's result and context,
 * the shape a refusal quotes, and the text cleaning. Split from
 * instantiate.ts (art catalog, 2026-10-14) with the image check beside it.
 */

export type SlotCheck =
  { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: string };

export interface CheckContext {
  readonly kit: SectionKit;
  readonly lang: string;
  /** Catalog photos already used by this instantiation, so a gallery never repeats one. */
  readonly usedPhotos: Set<string>;
}

/** Control characters other than tab and newline: never part of what a person wrote. */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Cut to `max` characters at a word, with an ellipsis. */
export function clampText(text: string, max: number): string {
  // Code points, not UTF-16 units: an Arabic or emoji character is never cut in half.
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  const head = chars.slice(0, max - 1).join('');
  const space = head.lastIndexOf(' ');
  const cut = space >= head.length - 30 && space > 0 ? head.slice(0, space) : head;
  return `${cut.trimEnd()}…`;
}

export function cleanText(value: string): string {
  return value.replace(CONTROL, '').trim();
}

export function slotShape(slot: SectionKitSlot): string {
  switch (slot.kind) {
    case 'text':
      return '"…"';
    case 'link':
      return '{"label":"…","href":"#section-id"}';
    case 'image':
      return '{"src":"https://…","alt":"…"} or {"subject":"coffee","alt":"…"}';
    case 'icon':
      return 'a Lucide name such as "coffee"';
    case 'list': {
      const fields = Object.keys(slot.item ?? {});
      return `[{${fields.map((field) => `"${field}":…`).join(',')}}]`;
    }
  }
}
