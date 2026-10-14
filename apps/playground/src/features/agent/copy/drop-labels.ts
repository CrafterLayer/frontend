/**
 * What the panel says when a data file is dragged over it (2026-10-12): the hint over the panel,
 * the instruction line the dropped rows go under (one the zero-token chart path reads), and the
 * refusals — Excel and JSON files taken too, and a workbook that cannot be read (2026-10-14).
 */
import type { Locale } from '../model/view-types';

export interface DropLabels {
  /** Over the panel while a file is dragged across it. */
  readonly hint: string;
  /** The draft's first line when it was empty: the rows follow it. */
  readonly instruction: string;
  readonly refused: string;
  readonly tooLarge: string;
  /** A dropped workbook that is damaged, empty or not really Excel. */
  readonly unreadable: string;
}

const EN: DropLabels = {
  hint: 'Drop an Excel, CSV, JSON or Markdown table to chart it',
  instruction: 'Chart this:',
  refused: 'Drop a .xlsx, .csv, .tsv, .json, .md or .txt file.',
  tooLarge: 'That file has over 20 KB of rows. Paste the rows that matter.',
  unreadable: 'That workbook could not be read. Save it again as .xlsx or .csv.',
};

const AR: DropLabels = {
  hint: 'أفلت ملف Excel أو CSV أو JSON أو جدول Markdown لعرضه في مخطط',
  instruction: 'اعرض هذه البيانات في مخطط:',
  refused: 'أفلت ملفًا بامتداد ‎.xlsx أو ‎.csv أو ‎.tsv أو ‎.json أو ‎.md أو ‎.txt.',
  tooLarge: 'صفوف هذا الملف أكبر من 20 كيلوبايت. الصق الصفوف المهمة.',
  unreadable: 'تعذّرت قراءة ملف Excel هذا. احفظه من جديد بصيغة ‎.xlsx أو ‎.csv.',
};

export function dropLabels(locale: Locale): DropLabels {
  return locale === 'ar' ? AR : EN;
}
