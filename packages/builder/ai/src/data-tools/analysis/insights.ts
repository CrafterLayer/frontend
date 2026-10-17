import type { DerivedMetric } from './derived';
import {
  formatPercent,
  formatPoints,
  formatRatio,
  formatValue,
  type ReportLang,
  type Unit,
} from './format';
import type { Breakdown } from './groups';
import type { MeasureAnalysis } from './measures';

/**
 * The findings of a report (2026-10-14): a ranked list of facts, each a sentence in English and
 * in Arabic from a fixed template — no model writes them — around numbers the engine computed,
 * each formatted in its sentence's language (Arabic-Indic digits in the Arabic one), units kept,
 * percentages to one decimal. A projection says it is one. The page prints its language's
 * sentence; the first is the headline.
 */

export type InsightKind =
  | 'change'
  | 'extremes'
  | 'swing'
  | 'cagr'
  | 'trend'
  | 'forecast'
  | 'share'
  | 'group'
  | 'outliers'
  | 'correlation'
  | 'profit'
  | 'attainment'
  | 'remaining';

export interface Insight {
  readonly kind: InsightKind;
  /** Higher reads first. */
  readonly score: number;
  readonly measure?: string | undefined;
  readonly text: { readonly en: string; readonly ar: string };
}

export interface Correlation {
  readonly a: MeasureAnalysis;
  readonly b: MeasureAnalysis;
  readonly r: number;
}

export interface InsightInput {
  readonly labels: readonly string[];
  readonly timeSeries: boolean;
  readonly measures: readonly MeasureAnalysis[];
  readonly derived: readonly DerivedMetric[];
  readonly breakdowns: readonly Breakdown[];
  readonly correlations: readonly Correlation[];
  /** The category column names a breakdown refers to, by column index. */
  readonly headings: readonly string[];
  readonly nextLabel?: string | undefined;
}

export const MAX_INSIGHTS = 10;

type Text = (lang: ReportLang) => string;

function both(text: Text): { en: string; ar: string } {
  return { en: text('en'), ar: text('ar') };
}

const v = (value: number, unit: Unit, lang: ReportLang, signed = false) =>
  formatValue(value, unit, lang, signed);
const pct = (value: number, lang: ReportLang, signed = false) => formatPercent(value, lang, signed);
const arrow = (lang: ReportLang) => (lang === 'ar' ? '←' : '→');

function changeInsight(m: MeasureAnalysis, main: boolean): Insight | undefined {
  if (m.first.label === m.last.label || m.count < 2) return undefined;
  const { absolute, percent } = m.change;
  const up = absolute > 0;
  const span = (lang: ReportLang) =>
    `(${v(m.first.value, m.unit, lang)} ${arrow(lang)} ${v(m.last.value, m.unit, lang)})`;
  if (absolute === 0) {
    return {
      kind: 'change',
      score: main ? 30 : 10,
      measure: m.name,
      text: both((lang) =>
        lang === 'ar'
          ? `${m.name}: دون تغيير من ${m.first.label} إلى ${m.last.label} (${v(m.last.value, m.unit, lang)}).`
          : `${m.name} was unchanged from ${m.first.label} to ${m.last.label} (${v(m.last.value, m.unit, lang)}).`,
      ),
    };
  }
  /* A percent column changes by points, not by a percent of a percent. */
  const amount = (lang: ReportLang) =>
    m.kind === 'percent'
      ? `${formatPoints(Math.abs(absolute), lang)} ${lang === 'ar' ? 'نقطة' : 'points'}`
      : percent === undefined
        ? v(Math.abs(absolute), m.unit, lang)
        : pct(Math.abs(percent), lang);
  return {
    kind: 'change',
    score: Math.min(100, Math.abs(percent ?? 50)) + (main ? 40 : 0),
    measure: m.name,
    text: both((lang) =>
      lang === 'ar'
        ? `${m.name}: ${up ? 'ارتفاع' : 'انخفاض'} بمقدار ${amount(lang)} من ${m.first.label} إلى ${m.last.label} ${span(lang)}.`
        : `${m.name} ${up ? 'rose' : 'fell'} ${amount(lang)} from ${m.first.label} to ${m.last.label} ${span(lang)}.`,
    ),
  };
}

