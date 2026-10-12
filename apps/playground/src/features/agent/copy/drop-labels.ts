/**
 * What the panel says when a data file is dragged over it (2026-10-12): the hint over the panel,
 * the instruction line the dropped rows go under (one the zero-token chart path reads), and the
 * two refusals.
 */
import type { Locale } from '../model/view-types';

export interface DropLabels {
  /** Over the panel while a file is dragged across it. */
  readonly hint: string;
  /** The draft's first line when it was empty: the rows follow it. */
  readonly instruction: string;
  readonly refused: string;
  readonly tooLarge: string;
}

const EN: DropLabels = {
  hint: 'Drop a CSV, TSV or Markdown table to chart it',
  instruction: 'Chart this:',
  refused: 'Drop a .csv, .tsv, .md or .txt file.',
  tooLarge: 'That file is over 20 KB. Paste the rows that matter.',
};

const AR: DropLabels = {
  hint: 'أفلت ملف CSV أو TSV أو جدول Markdown لعرضه في مخطط',
  instruction: 'اعرض هذه البيانات في مخطط:',
  refused: 'أفلت ملفًا بامتداد ‎.csv أو ‎.tsv أو ‎.md أو ‎.txt.',
  tooLarge: 'هذا الملف أكبر من 20 كيلوبايت. الصق الصفوف المهمة.',
};

export function dropLabels(locale: Locale): DropLabels {
  return locale === 'ar' ? AR : EN;
}
