import type { JsonValue } from '@craftkit/builder-schema';

export const reportExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'a monthly sales report with KPIs, a chart and the table',
    node: {
      type: 'report',
      props: {
        title: 'Sales rose for the third month running',
        summary:
          'June revenue reached $31.6k, up 14% on May, while refunds fell. Figures from the shop dashboard.',
        categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        series: [
          { name: 'Revenue', values: [18400, 21250, 23900, 22700, 27800, 31600] },
          { name: 'Refunds', values: [900, 1100, 950, 1200, 1000, 820] },
        ],
        valuePrefix: '$',
        kpis: [
          { label: 'Revenue in June', series: 0, measure: 'last', better: 'up' },
          { label: 'Refunds in June', series: 1, measure: 'last', better: 'down' },
          { label: 'Revenue this half', series: 0, measure: 'total' },
        ],
        chartType: 'combo',
        palette: 'mixed',
        width: 'wide',
      },
    },
  },
  {
    prompt: 'تقرير ربع سنوي للحجوزات مع مؤشرات وجدول',
    node: {
      type: 'report',
      props: {
        title: 'الحجوزات تضاعفت خلال العام',
        summary: 'ارتفعت الحجوزات في الربع الرابع إلى ٢٤٠ حجزًا، والإلغاءات انخفضت.',
        categories: ['الربع الأول', 'الربع الثاني', 'الربع الثالث', 'الربع الرابع'],
        series: [
          { name: 'الحجوزات', values: [120, 150, 190, 240] },
          { name: 'الإلغاءات', values: [18, 15, 16, 12] },
        ],
        kpis: [
          { label: 'حجوزات الربع الرابع', series: 0, measure: 'last', better: 'up' },
          { label: 'الإلغاءات', series: 1, measure: 'last', better: 'down' },
          { label: 'متوسط الحجوزات', series: 0, measure: 'average' },
        ],
        changeLabel: 'عن الربع السابق',
        chartType: 'line',
        palette: 'accent',
        tone: 'light',
      },
    },
  },
  {
    prompt: 'conversion funnel report without a table',
    node: {
      type: 'report',
      props: {
        title: 'Most trials that start, convert',
        categories: ['Visitors', 'Sign-ups', 'Trials', 'Paying customers'],
        series: [{ name: 'People', values: [12000, 3100, 1400, 600] }],
        kpis: [
          { label: 'Visitors', series: 0, measure: 'max' },
          { label: 'Paying customers', series: 0, measure: 'min' },
        ],
        chartType: 'funnel',
        showTable: false,
        variant: 'plain',
      },
    },
  },
];
