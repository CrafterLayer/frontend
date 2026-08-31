import type { JsonValue } from '@craftkit/builder-schema';

export const paginationExamples: { prompt: string; node: JsonValue }[] = [
  {
    prompt: 'full pagination for a twelve-page article archive',
    node: {
      type: 'pagination',
      props: {
        navigationLabel: 'Article archive pages',
        previousLabel: 'Previous',
        nextLabel: 'Next',
        pageLabel: 'Page',
        ellipsisLabel: 'More pages',
        mode: 'generated',
        currentPage: 5,
        pageCount: 12,
        siblingCount: 1,
        showFirstLast: true,
        pageHrefTemplate: '/insights?page={page}',
        variant: 'full',
        size: 'md',
        align: 'center',
        tone: 'surface',
      },
    },
  },
  {
    prompt: 'ترقيم صفحات عربي مختصر لنتائج البحث',
    node: {
      type: 'pagination',
      props: {
        navigationLabel: 'صفحات نتائج البحث',
        previousLabel: 'السابق',
        nextLabel: 'التالي',
        pageLabel: 'صفحة',
        ellipsisLabel: 'صفحات إضافية',
        mode: 'generated',
        currentPage: 3,
        pageCount: 9,
        siblingCount: 1,
        showFirstLast: true,
        pageHrefTemplate: '/search?page={page}',
        variant: 'compact',
        size: 'md',
        align: 'center',
        tone: 'inverse',
      },
    },
  },
  {
    prompt: 'explicit pagination items for a curated collection',
    node: {
      type: 'pagination',
      props: {
        navigationLabel: 'Collection navigation',
        mode: 'explicit',
        currentPage: 2,
        pageCount: 4,
        previousHref: '/collection/new',
        nextHref: '/collection/archive',
        items: [
          { label: 'New', href: '/collection/new' },
          { label: 'Popular', current: true },
          { label: 'Editors’ picks', href: '/collection/editors' },
          { label: 'Archive', href: '/collection/archive' },
        ],
        variant: 'full',
        size: 'sm',
        align: 'start',
        tone: 'transparent',
      },
    },
  },
];
