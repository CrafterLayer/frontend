import type { JsonValue } from '@craftkit/builder-schema';

export const advancedExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'waterfall of signed operating cash movements',
    node: {
      type: 'chart',
      props: {
        title: 'Operating cash movements',
        chartType: 'waterfall',
        categories: ['Opening', 'Sales', 'Payroll', 'Rent', 'Tax'],
        series: [{ name: 'Change', values: [50000, 42000, -28000, -8000, -5000] }],
        valuePrefix: '$',
        showValues: true,
        palette: 'mixed',
      },
    },
  },
  {
    prompt: 'خريطة حرارية لإنجاز الفريق خلال أسابيع المشروع',
    node: {
      type: 'chart',
      props: {
        title: 'إنجاز الفريق عبر الأسابيع',
        chartType: 'heatmap',
        categories: ['الأسبوع ١', 'الأسبوع ٢', 'الأسبوع ٣', 'الأسبوع ٤'],
        series: [
          { name: 'التصميم', values: [8, 12, 9, 14] },
          { name: 'التطوير', values: [15, 18, 21, 19] },
          { name: 'الجودة', values: [4, 9, 14, 18] },
        ],
        showValues: true,
        palette: 'success',
      },
    },
  },
  {
    prompt: 'treemap of revenue by product with flat nonnegative weights',
    node: {
      type: 'chart',
      props: {
        title: 'Revenue by product',
        chartType: 'treemap',
        categories: ['Enterprise', 'Team', 'Individual', 'Services'],
        series: [{ name: 'Revenue', values: [62000, 34000, 18000, 12000] }],
        valuePrefix: '$',
        palette: 'mixed',
      },
    },
  },
  {
    prompt: 'histogram of response-time observations already counted into equal-width bins',
    node: {
      type: 'chart',
      props: {
        title: 'Response time distribution',
        description: 'Response times in milliseconds; values are observation counts.',
        chartType: 'histogram',
        categories: ['0–100', '100–200', '200–300', '300–400', '400–500'],
        series: [{ name: 'Count', values: [8, 21, 34, 16, 4] }],
        showValues: true,
      },
    },
  },
  {
    prompt: 'bubble chart: campaign spend X, revenue Y, and conversions Size',
    node: {
      type: 'chart',
      props: {
        title: 'Campaign return and volume',
        description: 'X: spend in dollars. Y: revenue in dollars. Bubble area: conversions.',
        chartType: 'bubble',
        categories: ['500', '1200', '2400', '3200'],
        series: [
          { name: 'Revenue', values: [1900, 4800, 6900, 11200] },
          { name: 'Conversions', values: [12, 32, 48, 76] },
        ],
        valuePrefix: '$',
      },
    },
  },
  {
    prompt: 'boxplot of delivery times with five-number summaries by team',
    node: {
      type: 'chart',
      props: {
        title: 'Delivery time spread',
        chartType: 'boxplot',
        categories: ['Platform', 'Product', 'Support'],
        series: [
          { name: 'Min', values: [1, 2, 1] },
          { name: 'Q1', values: [3, 4, 2] },
          { name: 'Median', values: [5, 6, 3] },
          { name: 'Q3', values: [8, 9, 5] },
          { name: 'Max', values: [14, 16, 9] },
        ],
        valueSuffix: ' days',
        showValues: true,
      },
    },
  },
  {
    prompt: 'candlestick from daily Open High Low Close prices',
    node: {
      type: 'chart',
      props: {
        title: 'Daily price range',
        chartType: 'candlestick',
        categories: ['Oct 16', 'Oct 17', 'Oct 18', 'Oct 19'],
        series: [
          { name: 'Open', values: [100, 108, 104, 111] },
          { name: 'High', values: [112, 114, 116, 118] },
          { name: 'Low', values: [96, 101, 102, 106] },
          { name: 'Close', values: [108, 104, 111, 115] },
        ],
        valuePrefix: '$',
      },
    },
  },
  {
    prompt: 'مخطط مصاصة لصافي تغير العملاء حسب القناة',
    node: {
      type: 'chart',
      props: {
        title: 'صافي تغير العملاء',
        chartType: 'lollipop',
        categories: ['البحث', 'الإعلانات', 'الشركاء', 'مباشر'],
        series: [{ name: 'التغير', values: [48, -12, 27, 19] }],
        showValues: true,
      },
    },
  },
  {
    prompt: 'bullet charts of completed project milestones against targets',
    node: {
      type: 'chart',
      props: {
        title: 'Project delivery against target',
        chartType: 'bullet',
        categories: ['Design', 'Build', 'Quality'],
        series: [
          { name: 'Completed', values: [92, 74, 68] },
          { name: 'Goal', values: [90, 85, 80] },
        ],
        maxValue: 100,
        valueSuffix: '%',
        showValues: true,
        palette: 'success',
      },
    },
  },
];