function extremesInsight(m: MeasureAnalysis, main: boolean): Insight | undefined {
  if (m.count < 2 || m.max.label === m.min.label) return undefined;
  return {
    kind: 'extremes',
    score: main ? 35 : 15,
    measure: m.name,
    text: both((lang) =>
      lang === 'ar'
        ? `أعلى قيمة في ${m.name}: ${m.max.label} (${v(m.max.value, m.unit, lang)})، وأدنى قيمة: ${m.min.label} (${v(m.min.value, m.unit, lang)}).`
        : `Highest ${m.name}: ${m.max.label} (${v(m.max.value, m.unit, lang)}); lowest: ${m.min.label} (${v(m.min.value, m.unit, lang)}).`,
    ),
  };
}

/** The largest rise and the largest fall between consecutive periods. */
function swingInsights(m: MeasureAnalysis, labels: readonly string[]): Insight[] {
  if (m.count < 3) return [];
  const steps = m.growth.flatMap((growth, index) => {
    const now = m.values[index];
    const before = m.values[index - 1];
    return growth === undefined || now === undefined || before === undefined
      ? []
      : [{ growth, index, delta: now - before }];
  });
  const rise = steps.reduce<(typeof steps)[number] | undefined>(
    (best, step) =>
      step.growth > 0 && (best === undefined || step.growth > best.growth) ? step : best,
    undefined,
  );
  const fall = steps.reduce<(typeof steps)[number] | undefined>(
    (best, step) =>
      step.growth < 0 && (best === undefined || step.growth < best.growth) ? step : best,
    undefined,
  );
  return [rise, fall].flatMap((step) => {
    if (step === undefined) return [];
    const from = labels[step.index - 1] ?? '';
    const to = labels[step.index] ?? '';
    const up = step.growth > 0;
    return [
      {
        kind: 'swing' as const,
        score: Math.min(60, Math.abs(step.growth) * 0.6),
        measure: m.name,
        text: both((lang) =>
          lang === 'ar'
            ? `${up ? 'أكبر ارتفاع' : 'أكبر انخفاض'} في ${m.name}: من ${from} إلى ${to}، ${pct(step.growth, lang, true)} (${v(step.delta, m.unit, lang, true)}).`
            : `Biggest ${up ? 'rise' : 'fall'} in ${m.name}: ${from} ${arrow(lang)} ${to}, ${pct(step.growth, lang, true)} (${v(step.delta, m.unit, lang, true)}).`,
        ),
      },
    ];
  });
}

function trendInsights(m: MeasureAnalysis, main: boolean, next: string | undefined): Insight[] {
  const out: Insight[] = [];
  if (m.cagr !== undefined && m.count >= 3) {
    const cagr = m.cagr;
    out.push({
      kind: 'cagr',
      score: main ? 28 : 12,
      measure: m.name,
      text: both((lang) =>
        lang === 'ar'
          ? `النمو المركب في ${m.name}: ${pct(cagr, lang, true)} لكل فترة من ${m.first.label} إلى ${m.last.label}.`
          : `Compound growth of ${m.name}: ${pct(cagr, lang, true)} per period from ${m.first.label} to ${m.last.label}.`,
      ),
    });
  }
  const trend = m.trend;
  if (trend === undefined || m.count < 3 || trend.slope === 0) return out;
  const up = trend.slope > 0;
  out.push({
    kind: 'trend',
    score: trend.r2 * (main ? 45 : 20),
    measure: m.name,
    text: both((lang) =>
      lang === 'ar'
        ? `اتجاه ${m.name}: ${up ? 'صاعد' : 'هابط'} بنحو ${v(Math.abs(trend.slope), m.unit, lang)} لكل فترة (R² = ${formatRatio(trend.r2, lang)}).`
        : `${m.name} trends ${up ? 'up' : 'down'} by about ${v(Math.abs(trend.slope), m.unit, lang)} per period (R² ${formatRatio(trend.r2, lang)}).`,
    ),
  });
  const forecast = m.forecast;
  if (main && forecast !== undefined && trend.r2 >= 0.5) {
    out.push({
      kind: 'forecast',
      score: 18,
      measure: m.name,
      text: both((lang) =>
        lang === 'ar'
          ? `توقّع وليس نتيجة: إذا استمر الاتجاه الخطي فقد يبلغ ${m.name} نحو ${v(forecast, m.unit, lang)} في ${next ?? 'الفترة التالية'}.`
          : `Projection, not a result: if the linear trend holds, ${m.name} would be about ${v(forecast, m.unit, lang)} in ${next ?? 'the next period'}.`,
      ),
    });
  }
  return out;
}

