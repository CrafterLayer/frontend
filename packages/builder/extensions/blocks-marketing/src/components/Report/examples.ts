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
  {
    prompt: 'financial report with median monthly revenue, comparison baseline and goal',
    node: {
      type: 'report',
      props: {
        title: 'Finance review: revenue and costs',
        summary:
          'Illustrative four-month ledger in USD. Targets and comparison baselines are supplied by the finance team.',
        categories: ['Jan', 'Feb', 'Mar', 'Apr'],
        series: [
          {
            name: 'Revenue',
            values: [80000, 95000, 100000, 120000],
          },
          {
            name: 'Costs',
            values: [65000, 70000, 80000, 72000],
          },
        ],
        valuePrefix: '$',
        kpis: [
          {
            label: 'Latest revenue',
            series: 0,
            target: 100000,
            detail: 'Monthly minimum plan',
          },
          {
            label: 'Latest costs',
            series: 1,
            better: 'down',
            target: 75000,
            detail: 'Monthly spending ceiling',
          },
          {
            label: 'Median revenue',
            series: 0,
            measure: 'median',
            comparisonValue: 85000,
          },
          {
            label: 'Observed months',
            series: 0,
            measure: 'count',
          },
        ],
        showTrends: true,
        chartType: 'combo',
        palette: 'mixed',
        targetLabel: 'Plan',
        changeLabel: 'vs previous month',
        comparisonLabel: 'vs supplied baseline',
      },
    },
  },
  {
    prompt: 'project throughput report with delivery targets and weekly trends',
    node: {
      type: 'report',
      props: {
        title: 'Delivery throughput by sprint',
        summary:
          'Illustrative completed work items. Target applies to the latest sprint; the median describes all four sprints.',
        categories: ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4'],
        series: [
          {
            name: 'Completed tasks',
            values: [18, 24, 21, 30],
          },
        ],
        kpis: [
          {
            label: 'Latest delivery',
            target: 28,
            detail: 'Work items completed in sprint four',
          },
          {
            label: 'Typical sprint',
            measure: 'median',
          },
          {
            label: 'Total completed',
            measure: 'total',
          },
          {
            label: 'Sprints observed',
            measure: 'count',
            target: 4,
          },
        ],
        chartType: 'lollipop',
        showTrends: true,
        palette: 'accent',
      },
    },
  },
  {
    prompt: 'تقرير زيارات تسويقي عربي مع الوسيط والأهداف والاتجاهات',
    node: {
      type: 'report',
      props: {
        title: 'نمو الزيارات المؤهلة خلال الشهر',
        summary: 'أرقام توضيحية لأربعة أسابيع من نفس مصدر التحليلات؛ الهدف الأسبوعي هو ١٥٠٠ جلسة.',
        categories: ['الأسبوع ١', 'الأسبوع ٢', 'الأسبوع ٣', 'الأسبوع ٤'],
        series: [
          {
            name: 'الجلسات المؤهلة',
            values: [900, 1200, 1100, 1800],
          },
        ],
        kpis: [
          {
            label: 'آخر أسبوع',
            target: 1500,
            detail: 'جلسات تستوفي تعريف الزيارة المؤهلة',
          },
          {
            label: 'وسيط الزيارات',
            measure: 'median',
          },
          {
            label: 'إجمالي الزيارات',
            measure: 'total',
            comparisonValue: 4000,
          },
        ],
        chartType: 'area',
        showTrends: true,
        targetLabel: 'الهدف',
        changeLabel: 'عن الأسبوع السابق',
        comparisonLabel: 'مقارنة بالفترة المرجعية',
        tone: 'light',
      },
    },
  },
];
