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
];
