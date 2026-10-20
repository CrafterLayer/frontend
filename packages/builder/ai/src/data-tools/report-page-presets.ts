import type { Analysis } from './analysis';
import type { ChartSection } from './report-page-charts';
import type { ReportPresentation } from './report-page-options';

interface Presentation {
  readonly findingsFirst: boolean;
  readonly summary: boolean;
  readonly data: boolean;
  readonly chartLimit: number;
  readonly priority: readonly ChartSection['key'][];
}

const PRESENTATIONS: Record<ReportPresentation, Presentation> = {
  analytical: { findingsFirst: false, summary: true, data: true, chartLimit: 6, priority: [] },
  executive: {
    findingsFirst: true,
    summary: false,
    data: false,
    chartLimit: 2,
    priority: ['trend', 'comparison', 'ranking', 'share', 'pivot'],
  },
  financial: {
    findingsFirst: false,
    summary: true,
    data: true,
    chartLimit: 4,
    priority: ['comparison', 'trend', 'ranking', 'share', 'pivot'],
  },
  operational: {
    findingsFirst: false,
    summary: true,
    data: true,
    chartLimit: 3,
    priority: ['trend', 'comparison', 'pivot', 'ranking', 'share'],
  },
  comparison: {
    findingsFirst: false,
    summary: true,
    data: true,
    chartLimit: 3,
    priority: ['ranking', 'comparison', 'share', 'pivot', 'trend'],
  },
};

export function reportPresentation(name: ReportPresentation = 'analytical'): Presentation {
  return PRESENTATIONS[name];
}

/** Presentations select and order computed charts; explicit chart requests bypass this policy. */
export function presentationCharts(
  charts: readonly ChartSection[],
  presentation: ReportPresentation = 'analytical',
): ChartSection[] {
  const settings = reportPresentation(presentation);
  const rank = (chart: ChartSection) => {
    const index = settings.priority.indexOf(chart.key);
    return index < 0 ? settings.priority.length : index;
  };
  return [...charts].sort((a, b) => rank(a) - rank(b)).slice(0, settings.chartLimit);
}

/** Executive summaries remain short, while every source-quality limitation stays visible. */
export function presentationFindings(
  analysis: Analysis,
  presentation: ReportPresentation = 'analytical',
): Analysis {
  if (presentation === 'executive') return { ...analysis, insights: analysis.insights.slice(0, 3) };
  const first =
    presentation === 'financial'
      ? ['profit', 'remaining']
      : presentation === 'operational'
        ? ['attainment', 'remaining', 'change']
        : [];
  const rank = (kind: string) => {
    const index = first.indexOf(kind);
    return index < 0 ? first.length : index;
  };
  return {
    ...analysis,
    insights: [...analysis.insights].sort((a, b) => rank(a.kind) - rank(b.kind)),
  };
}
