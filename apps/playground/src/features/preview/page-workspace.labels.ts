import { AR_PAGES, AR_SHARED_SOURCES, arabicCount } from './arabic-count';
import {
  PAGE_ACTIONS_MENU_LABELS_AR,
  PAGE_ACTIONS_MENU_LABELS_EN,
  type PageActionsMenuLabels,
} from './components/PageActionsMenu';
import { SITE_MAP_LABELS_AR, SITE_MAP_LABELS_EN, type SiteMapLabels } from './components/SiteMap';

/**
 * Every string the page workspace shows or announces, with the sets of the two
 * surfaces it composes (site map, page actions), so a host passes ONE object.
 * The host picks EN or AR by editor locale; page titles and routes are data.
 */
export interface PageWorkspaceLabels {
  readonly region: string;
  readonly title: string;
  /** "3 pages · one shared history". */
  readonly summary: (pageCount: number) => string;
  readonly addPage: string;
  readonly viewGroup: string;
  readonly listView: string;
  readonly mapView: string;
  readonly pageList: string;
  readonly home: string;
  readonly privatePage: string;
  readonly sharedCount: (count: number) => string;
  /** The title a newly added page starts with ("Page 3"). */
  readonly newPageTitle: (number: string) => string;
  readonly refused: string;
  readonly added: string;
  readonly duplicated: (title: string) => string;
  readonly movedUp: (title: string) => string;
  readonly movedDown: (title: string) => string;
  readonly madeHome: (title: string) => string;
  readonly cleared: (title: string) => string;
  readonly deleted: (title: string) => string;
  readonly moved: (title: string) => string;
  readonly pageGone: string;
  readonly upToDate: string;
  readonly saved: (title: string) => string;
  readonly settingsFor: (title: string) => string;
  readonly settingsTitle: string;
  readonly settingsIntro: string;
  readonly close: string;
  readonly pageTitle: string;
  readonly route: string;
  readonly purpose: string;
  readonly audience: string;
  readonly seoLegend: string;
  readonly seoTitle: string;
  readonly seoDescription: string;
  readonly seoImage: string;
  readonly noIndex: string;
  readonly socialTitle: string;
  readonly socialNote: string;
  readonly seoUnavailable: string;
  readonly direction: string;
  readonly ltr: string;
  readonly rtl: string;
  readonly save: string;
  readonly siteMap: SiteMapLabels;
  readonly pageActions: PageActionsMenuLabels;
}

export const PAGE_WORKSPACE_LABELS_EN: PageWorkspaceLabels = {
  region: 'Page workspace',
  title: 'Pages',
  summary: (pageCount) =>
    `${String(pageCount)} page${pageCount === 1 ? '' : 's'} · one shared history`,
  addPage: 'Add page',
  viewGroup: 'Page view',
  listView: 'List',
  mapView: 'Sitemap',
  pageList: 'Site pages',
  home: 'Home',
  privatePage: 'Private page',
  sharedCount: (count) => `${String(count)} shared`,
  newPageTitle: (number) => `Page ${number}`.trim(),
  refused: 'That page change was refused.',
  added: 'Added a page.',
  duplicated: (title) => `Duplicated ${title}.`,
  movedUp: (title) => `Moved ${title} up.`,
  movedDown: (title) => `Moved ${title} down.`,
  madeHome: (title) => `${title} is now home.`,
  cleared: (title) => `Cleared ${title}.`,
  deleted: (title) => `Deleted ${title}.`,
  moved: (title) => `Moved ${title}.`,
  pageGone: 'That page no longer exists. Reopen its settings.',
  upToDate: 'Page settings are already up to date.',
  saved: (title) => `Saved ${title}. One undo restores every field.`,
  settingsFor: (title) => `Settings for ${title}`,
  settingsTitle: 'Page settings',
  settingsIntro: 'Route, search metadata, sharing, and content direction.',
  close: 'Close',
  pageTitle: 'Page title',
  route: 'Route',
  purpose: 'Purpose',
  audience: 'Audience',
  seoLegend: 'SEO and sharing',
  seoTitle: 'SEO title',
  seoDescription: 'SEO description',
  seoImage: 'SEO and share image',
  noIndex: 'Hide from search engines',
  socialTitle: 'Social title',
  socialNote:
    'Social title follows the stored SEO title. Separate Open Graph fields are not available in the current project schema.',
  seoUnavailable:
    'Stored SEO fields are available for authored code pages. This page keeps its purpose and audience without claiming separate SEO storage.',
  direction: 'Site content direction',
  ltr: 'Left to right',
  rtl: 'Right to left',
  save: 'Save page settings',
  siteMap: SITE_MAP_LABELS_EN,
  pageActions: PAGE_ACTIONS_MENU_LABELS_EN,
};

