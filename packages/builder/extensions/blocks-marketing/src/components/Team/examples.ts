import type { JsonValue } from '@craftkit/builder-schema';

export const teamExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'a polished leadership team section for a technology company',
    node: {
      type: 'team',
      props: {
        eyebrow: 'Leadership',
        heading: 'Built by people who care about the details',
        body: 'A multidisciplinary team turning complex systems into products people trust.',
        variant: 'cards',
        columns: '3',
        align: 'start',
        tone: 'light',
        spacing: 'lg',
        width: 'wide',
        profileLabel: 'Meet',
        members: [
          {
            name: 'Maya Chen',
            role: 'Chief Executive Officer',
            bio: 'Product strategist with a decade of experience building category-defining tools.',
            profileHref: '/team/maya-chen',
          },
          {
            name: 'Omar Haddad',
            role: 'VP of Engineering',
            bio: 'Engineering leader focused on dependable platforms and unusually good developer experience.',
          },
          {
            name: 'Lina Faris',
            role: 'Design Director',
            bio: 'Designs clear, humane experiences for ambitious products and global teams.',
          },
        ],
      },
    },
  },
  {
    prompt: 'قسم فريق عربي احترافي بتصميم تحريري',
    node: {
      type: 'team',
      props: {
        eyebrow: 'فريق القيادة',
        heading: 'خبرات متنوعة، ورؤية واحدة',
        body: 'نعمل معًا لبناء منتجات رقمية موثوقة تصنع فرقًا حقيقيًا.',
        variant: 'editorial',
        columns: '2',
        align: 'start',
        tone: 'transparent',
        spacing: 'lg',
        width: 'wide',
        profileLabel: 'اعرف المزيد عن',
        members: [
          {
            name: 'ليان خليل',
            role: 'المديرة التنفيذية',
            bio: 'تقود الاستراتيجية والنمو بشغف للمنتجات البسيطة.',
          },
          {
            name: 'أمير شاهين',
            role: 'مدير التقنية',
            bio: 'يبني أنظمة سريعة وقابلة للتوسع من اليوم الأول.',
          },
        ],
      },
    },
  },
];
