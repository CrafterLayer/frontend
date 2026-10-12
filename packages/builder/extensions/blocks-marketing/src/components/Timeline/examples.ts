import type { JsonValue } from '@craftkit/builder-schema';

export const timelineExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'a company history timeline from founding to today',
    node: {
      type: 'timeline',
      props: {
        eyebrow: 'Since 2012',
        heading: 'A decade of building with our customers',
        items: [
          {
            date: '2012',
            title: 'The first workshop',
            description: 'A rented room and three tables.',
            status: 'done',
          },
          {
            date: '2016',
            title: 'Our own building',
            description: 'Room for a showroom and a school.',
            status: 'done',
          },
          {
            date: '2020',
            title: 'Online orders',
            description: 'Delivery to every neighbourhood in the city.',
            status: 'done',
            badge: 'Turning point',
          },
          { date: '2025', title: 'Two hundred employees', status: 'done' },
        ],
        layout: 'alternating',
        align: 'center',
        width: 'wide',
      },
    },
  },
  {
    prompt: 'a product roadmap with shipped and upcoming quarters',
    node: {
      type: 'timeline',
      props: {
        heading: 'Roadmap',
        body: 'What we shipped and what comes next.',
        items: [
          { date: 'Q1 2026', title: 'Team workspaces', status: 'done' },
          { date: 'Q2 2026', title: 'Offline mode', status: 'done' },
          {
            date: 'Q4 2026',
            title: 'Public API',
            description: 'Read and write access for every plan.',
            status: 'upcoming',
            badge: 'Beta',
          },
          { date: '2027', title: 'Desktop apps', status: 'upcoming' },
        ],
        layout: 'vertical',
        width: 'standard',
      },
    },
  },
  {
    prompt: 'برنامج فعالية المؤتمر بالساعات',
    node: {
      type: 'timeline',
      props: {
        eyebrow: 'اليوم الأول',
        heading: 'برنامج المؤتمر',
        items: [
          { date: '٩:٠٠ ص', title: 'التسجيل والقهوة', status: 'done' },
          {
            date: '١٠:٠٠ ص',
            title: 'الكلمة الافتتاحية',
            description: 'رؤية القطاع للسنوات الخمس القادمة.',
            status: 'done',
          },
          {
            date: '١٢:٠٠ م',
            title: 'ورش العمل',
            description: 'ثلاث قاعات متوازية.',
            status: 'upcoming',
            badge: 'جديد',
          },
          { date: '٣:٠٠ م', title: 'جلسة الختام', status: 'upcoming' },
        ],
        doneLabel: 'انتهت',
        upcomingLabel: 'قادمة',
        layout: 'vertical',
        tone: 'light',
      },
    },
  },
];
