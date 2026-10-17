import type { JsonValue } from '@craftkit/builder-schema';

export const logoCloudExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'premium logo cloud for a B2B product using text-only customer marks',
    node: {
      type: 'logoCloud',
      props: {
        eyebrow: 'Chosen by category leaders',
        heading: 'Infrastructure trusted from first prototype to global rollout',
        body: 'Independent teams and global operators rely on the same dependable foundation.',
        variant: 'cards',
        columns: '5',
        align: 'center',
        tone: 'light',
        spacing: 'lg',
        width: 'wide',
        items: [
          { name: 'Northstar', descriptor: 'Data cloud' },
          { name: 'Fieldwork', descriptor: 'Operations' },
          { name: 'Meridian', descriptor: 'Commerce' },
          { name: 'Arcform', descriptor: 'Infrastructure' },
          { name: 'Canopy', descriptor: 'Collaboration' },
        ],
      },
    },
  },
  {
    prompt: 'شعارات نصية عربية لشركاء منصة تقنية',
    node: {
      type: 'logoCloud',
      props: {
        eyebrow: 'شركاء النجاح',
        heading: 'تثق بنا فرق تصنع تجربة رقمية أفضل',
        variant: 'minimal',
        columns: '4',
        align: 'center',
        tone: 'transparent',
        spacing: 'md',
        width: 'standard',
        items: [
          { name: 'مدار', descriptor: 'تقنية مالية' },
          { name: 'سحابة', descriptor: 'بنية تحتية' },
          { name: 'نواة', descriptor: 'منتجات رقمية' },
          { name: 'أفق', descriptor: 'تجارة إلكترونية' },
        ],
      },
    },
  },
];
