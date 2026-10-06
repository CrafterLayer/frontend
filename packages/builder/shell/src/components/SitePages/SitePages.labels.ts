/** Every string the site's page list shows or announces; the host picks EN or AR by locale. */
export interface SitePagesLabels {
  readonly nav: string;
  readonly title: string;
  readonly add: string;
  readonly empty: string;
  readonly list: string;
  readonly rename: (title: string) => string;
  readonly sharedRegions: (title: string) => string;
  readonly refused: string;
}

export const SITE_PAGES_LABELS_EN: SitePagesLabels = {
  nav: 'Pages',
  title: 'Pages',
  add: 'Add page',
  empty: 'This site has no pages yet.',
  list: 'Site pages',
  rename: (title) => `Rename ${title}`,
  sharedRegions: (title) => `Shared regions on ${title}`,
  refused: 'That change was refused.',
};

export const SITE_PAGES_LABELS_AR: SitePagesLabels = {
  nav: 'الصفحات',
  title: 'الصفحات',
  add: 'إضافة صفحة',
  empty: 'لا صفحات في هذا الموقع بعد.',
  list: 'صفحات الموقع',
  rename: (title) => `إعادة تسمية ${title}`,
  sharedRegions: (title) => `المناطق المشتركة في ${title}`,
  refused: 'رُفض هذا التغيير.',
};
