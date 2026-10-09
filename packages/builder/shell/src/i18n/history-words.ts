/*
  ── A recorded change's label, read in the editor's language ──────────────────

  A transaction's label is written once, when it is recorded, by code that
  does not know the editor's language: the part planner writes "Edit text ·
  Hero heading", a canvas text session writes "Text · زر". The labels are
  document history, so they are not rewritten; the History list and the
  status bar READ them through this table instead (walk 2026-10-08: the
  Arabic chrome listed "Edit text · Hero heading" and "زر · Text").

  The verb (before " · ") is translated from a closed table. The name is
  translated when it is a block name, optionally followed by a part word and
  an ordinal ("Hero heading", "Features item title 3"); anything else keeps
  its words, because a guessed translation is worse than the original.
*/
import { BLOCK_NAMES_AR, blockNameKey } from './block-names';
import type { EditorLocale } from './editor-locale';
import { SCHEMA_NAMES_AR, schemaWordKey } from './schema-words';

/** The verbs a recorded label opens with, as the Arabic chrome says them. */
export const HISTORY_VERBS_AR: Readonly<Record<string, string>> = {
  'add block': 'إضافة كتلة',
  'add element': 'إضافة عنصر',
  bold: 'عريض',
  'clear formatting': 'مسح التنسيق',
  'edit alt text': 'تعديل النص البديل',
  'edit element': 'تعديل عنصر',
  'edit link': 'تعديل الرابط',
  'edit property': 'تعديل خاصية',
  'edit text': 'تعديل النص',
  'format text': 'تنسيق النص',
  insert: 'إدراج',
  italic: 'مائل',
  link: 'رابط',
  'move block': 'نقل كتلة',
  'remove block': 'حذف كتلة',
  'replace image': 'استبدال الصورة',
  text: 'النص',
  underline: 'تسطير',
};

const SEPARATOR = ' · ';
const ARABIC_LETTER = /[؀-ۿ]/u;

/** "Hero heading 2" → "العنوان 2 (واجهة رئيسية)"; undefined when a word is unknown. */
function arabicElementName(name: string): string | undefined {
  const words = name.trim().split(/\s+/u);
  const ordinal = /^\d+(?:\.\d+)*$/u.test(words.at(-1) ?? '') ? words.pop() : undefined;
  if (words.length === 0) return undefined;
  // The longest leading run of words that names a block ("Rich Text", "Hero").
  for (let split = words.length; split >= 1; split -= 1) {
    const block = BLOCK_NAMES_AR[blockNameKey(words.slice(0, split).join(''))];
    if (block === undefined) continue;
    const rest = words.slice(split);
    const suffix = ordinal === undefined ? '' : ` ${ordinal}`;
    if (rest.length === 0) return `${block}${suffix}`;
    const part = SCHEMA_NAMES_AR[schemaWordKey(rest.join(''))];
    return part === undefined ? undefined : `${part}${suffix} (${block})`;
  }
  return undefined;
}

/**
 * A recorded change's label in the editor's language. English is returned as
 * recorded; Arabic translates the known verb and a block-and-part name, and
 * leaves any segment it cannot read unchanged.
 */
export function localHistoryLabel(label: string, locale: EditorLocale): string {
  if (locale !== 'ar') return label;
  const at = label.indexOf(SEPARATOR);
  const verb = at === -1 ? label : label.slice(0, at);
  const name = at === -1 ? undefined : label.slice(at + SEPARATOR.length);
  const arabicVerb = ARABIC_LETTER.test(verb)
    ? verb
    : (HISTORY_VERBS_AR[verb.trim().toLowerCase()] ?? verb);
  if (name === undefined) return arabicVerb;
  const arabicName = ARABIC_LETTER.test(name) ? name : (arabicElementName(name) ?? name);
  return `${arabicVerb}${SEPARATOR}${arabicName}`;
}
