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
 *
 * 2026-10-14: "make a detailed report / dashboard page from this:", «اعمل تقرير مفصل», «تقرير
 * كامل», «صفحة تقرير», «لوحة تحكم», "analyse this:" — one `report.page`, every figure computed;
 * the plain "report" wording keeps going to report.build. JSON rows read as well (data-json.ts).
 */

export interface DataReading {
  readonly tool: 'data.show' | 'report.build' | 'report.page';
  readonly input: {
    readonly data: string;
    readonly as?: DataShowAs;
    readonly presentation?: 'executive' | 'financial' | 'operational' | 'comparison';
    readonly charts?: readonly { readonly as: Exclude<DataShowAs, 'auto' | 'table'> }[];
  };
  readonly label: { readonly ar: string; readonly en: string };
}

/** Pasted data larger than this goes to the model, which can summarise it. */
const MAX_DATA_CHARS = 20_000;
const MAX_INSTRUCTION_CHARS = 160;

/** A report or a dashboard of the rows; folded Arabic («لوحة» → «لوحه»). */
const REPORT = /\b(?:report|dashboard|summary report|kpis?)\b|تقرير|لوحه|داشبورد/u;

/** A whole computed report page: detailed, full, an analysis, a dashboard page; folded Arabic. */
const PAGE =
  /\b(?:(?:detailed|full|complete|in-depth|comprehensive)\s+(?:report|analysis|dashboard)|(?:report|dashboard|analysis)\s+page|analy[sz]e|analysis)\b|تقرير\s+(?:مفصل|كامل|شامل|تفصيلي)|صفحه\s+تقرير|لوحه\s+تحكم|تحليل|حلل/u;

/** The form each word asks for; folded Arabic (أ→ا, ة→ه), first match wins. */
const FORMS: readonly (readonly [RegExp, DataShowAs])[] = [
  [/\bwaterfall\b|شلال/u, 'waterfall'],
  [/\bheat\s?map\b|خريطه حراريه/u, 'heatmap'],
  [/\btree\s?map\b|خريطه شجريه/u, 'treemap'],
  [/\bhistogram\b|مدرج تكراري/u, 'histogram'],
  [/\bbubble\b|فقاع/u, 'bubble'],
  [/\bbox\s?plot\b|صندوقي|صندوق وشعيرات/u, 'boxplot'],
  [/\bcandlestick|\bohlc\b|شموع/u, 'candlestick'],
  [/\blollipop\b|مصاصه/u, 'lollipop'],
  [/\bbullet\b|مخطط رصاصي/u, 'bullet'],
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
  /^(?:please\s+)?(?:make|create|add|draw|show|turn|put|build|plot|chart|graph|insert|display|visuali[sz]e|present|convert|generate)\b|^(?:analy[sz]e)\b|^(?:اعمل|سوي|ارسم|اضف|ضيف|حط|اعرض|حول|انشئ|اصنع|ابني|خلي|اجعل|ممكن|جهز)|^(?:chart|graph|table|report|dashboard)\b|^(?:مخطط|جدول|رسم|تقرير|لوحه|حلل|تحليل)/u;

/**
 * A shortcut may consume only the instruction it implements. Unhandled words (a title,
 * reference, layout, language or other requirement) belong to the model with the full request.
 * This is a conservative vocabulary for this shortcut, not a limit on supported languages.
 */
const REPORT_INSTRUCTION_WORDS = new Set(
  `please make create add draw show turn put build plot chart graph insert display visualize
visualise present convert generate analyze analyse detailed full complete in depth comprehensive
report reports dashboard summary analysis page kpi kpis this these those the a an as in from of
with our my your data dataset rows numbers figures sales bookings table executive financial
operational comparison
اعمل سوي ارسم اضف ضيف حط اعرض حول انشئ اصنع ابني خلي اجعل ممكن جهز حلل تحليل تقرير
لوحه تحكم معلومات بيانات البيانات هذي هذه هذول الارقام ارقام من في كجدول
مفصل كامل شامل تفصيلي صفحه تنفيذي مالي تشغيلي مقارنه مخطط رسم بياني شارت جدول
المبيعات مع داشبورد`
    .split(/\s+/u)
    .filter(Boolean),
);

function plainReportInstruction(instruction: string, form?: (typeof FORMS)[number]): boolean {
  if (/[^\p{L}\p{N}\s:：؛.!\/-]/u.test(instruction)) return false;
  // Report tools include a chart by default; an explicitly table-only presentation needs
  // the model to choose supported composition instead of discarding that instruction.
  if (/\b(?:as|in)\s+(?:(?:a|the)\s+)?table\b|كجدول|في\s+جدول/u.test(instruction)) return false;
  const matched = form?.[0].exec(instruction)?.[0] ?? '';
  const formWords = new Set(matched.match(/[\p{L}\p{N}]+/gu) ?? []);
  // A horizontal-bar expression can match just its qualifier. Multiple named charts still
  // belong to the model; treating "bar and line charts" as one combo loses that ambiguity.
  if (form?.[1] === 'hbar') for (const word of ['bar', 'bars', 'اعمده']) formWords.add(word);
  return (instruction.match(/[\p{L}\p{N}]+/gu) ?? []).every(
    (word) => REPORT_INSTRUCTION_WORDS.has(word) || (word !== 'and' && formWords.has(word)),
  );
}

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
  // Do not let a generic "chart" word silently override a named unsupported family.
  if (
    /\b(?:sankey|sunburst|violin|choropleth|network graph|3d|gantt)\b|سانكي|خريطه جغرافيه|مخطط جانت/u.test(
      folded,
    )
  )
    return undefined;
  if (!readDataText(data).ok) return undefined;
  const form = FORMS.find(([words]) => words.test(folded));
  if ((PAGE.test(folded) || REPORT.test(folded)) && !plainReportInstruction(folded, form))
    return undefined;
  const as = form?.[1];
  const chart = as === undefined || as === 'auto' || as === 'table' ? undefined : as;
  const presentation = /\bexecutive\b|تنفيذي/u.test(folded)
    ? 'executive'
    : /\bfinancial\b|تقرير مالي/u.test(folded)
      ? 'financial'
      : /\boperational\b|تشغيلي/u.test(folded)
        ? 'operational'
        : /\bcomparison report\b|تقرير مقارنه/u.test(folded)
          ? 'comparison'
          : undefined;
  if (PAGE.test(folded) || (REPORT.test(folded) && presentation !== undefined)) {
    return {
      tool: 'report.page',
      input: {
        data,
        ...(presentation === undefined ? {} : { presentation }),
        ...(chart === undefined ? {} : { charts: [{ as: chart }] }),
      },
      label: {
        ar: 'إضافة صفحة تقرير محسوبة من البيانات',
        en: 'Add a computed report page from the data',
      },
    };
  }
  if (REPORT.test(folded)) {
    return {
      tool: 'report.build',
      input: { data, ...(chart === undefined ? {} : { as: chart }) },
      label: { ar: 'إضافة تقرير من البيانات', en: 'Add a report from the data' },
    };
  }
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
