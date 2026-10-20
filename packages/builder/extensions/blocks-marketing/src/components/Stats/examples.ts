import type { JsonValue } from '@craftkit/builder-schema';

export const statsExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'professional outcome metrics for a product design studio',
    node: {
      type: 'stats',
      props: {
        eyebrow: 'Evidence, not promises',
        heading: 'A launch system built around measurable momentum',
        body: 'A representative view across strategy, design, and implementation engagements.',
        variant: 'cards',
        columns: '4',
        headerLayout: 'split',
        align: 'start',
        tone: 'transparent',
        spacing: 'lg',
        width: 'wide',
        items: [
          { value: '31%', label: 'Shorter time to market', detail: 'Median improvement' },
          { value: '2.8×', label: 'More validated concepts', detail: 'Before development starts' },
          { value: '94', label: 'Average quality score', detail: 'Across launch reviews' },
          { value: '18', label: 'Markets supported', detail: 'Including RTL experiences' },
        ],
      },
    },
  },
  {
    prompt: 'إحصائيات عربية احترافية لمنصة أعمال',
    node: {
      type: 'stats',
      props: {
        eyebrow: 'أثر يمكن قياسه',
        heading: 'نتائج واضحة من أول أسبوع',
        body: 'أرقام حقيقية تساعد الفرق على اتخاذ قرار أفضل وبوقت أقصر.',
        variant: 'contrast',
        columns: '3',
        headerLayout: 'stacked',
        align: 'start',
        tone: 'light',
        spacing: 'lg',
        width: 'standard',
        items: [
          { value: '٤٢٪', label: 'تسليم أسرع', detail: 'من الفكرة إلى الإطلاق' },
          { value: '٣٫٤×', label: 'تجارب أكثر', detail: 'بدون زيادة وقت المراجعة' },
          { value: '٩٩٫٩٪', label: 'استقرار موثوق', detail: 'عبر الإصدارات المنشورة' },
        ],
      },
    },
  },
  {
    prompt: 'financial executive key stats with revenue growth and annual target progress',
    node: {
      type: 'stats',
      props: {
        eyebrow: 'Finance overview',
        heading: 'Revenue and operating discipline',
        body: 'Illustrative monthly figures. Replace with your reconciled source and reporting period.',
        columns: '3',
        items: [
          {
            value: '$120k',
            label: 'Monthly revenue',
            change: '+20% vs prior month',
            sentiment: 'positive',
            trend: [80, 95, 100, 120],
            progress: 80,
            progressLabel: '80% of the $150k monthly target',
            detail: 'Same currency and reporting scope',
          },
          {
            value: '$72k',
            label: 'Operating costs',
            change: '−10% vs prior month',
            sentiment: 'positive',
            trend: [65, 70, 80, 72],
            detail: 'Lower costs are favorable',
          },
          {
            value: '40%',
            label: 'Operating margin',
            change: '+20 percentage points',
            sentiment: 'positive',
            trend: [18.75, 26.32, 20, 40],
            detail: 'Profit divided by revenue',
          },
        ],
      },
    },
  },
  {
    prompt: 'project delivery key stats with milestone progress and cycle time',
    node: {
      type: 'stats',
      props: {
        eyebrow: 'Delivery review',
        heading: 'A clear view of the release',
        body: 'Illustrative sprint metrics with explicit delivery goals and the same observation window.',
        columns: '3',
        items: [
          {
            value: '18 / 24',
            label: 'Milestones completed',
            progress: 75,
            progressLabel: '75% of committed release scope',
            detail: 'Six milestones remain',
          },
          {
            value: '3.2 days',
            label: 'Median cycle time',
            change: '−0.8 days vs prior sprint',
            sentiment: 'positive',
            trend: [5, 4.4, 4, 3.2],
          },
          {
            value: '4',
            label: 'Open blockers',
            change: '+1 vs prior sprint',
            sentiment: 'negative',
            trend: [2, 3, 3, 4],
            detail: 'Requires an owner and next action',
          },
        ],
      },
    },
  },
  {
    prompt: 'مؤشرات تسويق عربية مع اتجاه التحويل وتقدم هدف العملاء المحتملين',
    node: {
      type: 'stats',
      props: {
        eyebrow: 'مراجعة التسويق',
        heading: 'جودة الزيارات والتحويل',
        body: 'بيانات توضيحية لأربعة أسابيع؛ استبدلها بالبيانات الفعلية ونفس تعريف التحويل.',
        columns: '3',
        items: [
          {
            value: '٤٫٨٪',
            label: 'معدل التحويل',
            change: '+٠٫٦ نقطة مئوية',
            sentiment: 'positive',
            trend: [3.8, 4, 4.2, 4.8],
            detail: 'التحويلات مقسومة على الجلسات',
          },
          {
            value: '٧٢٠',
            label: 'عملاء محتملون مؤهلون',
            progress: 90,
            progressLabel: '٩٠٪ من الهدف: ٨٠٠ عميل',
            trend: [420, 510, 600, 720],
          },
          {
            value: '١٨ ألف',
            label: 'جلسات مؤهلة',
            change: '+١٢٫٥٪ عن الفترة السابقة',
            sentiment: 'positive',
            trend: [12000, 14000, 16000, 18000],
          },
        ],
      },
    },
  },
];