function shareInsight(m: MeasureAnalysis, labels: readonly string[]): Insight | undefined {
  const shares = m.shares;
  if (shares === undefined || m.count < 2) return undefined;
  const at = m.values.findIndex((value) => value === m.max.value);
  const share = shares[at];
  if (share === undefined) return undefined;
  const label = labels[at] ?? '';
  return {
    kind: 'share',
    score: 20 + share * 0.5,
    measure: m.name,
    text: both((lang) =>
      lang === 'ar'
        ? `الأكبر في ${m.name}: ${label} بحصة ${pct(share, lang)} من الإجمالي (${v(m.max.value, m.unit, lang)} من ${v(m.sum, m.unit, lang)}).`
        : `Largest ${m.name}: ${label}, ${pct(share, lang)} of the total (${v(m.max.value, m.unit, lang)} of ${v(m.sum, m.unit, lang)}).`,
    ),
  };
}

function groupInsight(b: Breakdown, m: MeasureAnalysis, by: string): Insight | undefined {
  const top = b.groups[0];
  const low = b.groups.at(-1);
  if (top === undefined || low === undefined) return undefined;
  const share = top.share;
  if (share !== undefined) {
    return {
      kind: 'group',
      score: 30 + share * 0.4,
      measure: m.name,
      text: both((lang) =>
        lang === 'ar'
          ? `حسب ${by}: ${top.key} في الصدارة في ${m.name} بحصة ${pct(share, lang)} من الإجمالي (${v(top.sum, m.unit, lang)} من ${v(b.total, m.unit, lang)}).`
          : `By ${by}, ${top.key} leads ${m.name} with ${pct(share, lang)} of the total (${v(top.sum, m.unit, lang)} of ${v(b.total, m.unit, lang)}).`,
      ),
    };
  }
  return {
    kind: 'group',
    score: 25,
    measure: m.name,
    text: both((lang) =>
      lang === 'ar'
        ? `حسب ${by}: أعلى متوسط في ${m.name} لـ${top.key} (${v(top.mean, m.unit, lang)})، والأدنى لـ${low.key} (${v(low.mean, m.unit, lang)}).`
        : `By ${by}, ${top.key} has the highest average ${m.name} (${v(top.mean, m.unit, lang)}); ${low.key} the lowest (${v(low.mean, m.unit, lang)}).`,
    ),
  };
}

function outlierInsight(m: MeasureAnalysis, labels: readonly string[]): Insight | undefined {
  const fences = m.outliers;
  if (fences === undefined || fences.rows.length === 0) return undefined;
  const rows = fences.rows.slice(0, 3);
  const list = (lang: ReportLang) =>
    rows
      .map((row) => `${labels[row] ?? ''} (${v(m.values[row] ?? 0, m.unit, lang)})`)
      .join(lang === 'ar' ? '، ' : ', ');
  const low = Math.max(fences.low, m.min.value);
  const high = Math.min(fences.high, m.max.value);
  return {
    kind: 'outliers',
    score: 26,
    measure: m.name,
    text: both((lang) =>
      lang === 'ar'
        ? `قيم غير معتادة في ${m.name}: ${list(lang)} — خارج النطاق المعتاد ${v(low, m.unit, lang)}–${v(high, m.unit, lang)}.`
        : `Unusual ${m.name}: ${list(lang)} — outside the usual range ${v(low, m.unit, lang)}–${v(high, m.unit, lang)}.`,
    ),
  };
}

