/*
  ── What the chrome calls a registered block, per language ───────────────────

  A block's TYPE is a code name (`logoCloud`, `bento-grid`); the chrome shows a
  word. English humanises the type (`Logo Cloud`), which is why only the
  Arabic table exists: every type the shipped extensions register has a
  natural Modern Standard Arabic name here. Keys are normalised the way the
  palette normalises them — lower case, letters and digits only — so
  `bento-grid`, `bentoGrid` and `BentoGrid` all find the same entry.
*/

/** `bento-grid` / `bentoGrid` → `bentogrid`; a namespaced `ext:hero` keys by its leaf. */
export function blockNameKey(type: string): string {
  const leaf = type.split(/[:/]/u).at(-1) ?? type;
  return leaf.replace(/[^a-zA-Z0-9]/gu, '').toLowerCase();
}

export const BLOCK_NAMES_AR: Readonly<Record<string, string>> = {
  accordion: 'أقسام قابلة للطي',
  accordionitem: 'قسم قابل للطي',
  action: 'إجراء',
  announcement: 'إعلان',
  announcementbar: 'شريط إعلان',
  article: 'مقالة',
  aurorabackground: 'خلفية الشفق',
  avatargroup: 'مجموعة صور شخصية',
  badge: 'شارة',
  banner: 'لافتة',
  bentogrid: 'شبكة بينتو',
  bloggrid: 'شبكة المدونة',
  breadcrumbs: 'مسار التنقل',
  bulletlist: 'قائمة نقطية',
  button: 'زر',
  card: 'بطاقة',
  carousel: 'عارض شرائح',
  chart: 'مخطط بياني',
  checkbox: 'خانة اختيار',
  cloudshader: 'خلفية سحابية',
  columns: 'أعمدة',
  comparisontable: 'جدول مقارنة',
  contact: 'تواصل',
  container: 'حاوية',
  contentsection: 'قسم محتوى',
  countdown: 'عدّ تنازلي',
  cta: 'دعوة إلى إجراء',
  customcode: 'قسم مخصّص',
  customcodesymbol: 'رمز',
  dialog: 'نافذة حوار',
  divider: 'فاصل',
  dotpatternsurface: 'سطح منقّط',
  email: 'بريد إلكتروني',
  embed: 'تضمين',
  faq: 'الأسئلة الشائعة',
  feature: 'ميزة',
  features: 'المزايا',
  footer: 'تذييل',
  form: 'نموذج',
  formsection: 'قسم النموذج',
  gallery: 'معرض صور',
  grid: 'شبكة',
  heading: 'عنوان',
  hero: 'واجهة رئيسية',
  image: 'صورة',
  link: 'رابط',
  listitem: 'عنصر قائمة',
  location: 'الموقع والمواعيد',
  logocloud: 'شعارات العملاء',
  marquee: 'شريط متحرك',
  media: 'وسائط',
  menusection: 'قائمة الطعام والأسعار',
  navbar: 'شريط التنقل',
  navigation: 'التنقل',
  navlinks: 'روابط التنقل',
  newsletter: 'النشرة البريدية',
  page: 'الصفحة',
  pagefooter: 'تذييل الصفحة',
  pageheader: 'ترويسة الصفحة',
  pagination: 'ترقيم الصفحات',
  paragraph: 'فقرة',
  plan: 'باقة',
  portfoliogrid: 'معرض الأعمال',
  pricing: 'الأسعار',
  pricingplan: 'باقة سعرية',
  processsteps: 'خطوات العمل',
  productgrid: 'شبكة المنتجات',
  progress: 'شريط التقدم',
  promobanner: 'لافتة ترويجية',
  quote: 'اقتباس',
  report: 'تقرير',
  review: 'مراجعة',
  richtext: 'نص منسّق',
  row: 'صف',
  section: 'قسم',
  select: 'قائمة اختيار',
  separator: 'فاصل',
  shadcnalert: 'تنبيه',
  shimmerbutton: 'زر لامع',
  shineborder: 'إطار لامع',
  spacer: 'مسافة فارغة',
  spotlightsurface: 'سطح مُضاء',
  stack: 'حاوية مكدّسة',
  stats: 'إحصاءات',
  submit: 'زر إرسال',
  table: 'جدول',
  tabpanel: 'لوحة تبويب',
  tabs: 'تبويبات',
  team: 'الفريق',
  testimonial: 'شهادة',
  testimonials: 'شهادات العملاء',
  text: 'نص',
  textarea: 'منطقة نص',
  timeline: 'خط زمني',
  video: 'فيديو',
  videosection: 'قسم فيديو',
};

/** The localised name of a block type, or `undefined` when the table has none. */
export function localBlockName(
  type: string,
  names: Readonly<Record<string, string>> | undefined,
): string | undefined {
  return names?.[blockNameKey(type)];
}
