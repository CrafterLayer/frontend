import { AR_PAGES, AR_SHARED_SOURCES, arabicCount } from '../../arabic-count';

/** Every string the site map shows or announces; the host picks EN or AR by editor locale. */
export interface SiteMapLabels {
  /** The region's accessible name (overridden by the `label` prop when given). */
  readonly region: string;
  readonly title: string;
  readonly empty: string;
  /** "3 pages · routes and shared sources". */
  readonly summary: (pageCount: number) => string;
  readonly pageList: string;
  readonly open: (title: string, address: string) => string;
  /** A provided or SEO thumbnail's alt text (an asset keeps its own alt). */
  readonly preview: (title: string) => string;
  readonly home: string;
  readonly sharedSources: (title: string) => string;
  readonly sharedCount: (count: number) => string;
  /** A shared region's kind, as the relationship list names it. */
  readonly regionKinds: Readonly<Record<'header' | 'footer', string>>;
  readonly privateContent: string;
  readonly moveBefore: (title: string) => string;
  readonly moveAfter: (title: string) => string;
}

export const SITE_MAP_LABELS_EN: SiteMapLabels = {
  region: 'Site map',
  title: 'Site map',
  empty: 'Add a page to see its route and relationships here.',
  summary: (pageCount) => `${String(pageCount)} pages · routes and shared sources`,
  pageList: 'Pages in route order',
  open: (title, address) => `Open ${title}, ${address}`,
  preview: (title) => `${title} preview`,
  home: 'Home',
  sharedSources: (title) => `${title} shared sources`,
  sharedCount: (count) => `${String(count)} shared source${count === 1 ? '' : 's'}`,
  regionKinds: { header: 'header', footer: 'footer' },
  privateContent: 'Page-private content',
  moveBefore: (title) => `Move ${title} before`,
  moveAfter: (title) => `Move ${title} after`,
};

export const SITE_MAP_LABELS_AR: SiteMapLabels = {
  region: 'خريطة الموقع',
  title: 'خريطة الموقع',
  empty: 'يظهر هنا مسار كل صفحة وعلاقاتها بعد إضافة صفحة.',
  summary: (pageCount) => `${arabicCount(pageCount, AR_PAGES)} · المسارات والمصادر المشتركة`,
  pageList: 'الصفحات بترتيب المسارات',
  open: (title, address) => `فتح ${title}، ${address}`,
  preview: (title) => `معاينة ${title}`,
  home: 'الرئيسية',
  sharedSources: (title) => `المصادر المشتركة في ${title}`,
  sharedCount: (count) => arabicCount(count, AR_SHARED_SOURCES),
  regionKinds: { header: 'الترويسة', footer: 'التذييل' },
  privateContent: 'محتوى خاص بالصفحة',
  moveBefore: (title) => `تقديم ${title}`,
  moveAfter: (title) => `تأخير ${title}`,
};
