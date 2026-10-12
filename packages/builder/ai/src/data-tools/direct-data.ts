import { normalizeIntentText } from '../intent/normalize-arabic';
import { readDataText } from './data-text';
import type { DataShowAs } from './data-show';

/**
 * The zero-token data reading (2026-10-12): an instruction line over pasted rows — "Chart this:"
 * then a CSV, «اعمل جدول من هذي البيانات» then a markdown table — is one `data.show` call with
 * no model. The instruction must ask for a chart or a table (a verb or the word itself) and the
 * rows must read as a grid; anything else returns undefined and the model path runs.
 */

export interface DataReading {
  readonly input: { readonly data: string; readonly as: DataShowAs };
  readonly label: { readonly ar: string; readonly en: string };
}

/** Pasted data larger than this goes to the model, which can summarise it. */
const MAX_DATA_CHARS = 20_000;
const MAX_INSTRUCTION_CHARS = 160;

/** The form each word asks for; folded Arabic (أ→ا, ة→ه), first match wins. */
const FORMS: readonly (readonly [RegExp, DataShowAs])[] = [
  [/\b(?:pie)\b|دائري|كعكه/u, 'pie'],
  [/\b(?:donut|doughnut|ring)\b|حلقي/u, 'donut'],
  [/\b(?:bar|bars|column|columns)\b(?=.*\b(?:chart|graph)\b)|اعمده|شريطي/u, 'bar'],
  [/\b(?:line)\b(?=.*\b(?:chart|graph)\b)|خطي/u, 'line'],
  [/\b(?:area)\b(?=.*\b(?:chart|graph)\b)|مساحي/u, 'area'],
  [/\b(?:chart|graph|plot|visuali[sz]e)\b|مخطط|رسم بياني|رسم|شارت/u, 'auto'],
  [/\b(?:table|grid|spreadsheet)\b|جدول/u, 'table'],
];

/** An instruction: a request for one of the forms, not a question about the data. */
const ASKS =
  /^(?:please\s+)?(?:make|create|add|draw|show|turn|put|build|plot|chart|graph|insert|display|visuali[sz]e|present|convert)\b|^(?:اعمل|سوي|ارسم|اضف|ضيف|حط|اعرض|حول|انشئ|اصنع|ابني|خلي|اجعل|ممكن)|^(?:chart|graph|table)\b|^(?:مخطط|جدول|رسم)/u;

export function readDataRequest(request: string): DataReading | undefined {
  if (request.length > MAX_DATA_CHARS) return undefined;
  const lines = request.replace(/\r\n?/gu, '\n').split('\n');
  const first = lines.findIndex((line) => line.trim() !== '');
  const instruction = lines[first]?.trim() ?? '';
  const data = lines
    .slice(first + 1)
    .join('\n')
    .trim();
  if (instruction === '' || instruction.length > MAX_INSTRUCTION_CHARS || data === '')
    return undefined;
  const folded = normalizeIntentText(instruction)
    .replace(/[:：؛.!]+$/u, '')
    .trim();
  if (!ASKS.test(folded) || folded.includes('?') || folded.includes('؟')) return undefined;
  const as = FORMS.find(([words]) => words.test(folded))?.[1];
  if (as === undefined) return undefined;
  if (!readDataText(data).ok) return undefined;
  return {
    input: { data, as },
    label:
      as === 'table'
        ? { ar: 'إضافة جدول من البيانات', en: 'Add a table from the data' }
        : { ar: 'إضافة مخطط من البيانات', en: 'Add a chart from the data' },
  };
}
