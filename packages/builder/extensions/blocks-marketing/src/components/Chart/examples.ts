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
  {
    prompt: 'horizontal bar chart of survey answers with long labels',
    node: {
      type: 'chart',
      props: {
        title: 'Most customers book for the location',
        chartType: 'hbar',
        categories: [
          'Close to home or work',
          'Recommended by a friend',
          'Online reviews and ratings',
          'Price compared with others',
        ],
        series: [{ name: 'Share of answers', values: [41, 27, 19, 13] }],
        valueSuffix: '%',
        showValues: true,
        showGrid: false,
      },
    },
  },
  {
    prompt: 'combo chart: monthly orders as bars and returns as a line',
    node: {
      type: 'chart',
      props: {
        title: 'Orders grew while returns stayed flat',
        chartType: 'combo',
        categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        series: [
          { name: 'Orders', values: [320, 360, 410, 455, 490, 540] },
          { name: 'Returns', values: [40, 42, 39, 44, 41, 43] },
        ],
        palette: 'mixed',
      },
    },
  },
  {
    prompt: 'scatter plot of ad spend against revenue',
    node: {
      type: 'chart',
      props: {
        title: 'Revenue rises with ad spend',
        description: 'Each point is one campaign; the x axis is its spend in dollars.',
        chartType: 'scatter',
        categories: ['500', '800', '1200', '1500', '2100', '2600', '3000'],
        series: [{ name: 'Revenue', values: [2100, 2900, 4300, 4800, 6900, 7400, 8800] }],
        valuePrefix: '$',
      },
    },
  },
  {
    prompt: 'مخطط راداري يقارن منتجنا بالمنافس',
    node: {
      type: 'chart',
      props: {
        title: 'منتجنا يتفوق في الدعم والضمان',
        chartType: 'radar',
        categories: ['السعر', 'الجودة', 'الدعم', 'السرعة', 'التصميم', 'الضمان'],
        series: [
          { name: 'منتجنا', values: [7, 8, 9, 7, 8, 9] },
          { name: 'المنافس', values: [8, 7, 5, 8, 7, 6] },
        ],
        maxValue: 10,
        palette: 'mixed',
      },
    },
  },
  {
    prompt: 'sales funnel from visitors to paying customers',
    node: {
      type: 'chart',
      props: {
        title: 'One in twenty visitors becomes a customer',
        chartType: 'funnel',
        categories: ['Visitors', 'Sign-ups', 'Trials', 'Paying customers'],
        series: [{ name: 'People', values: [12000, 3100, 1400, 600] }],
      },
    },
  },
  {
    prompt: 'مؤشر رضا العملاء مقابل الهدف',
    node: {
      type: 'chart',
      props: {
        title: 'رضا العملاء هذا الربع',
        chartType: 'gauge',
        categories: ['رضا العملاء'],
        series: [{ name: 'النتيجة', values: [86] }],
        maxValue: 100,
        targetValue: 90,
        targetLabel: 'الهدف',
        valueSuffix: '%',
        palette: 'success',
      },
    },
  },
  {
    prompt: 'خطوط اتجاه مصغرة للمبيعات والزيارات خلال الأسبوع',
    node: {
      type: 'chart',
      props: {
        title: 'اتجاه الأسبوع',
        chartType: 'sparkline',
        categories: ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'],
        series: [
          { name: 'المبيعات', values: [42, 45, 51, 49, 58, 63, 70] },
          { name: 'الزيارات', values: [900, 870, 950, 1010, 980, 1100, 1240] },
        ],
        height: 'sm',
        palette: 'mixed',
      },
    },
  },
];