export const PAGE_WORKSPACE_LABELS_AR: PageWorkspaceLabels = {
  region: 'مساحة عمل الصفحات',
  title: 'الصفحات',
  summary: (pageCount) => `${arabicCount(pageCount, AR_PAGES)} · سجل تغييرات واحد مشترك`,
  addPage: 'إضافة صفحة',
  viewGroup: 'طريقة عرض الصفحات',
  listView: 'قائمة',
  mapView: 'خريطة الموقع',
  pageList: 'صفحات الموقع',
  home: 'الرئيسية',
  privatePage: 'محتوى خاص بالصفحة',
  sharedCount: (count) => arabicCount(count, AR_SHARED_SOURCES),
  newPageTitle: (number) => `صفحة ${number}`.trim(),
  refused: 'رُفض هذا التغيير على الصفحة.',
  added: 'أُضيفت صفحة.',
  duplicated: (title) => `أُنشئت نسخة من «${title}».`,
  movedUp: (title) => `نُقلت «${title}» لأعلى.`,
  movedDown: (title) => `نُقلت «${title}» لأسفل.`,
  madeHome: (title) => `أصبحت «${title}» الصفحة الرئيسية.`,
  cleared: (title) => `فُرّغت «${title}».`,
  deleted: (title) => `حُذفت «${title}».`,
  moved: (title) => `نُقلت «${title}».`,
  pageGone: 'لم تعد هذه الصفحة موجودة. يلزم فتح إعداداتها من جديد.',
  upToDate: 'إعدادات الصفحة محدّثة أصلًا.',
  saved: (title) => `حُفظت «${title}». تراجع واحد يعيد كل الحقول.`,
  settingsFor: (title) => `إعدادات ${title}`,
  settingsTitle: 'إعدادات الصفحة',
  settingsIntro: 'المسار، وبيانات البحث، والمشاركة، واتجاه المحتوى.',
  close: 'إغلاق',
  pageTitle: 'عنوان الصفحة',
  route: 'المسار',
  purpose: 'الغرض',
  audience: 'الجمهور',
  seoLegend: 'محركات البحث والمشاركة',
  seoTitle: 'العنوان في محركات البحث',
  seoDescription: 'الوصف في محركات البحث',
  seoImage: 'صورة البحث والمشاركة',
  noIndex: 'إخفاء الصفحة عن محركات البحث',
  socialTitle: 'العنوان عند المشاركة',
  socialNote:
    'يتبع العنوانُ عند المشاركة عنوانَ البحث المحفوظ. لا يتيح مخطط المشروع الحالي حقول مشاركة اجتماعية منفصلة.',
  seoUnavailable:
    'حقول البحث المحفوظة متاحة لصفحات الشيفرة المكتوبة. تحتفظ هذه الصفحة بغرضها وجمهورها دون ادّعاء تخزين منفصل لبيانات البحث.',
  direction: 'اتجاه محتوى الموقع',
  ltr: 'من اليسار إلى اليمين',
  rtl: 'من اليمين إلى اليسار',
  save: 'حفظ إعدادات الصفحة',
  siteMap: SITE_MAP_LABELS_AR,
  pageActions: PAGE_ACTIONS_MENU_LABELS_AR,
};
