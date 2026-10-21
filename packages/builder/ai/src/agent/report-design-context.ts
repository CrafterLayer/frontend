import type { AiContextProvider } from '@craftkit/builder-schema';
import { analyzeGrid } from '../data-tools/analysis';
import { readDataText } from '../data-tools/data-text';
import { dataTable, headerOf, kpiCards, summaryTable } from '../data-tools/report-page-sections';
import { pageWords } from '../data-tools/report-page-words';

export const REPORT_DATA_PROVIDER_ID = 'craftkit.computed-report-data';
const MAX_REQUEST_CHARS = 20_000;
const MAX_FRAGMENT_CHARS = 12_000;

/** Calculations support arbitrary authored geometry; raw labels remain untrusted user data. */
export function reportDesignProviders(
  request: string,
  language?: string,
): readonly AiContextProvider[] {
  if (request.length > MAX_REQUEST_CHARS) return [];
  const lines = request.trim().split(/\r?\n/u);
  if (lines.length < 2) return [];
  const parsed = readDataText(lines.slice(1).join('\n'));
  if (!parsed.ok) return [];
  const initialAnalysis = analyzeGrid(parsed.grid);
  if (typeof initialAnalysis === 'string') return [];
  return [
    {
      id: REPORT_DATA_PROVIDER_ID,
      collect(ctx) {
        const document = ctx.store.getState().doc;
        const locale = language ?? document.nodes[document.rootId]?.props['lang'];
        // Direction is not a language: Hebrew/Persian RTL does not imply Arabic.
        const lang = typeof locale === 'string' && /^ar(?:-|$)/iu.test(locale) ? 'ar' : 'en';
        const localized = lang === 'ar' ? analyzeGrid(parsed.grid, { lang }) : initialAnalysis;
        const analysis = typeof localized === 'string' ? initialAnalysis : localized;
        const words = pageWords(lang);
        const header = headerOf(analysis, words, lang, undefined, undefined);
        const base = {
          rows: analysis.rows,
          totalRows: analysis.totalRows,
          columns: analysis.columns,
          header,
          metrics: kpiCards(analysis, words, lang, 'analytical'),
          findings: analysis.insights.map((item) => item.text[lang]),
          quality: analysis.quality.map((item) => item[lang]),
          summary: summaryTable(analysis, words, lang),
        };
        const full = { ...base, data: dataTable(analysis, words, lang) };
        // Drop detail rows as a unit, never truncate a JSON value, figure or source-quality note.
        let body = JSON.stringify(JSON.stringify(full).length <= MAX_FRAGMENT_CHARS ? full : base);
        if (body.length > MAX_FRAGMENT_CHARS)
          body = JSON.stringify({
            rows: analysis.rows,
            totalRows: analysis.totalRows,
            availability:
              'Computed summary exceeds context bounds. Use report.page for complete computed figures and quality notes; do not invent missing results.',
          });
        return {
          source: REPORT_DATA_PROVIDER_ID,
          kind: 'data',
          trust: 'untrusted',
          title: 'COMPUTED REPORT DATA',
          body,
        };
      },
    },
  ];
}

/** Preserve host/scene providers and avoid duplicate computed fragments on section runs. */
export function withReportDesign<
  T extends { readonly additionalContextProviders?: readonly AiContextProvider[] },
>(request: string, own: T, language?: string): T {
  if (own.additionalContextProviders?.some(({ id }) => id === REPORT_DATA_PROVIDER_ID)) return own;
  const providers = reportDesignProviders(request, language);
  return providers.length === 0
    ? own
    : {
        ...own,
        additionalContextProviders: [...(own.additionalContextProviders ?? []), ...providers],
      };
}
