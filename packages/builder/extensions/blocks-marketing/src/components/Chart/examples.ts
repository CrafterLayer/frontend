import type { JsonValue } from '@craftkit/builder-schema';

export const chartExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'monthly revenue bar chart',
    node: {
      type: 'chart',
      props: {
        title: 'Monthly revenue',
        description: 'Revenue grew every month of the first half, led by renewals in May and June.',
        chartType: 'bar',
        categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        series: [{ name: 'Revenue', values: [18400, 21250, 23900, 22700, 27800, 31600] }],
        valuePrefix: '$',
        showValues: true,
        showGrid: true,
        palette: 'accent',
        height: 'md',
        variant: 'card',
        width: 'standard',
      },
    },
  },
  {
    prompt: 'a line chart comparing website visitors and sign-ups over the year',
    node: {
      type: 'chart',
      props: {
        title: 'Visitors and sign-ups',
        chartType: 'line',
        categories: ['Q1', 'Q2', 'Q3', 'Q4'],
        series: [
          { name: 'Visitors', values: [12000, 15800, 17400, 21900] },
          { name: 'Sign-ups', values: [2100, 3400, 4100, 5600] },
        ],
        showLegend: true,
        palette: 'mixed',
        height: 'sm',
      },
    },
  },
  {
    prompt: 'a stacked area chart of traffic by source',
    node: {
      type: 'chart',
      props: {
        title: 'Traffic by source',
        chartType: 'area',
        stacked: true,
        categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        series: [
          { name: 'Search', values: [820, 910, 880, 960, 1010, 640, 590] },
          { name: 'Social', values: [410, 380, 450, 520, 610, 720, 690] },
          { name: 'Direct', values: [260, 300, 280, 310, 330, 210, 190] },
        ],
        palette: 'mixed',
        height: 'lg',
        width: 'wide',
      },
    },
  },
  {
    prompt: 'مخطط دائري لتوزيع الميزانية',
    node: {
      type: 'chart',
      props: {
        title: 'توزيع الميزانية',
        description: 'حصة كل بند من ميزانية المشروع السنوية بآلاف الريالات.',
        chartType: 'donut',
        categories: ['التسويق', 'التطوير', 'التشغيل', 'الدعم', 'أخرى'],
        series: [{ name: 'المبلغ', values: [420, 360, 216, 144, 60] }],
        valueSuffix: ' ألف ر.س',
        showLegend: true,
        showValues: true,
        otherLabel: 'أخرى',
        palette: 'mixed',
        height: 'md',
        tone: 'light',
      },
    },
  },
];
