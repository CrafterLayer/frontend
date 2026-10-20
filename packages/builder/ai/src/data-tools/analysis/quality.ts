import { readNumber, type DataGrid } from '../data-text';
import type { Bilingual } from './derived';
import { formatCount } from './format';
import type { GridProfile } from './profile';
import type { Timeline } from './timeline';

/** Visible method caveats; counts refer to source cells, not values after aggregation. */
export function qualityNotes(
  grid: DataGrid,
  profile: GridProfile,
  totalRows: number,
  timeline: Timeline,
  incompletePivot = false,
): Bilingual[] {
  const notes: Bilingual[] = [];
  if (grid.rows.length < totalRows)
    notes.push({
      en: `Analysis uses the first ${formatCount(grid.rows.length, 'en')} of ${formatCount(totalRows, 'en')} supplied rows; totals are partial.`,
      ar: `التحليل يشمل أول ${formatCount(grid.rows.length, 'ar')} من ${formatCount(totalRows, 'ar')} صفًا مقدمًا؛ الإجماليات جزئية.`,
    });
  if (profile.timeSeries && (!timeline.comparable || !timeline.regular))
    notes.push({
      en: 'Period order or spacing is uncertain or incomplete; compound growth and projections are omitted.',
      ar: 'ترتيب الفترات أو تباعدها غير مؤكد أو غير مكتمل؛ لم يُحسب النمو المركب أو التوقعات.',
    });
  const missing = grid.rows.reduce(
    (count, row) =>
      count +
      profile.measures.filter((column) => readNumber(row[column] ?? '') === undefined).length,
    0,
  );
  if (missing > 0)
    notes.push({
      en: `${formatCount(missing, 'en')} missing numeric cells are excluded from statistics. Derived figures use only source rows containing both values; incomplete series are omitted from charts.`,
      ar: `استُبعدت ${formatCount(missing, 'ar')} خلية رقمية مفقودة من الإحصاءات. المؤشرات المشتقة تستخدم الصفوف التي تحتوي القيمتين فقط؛ السلاسل غير المكتملة لا تُرسم.`,
    });
  const units = new Set(
    profile.measures.map((column) => {
      const unit = profile.columns[column]?.unit;
      return JSON.stringify([unit?.prefix.trim(), unit?.suffix.trim()]);
    }),
  );
  if (units.size > 1)
    notes.push({
      en: 'Measures use different units. Derived differences and ratios require matching units; no currency or unit conversion is assumed.',
      ar: 'المؤشرات بوحدات مختلفة. الفروق والنسب المشتقة تتطلب وحدات متطابقة؛ لم يُفترض أي تحويل للعملات أو الوحدات.',
    });
  if (profile.measures.some((column) => profile.columns[column]?.kind === 'percent'))
    notes.push({
      en: 'Percentage summaries are unweighted arithmetic averages; no denominator or weighting is inferred.',
      ar: 'ملخصات النسب المئوية متوسطات حسابية غير موزونة؛ لم يُفترض مقام أو وزن غير موجود.',
    });
  if (incompletePivot)
    notes.push({
      en: 'Some group/period combinations have no observation. Their comparison chart is omitted instead of filling them with zero.',
      ar: 'بعض مجموعات الفئة والفترة بلا قياس. حُذف مخطط مقارنتها بدل ملء القيم المفقودة بصفر.',
    });
  return notes;
}
