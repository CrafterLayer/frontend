import type { JsonValue } from '@craftkit/builder-schema';

export const jobsListExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'a careers section listing our open roles with team, location and an apply link',
    node: {
      type: 'jobsList',
      props: {
        eyebrow: 'Careers',
        heading: 'Build the next chapter with us',
        body: 'Small teams, real ownership, and a four-day office week.',
        jobs: [
          {
            title: 'Senior Product Designer',
            team: 'Design',
            location: 'Riyadh',
            type: 'Full-time',
            href: '/careers/product-designer',
          },
          {
            title: 'Backend Engineer (Go)',
            team: 'Engineering',
            location: 'Remote — GCC',
            type: 'Full-time',
            href: '/careers/backend-engineer',
          },
          {
            title: 'Customer Success Lead',
            team: 'Operations',
            location: 'Dubai',
            type: 'Full-time',
            href: '/careers/customer-success',
          },
          {
            title: 'Growth Marketing Intern',
            team: 'Marketing',
            location: 'Riyadh',
            type: 'Internship',
            href: '/careers/marketing-intern',
          },
        ],
        applyLabel: 'View role',
        actionLabel: 'Send an open application',
        actionHref: 'mailto:careers@example.com',
        layout: 'rows',
      },
    },
  },
  {
    prompt: 'قسم الوظائف الشاغرة لدينا',
    node: {
      type: 'jobsList',
      props: {
        eyebrow: 'انضم إلينا',
        heading: 'الوظائف المتاحة',
        jobs: [
          {
            title: 'محاسب أول',
            team: 'المالية',
            location: 'جدة',
            type: 'دوام كامل',
            href: '/careers/accountant',
          },
          {
            title: 'أخصائي تسويق رقمي',
            team: 'التسويق',
            location: 'الرياض',
            type: 'دوام كامل',
            href: '/careers/marketing',
          },
          { title: 'مندوب مبيعات', location: 'الدمام', type: 'دوام جزئي', href: '/careers/sales' },
        ],
        applyLabel: 'قدّم الآن',
        layout: 'cards',
        tone: 'light',
      },
    },
  },
  {
    prompt: 'careers section for when no roles are open, inviting general applications',
    node: {
      type: 'jobsList',
      props: {
        heading: 'Careers',
        jobs: [],
        emptyMessage: 'Nothing open right now — but we read every open application.',
        actionLabel: 'Introduce yourself',
        actionHref: 'mailto:jobs@example.com',
        width: 'standard',
      },
    },
  },
];
