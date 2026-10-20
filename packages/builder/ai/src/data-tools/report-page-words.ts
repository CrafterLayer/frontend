import { formatCount, type ReportLang } from './analysis';

/**
 * report.page's own words (2026-10-14), in the page's language: section titles, column headings,
 * KPI labels, the method note and the table tools. Arabic phrasing avoids number agreement
 * («الصفوف: ١٢») so a template never misspells a count. Figures are passed in already formatted.
 */

export interface PageWords {
  readonly report: (name: string) => string;
  readonly span: (first: string, last: string) => string;
  readonly rows: (count: number) => string;
  readonly total: string;
  readonly average: string;
  readonly latest: string;
  readonly highest: string;
  readonly lowest: string;
  readonly vsPrevious: (change: string) => string;
  readonly trendSpan: (first: string, last: string) => string;
  readonly pairedRows: string;
  readonly ofTarget: string;
  readonly cagrShort: (value: string) => string;
  readonly top: (label: string, value: string) => string;
  readonly over: (change: string, first: string, last: string) => string;
  readonly points: string;
  readonly cagr: string;
  readonly perPeriod: (first: string, last: string) => string;
  readonly spread: (median: string, deviation: string) => string;
  readonly trendTitle: (name: string, change: string, first: string, last: string) => string;
  readonly byTitle: (name: string, by: string) => string;
  readonly shareTitle: (name: string, by: string) => string;
  readonly overTime: (name: string, by: string) => string;
  readonly versus: (a: string, b: string) => string;
  readonly fit: (r2: string) => string;
  readonly correlation: (r: string) => string;
  readonly highestIs: (label: string, value: string) => string;
  readonly other: string;
  readonly target: string;
  readonly findings: string;
  readonly finding: string;
  readonly keyFigures: string;
  readonly figure: string;
  readonly value: string;
  readonly detail: string;
  readonly summaryTitle: string;
  readonly columns: {
    readonly measure: string;
    readonly total: string;
    readonly average: string;
    readonly min: string;
    readonly max: string;
    readonly change: string;
    readonly cagr: string;
  };
  readonly dataTitle: string;
  readonly method: (
    rows: number,
    columns: number,
    shown: number,
    total: number,
    lang: ReportLang,
  ) => string;
  readonly bucketed: string;
  readonly emptyAsZero: string;
  /** The table block's tool words in the page's language. */
  readonly table: Readonly<Record<string, string>>;
}

const EN: PageWords = {
  report: (name) => `${name} report`,
  span: (first, last) => `${first} → ${last}`,
  rows: (count) => `${formatCount(count, 'en')} rows`,
  total: 'total',
  average: 'average',
  latest: 'latest',
  highest: 'highest',
  lowest: 'lowest',
  vsPrevious: (change) => `${change} vs previous`,
  trendSpan: (first, last) => `Trend: ${first} → ${last}`,
  pairedRows: 'Computed from rows containing both source values',
  ofTarget: 'of target',
  cagrShort: (value) => `CAGR ${value}`,
  top: (label, value) => `Top: ${label} (${value})`,
  over: (change, first, last) => `${change} from ${first} to ${last}`,
  points: 'pts',
  cagr: 'Compound growth',
  perPeriod: (first, last) => `per period, ${first} → ${last}`,
  spread: (median, deviation) => `median ${median} · std. dev. ${deviation}`,
  trendTitle: (name, change, first, last) => `${name}: ${change} from ${first} to ${last}`,
  byTitle: (name, by) => `${name} by ${by}`,
  shareTitle: (name, by) => `Share of ${name} by ${by}`,
  overTime: (name, by) => `${name} by ${by} over time`,
  versus: (a, b) => `${a} vs ${b}`,
  fit: (r2) => `Linear trend fit R² ${r2}.`,
  correlation: (r) => `Each point is a row; r = ${r}.`,
  highestIs: (label, value) => `Highest: ${label} (${value}).`,
  other: 'Other',
  target: 'Target',
  findings: 'Key findings',
  finding: 'Finding',
  keyFigures: 'Key figures',
  figure: 'Figure',
  value: 'Value',
  detail: 'Detail',
  summaryTitle: 'Summary by measure',
  columns: {
    measure: 'Measure',
    total: 'Total',
    average: 'Average',
    min: 'Min',
    max: 'Max',
    change: 'Change',
    cagr: 'CAGR',
  },
  dataTitle: 'The data',
  method: (rows, columns, shown, total, lang) =>
    rows < total
      ? `Analysed ${formatCount(rows, lang)} of ${formatCount(total, lang)} rows × ${formatCount(columns, lang)} columns; totals are partial. First ${formatCount(shown, lang)} rows shown.`
      : `Computed from the ${formatCount(rows, lang)} rows × ${formatCount(columns, lang)} columns provided; projections are linear.${shown < total ? ` First ${formatCount(shown, lang)} of ${formatCount(total, lang)} rows shown.` : ''}`,
  bucketed: 'consecutive periods grouped to fit the chart',
  emptyAsZero: 'empty cells drawn as 0',
  table: {
    scrollLabel: 'Scrollable table',
    searchLabel: 'Search the table',
    searchPlaceholder: 'Type to filter rows',
    countLabel: '{shown} of {total} rows',
    noResultsLabel: 'No matching rows',
    previousLabel: 'Previous',
    nextLabel: 'Next',
    pageLabel: 'Page {page} of {pages}',
    paginationLabel: 'Table pages',
  },
};

