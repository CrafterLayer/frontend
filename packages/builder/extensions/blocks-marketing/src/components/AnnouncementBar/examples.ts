import type { JsonValue } from '@craftkit/builder-schema';

export const announcementBarExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'a polished product launch announcement with a release link',
    node: {
      type: 'announcementBar',
      props: {
        label: 'Just shipped',
        message: 'CraftKit Studio 2.0 turns rough ideas into production-ready pages.',
        linkLabel: 'See what is new',
        href: '#release-notes',
        emphasis: 'accent',
        layout: 'split',
        density: 'regular',
        align: 'start',
        tone: 'transparent',
        spacing: 'none',
        width: 'wide',
      },
    },
  },
  {
    prompt: 'شريط إعلان عربي أنيق لعرض محدود',
    node: {
      type: 'announcementBar',
      props: {
        label: 'لفترة محدودة',
        message: 'احصل على استشارة إطلاق مجانية مع كل باقة سنوية.',
        linkLabel: 'احجز استشارتك',
        href: '#consultation',
        emphasis: 'inverse',
        layout: 'inline',
        density: 'compact',
        align: 'center',
        tone: 'dark',
        spacing: 'none',
        width: 'standard',
      },
    },
  },
];
