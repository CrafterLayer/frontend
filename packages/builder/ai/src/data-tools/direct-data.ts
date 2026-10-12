import { normalizeIntentText } from '../intent/normalize-arabic';
import { readDataText } from './data-text';
import type { DataShowAs } from './data-show';

/**
 * The zero-token data reading (2026-10-12): an instruction line over pasted rows — "Chart this:"
 * then a CSV, «اعمل جدول من هذي البيانات» then a markdown table — is one `data.show` call with
 * no model; "make a report from this:" or «اعمل تقرير/لوحة من هذه البيانات:» is one
 * `report.build`. The instruction must ask for a chart, a table or a report (a verb or the word
 * itself) and the rows must read as a grid; anything else returns undefined and the model path
 * runs.
 */

export interface DataReading {
  readonly tool: 'data.show' | 'report.build';
  readonly input: { readonly data: string; readonly as?: DataShowAs };
  readonly label: { readonly ar: string; readonly en: string };
}

/** Pasted data larger than this goes to the model, which can summarise it. */
const MAX_DATA_CHARS = 20_000;
const MAX_INSTRUCTION_CHARS = 160;

/** A report or a dashboard of the rows; folded Arabic («لوحة» → «لوحه»). */
const REPORT = /\b(?:report|dashboard|summary report|kpis?)\b|تقرير|لوحه|داشبورد/u;

/** The form each word asks for; folded Arabic (أ→ا, ة→ه), first match wins. */
const FORMS: readonly (readonly [RegExp, DataShowAs])[] = [
  [/\b(?:pie)\b|دائري|كعكه/u, 'pie'],
  [/\b(?:donut|doughnut|ring)\b|حلقي/u, 'donut'],
  [/\b(?:funnel)\b|قمع/u, 'funnel'],
  [/\b(?:gauge|dial|meter)\b|عداد|مقياس/u, 'gauge'],
  [/\b(?:radar|spider)\b|راداري|رادار|عنكبوتي/u, 'radar'],
  [/\b(?:scatter|xy|correlation)\b|انتشار|تشتت|مبعثر/u, 'scatter'],
  [/\b(?:sparklines?|trend ?lines?)\b|خط اتجاه|خطوط اتجاه|مصغر/u, 'sparkline'],
  [/\b(?:combo|combined|bars? and (?:a )?lines?)\b|مركب|مختلط|اعمده وخط/u, 'combo'],
  [/\bhorizontal\b(?=.*\b(?:bars?|chart|graph)\b)|\bhbar\b|افقي/u, 'hbar'],
  [/\b(?:bar|bars|column|columns)\b(?=.*\b(?:chart|graph)\b)|اعمده|شريطي/u, 'bar'],
  [/\b(?:line)\b(?=.*\b(?:chart|graph)\b)|خطي/u, 'line'],
  [/\b(?:area)\b(?=.*\b(?:chart|graph)\b)|مساحي/u, 'area'],
  [/\b(?:chart|graph|plot|visuali[sz]e)\b|مخطط|رسم بياني|رسم|شارت/u, 'auto'],
  [/\b(?:table|grid|spreadsheet)\b|جدول/u, 'table'],
];

/** An instruction: a request for one of the forms, not a question about the data. */
const ASKS =
  /^(?:please\s+)?(?:make|create|add|draw|show|turn|put|build|plot|chart|graph|insert|display|visuali[sz]e|present|convert|generate)\b|^(?:اعمل|سوي|ارسم|اضف|ضيف|حط|اعرض|حول|انشئ|اصنع|ابني|خلي|اجعل|ممكن|جهز)|^(?:chart|graph|table|report|dashboard)\b|^(?:مخطط|جدول|رسم|تقرير|لوحه)/u;

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
  if (!readDataText(data).ok) return undefined;
  if (REPORT.test(folded)) {
    return {
      tool: 'report.build',
      input: { data },
      label: { ar: 'إضافة تقرير من البيانات', en: 'Add a report from the data' },
    };
  }
  const as = FORMS.find(([words]) => words.test(folded))?.[1];
  if (as === undefined) return undefined;
  return {
    tool: 'data.show',
    input: { data, as },
    label:
      as === 'table'
        ? { ar: 'إضافة جدول من البيانات', en: 'Add a table from the data' }
        : { ar: 'إضافة مخطط من البيانات', en: 'Add a chart from the data' },
  };
}