function correlationInsight({ a, b, r }: Correlation): Insight {
  const together = r > 0;
  return {
    kind: 'correlation',
    score: Math.abs(r) * 30,
    measure: a.name,
    text: both((lang) =>
      lang === 'ar'
        ? `${a.name} و${b.name} ${together ? 'يتحركان معًا' : 'يتحركان في اتجاهين متعاكسين'} (r = ${formatRatio(r, lang)}).`
        : `${a.name} and ${b.name} move ${together ? 'together' : 'in opposite directions'} (r = ${formatRatio(r, lang)}).`,
    ),
  };
}

function derivedInsight(d: DerivedMetric): Insight {
  const [a, b] = d.from;
  const [ta, tb] = d.totals;
  const unit = a.unit;
  if (d.kind === 'profit') {
    return {
      kind: 'profit',
      score: 50,
      measure: a.name,
      text: both((lang) =>
        lang === 'ar'
          ? `هامش الربح: ${pct(d.overall, lang)} إجمالًا (ربح ${v(ta - tb, unit, lang)} من ${a.name} ${v(ta, unit, lang)}).`
          : `Profit margin: ${pct(d.overall, lang)} overall (profit ${v(ta - tb, unit, lang)} on ${a.name} ${v(ta, unit, lang)}).`,
      ),
    };
  }
  if (d.kind === 'attainment') {
    return {
      kind: 'attainment',
      score: 50,
      measure: a.name,
      text: both((lang) =>
        lang === 'ar'
          ? `بلغ ${a.name} ${pct(d.overall, lang)} من ${b.name} إجمالًا (${v(ta, unit, lang)} من ${v(tb, unit, lang)}).`
          : `${a.name} reached ${pct(d.overall, lang)} of ${b.name} overall (${v(ta, unit, lang)} of ${v(tb, unit, lang)}).`,
      ),
    };
  }
  const spent = ta === 0 ? undefined : (tb / ta) * 100;
  const over = d.overall < 0;
  return {
    kind: 'remaining',
    score: over ? 55 : 45,
    measure: a.name,
    text: both((lang) => {
      const share =
        spent === undefined ? '' : ` (${lang === 'ar' ? 'صُرف' : 'spent'} ${pct(spent, lang)})`;
      if (over)
        return lang === 'ar'
          ? `تجاوز ${b.name} ${a.name} بمقدار ${v(-d.overall, unit, lang)}${share}.`
          : `${b.name} is over ${a.name} by ${v(-d.overall, unit, lang)}${share}.`;
      return lang === 'ar'
        ? `المتبقي من ${a.name}: ${v(d.overall, unit, lang)}${share}.`
        : `${a.name} remaining: ${v(d.overall, unit, lang)}${share}.`;
    }),
  };
}

/** Every finding, highest score first, at most MAX_INSIGHTS. */
export function insightsOf(input: InsightInput): Insight[] {
  const { labels, timeSeries, measures } = input;
  const out: Insight[] = [];
  for (const [index, m] of measures.entries()) {
    const main = index === 0;
    if (timeSeries) {
      out.push(...[changeInsight(m, main)].filter((each) => each !== undefined));
      out.push(...swingInsights(m, labels).filter(() => main || measures.length <= 2));
      out.push(...trendInsights(m, main, input.nextLabel));
    } else {
      const share = shareInsight(m, labels);
      if (share !== undefined && input.breakdowns.length === 0) out.push(share);
    }
    const extremes = extremesInsight(m, main);
    if (extremes !== undefined) out.push(extremes);
    const outliers = outlierInsight(m, labels);
    if (outliers !== undefined) out.push(outliers);
  }
  const seen = new Set<string>();
  for (const b of input.breakdowns) {
    const key = `${String(b.by)}:${String(b.measure)}`;
    const m = measures.find((each) => each.column === b.measure);
    if (m === undefined || seen.has(key)) continue;
    seen.add(key);
    const insight = groupInsight(b, m, input.headings[b.by] ?? '');
    if (insight !== undefined) out.push(insight);
  }
  out.push(...input.correlations.map(correlationInsight));
  out.push(...input.derived.map(derivedInsight));
  return out.sort((a, b) => b.score - a.score).slice(0, MAX_INSIGHTS);
}