const AR: PageWords = {
  report: (name) => `تقرير ${name}`,
  span: (first, last) => `${first} ← ${last}`,
  rows: (count) => `الصفوف: ${formatCount(count, 'ar')}`,
  total: 'الإجمالي',
  average: 'المتوسط',
  latest: 'الأحدث',
  highest: 'الأعلى',
  lowest: 'الأدنى',
  vsPrevious: (change) => `${change} عن السابق`,
  trendSpan: (first, last) => `الاتجاه: ${first} ← ${last}`,
  pairedRows: 'محسوب من الصفوف التي تحتوي القيمتين الأصليتين',
  ofTarget: 'من الهدف',
  cagrShort: (value) => `النمو المركب ${value}`,
  top: (label, value) => `الأعلى: ${label} (${value})`,
  over: (change, first, last) => `${change} من ${first} إلى ${last}`,
  points: 'نقطة',
  cagr: 'النمو المركب',
  perPeriod: (first, last) => `لكل فترة، ${first} ← ${last}`,
  spread: (median, deviation) => `الوسيط ${median} · الانحراف المعياري ${deviation}`,
  trendTitle: (name, change, first, last) => `${name}: ${change} من ${first} إلى ${last}`,
  byTitle: (name, by) => `${name} حسب ${by}`,
  shareTitle: (name, by) => `توزيع ${name} حسب ${by}`,
  overTime: (name, by) => `${name} حسب ${by} عبر الفترات`,
  versus: (a, b) => `${a} مقابل ${b}`,
  fit: (r2) => `ملاءمة الاتجاه الخطي R² = ${r2}.`,
  correlation: (r) => `كل نقطة صف من البيانات؛ r = ${r}.`,
  highestIs: (label, value) => `الأعلى: ${label} (${value}).`,
  other: 'أخرى',
  target: 'الهدف',
  findings: 'أبرز النتائج',
  finding: 'النتيجة',
  keyFigures: 'الأرقام الرئيسية',
  figure: 'المؤشر',
  value: 'القيمة',
  detail: 'التفصيل',
  summaryTitle: 'ملخص المؤشرات',
  columns: {
    measure: 'المؤشر',
    total: 'الإجمالي',
    average: 'المتوسط',
    min: 'الأدنى',
    max: 'الأعلى',
    change: 'التغير',
    cagr: 'النمو المركب',
  },
  dataTitle: 'البيانات',
  method: (rows, columns, shown, total, lang) =>
    rows < total
      ? `حُلّل ${formatCount(rows, lang)} من ${formatCount(total, lang)} صفًا × ${formatCount(columns, lang)} عمودًا؛ الإجماليات جزئية. المعروض: أول ${formatCount(shown, lang)} صفًا.`
      : `محسوب من البيانات المقدَّمة (الصفوف: ${formatCount(rows, lang)} · الأعمدة: ${formatCount(columns, lang)})؛ التوقعات خطية.${shown < total ? ` المعروض: أول ${formatCount(shown, lang)} من ${formatCount(total, lang)}.` : ''}`,
  bucketed: 'جُمعت فترات متتالية لتتسع في المخطط',
  emptyAsZero: 'الخلايا الفارغة مرسومة صفرًا',
  table: {
    scrollLabel: 'جدول قابل للتمرير',
    searchLabel: 'ابحث في الجدول',
    searchPlaceholder: 'اكتب لتصفية الصفوف',
    countLabel: '{shown} من {total}',
    noResultsLabel: 'لا توجد صفوف مطابقة',
    previousLabel: 'السابق',
    nextLabel: 'التالي',
    pageLabel: 'صفحة {page} من {pages}',
    paginationLabel: 'صفحات الجدول',
  },
};

export function pageWords(lang: ReportLang): PageWords {
  return lang === 'ar' ? AR : EN;
}
