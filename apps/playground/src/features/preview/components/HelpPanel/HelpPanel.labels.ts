/** One getting-started step: what to do, and how. */
export interface HelpStep {
  readonly title: string;
  readonly body: string;
}

/** Every string the Help destination shows, in the editor's language. */
export interface HelpPanelLabels {
  readonly title: string;
  readonly intro: string;
  readonly stepsHeading: string;
  readonly steps: readonly HelpStep[];
  readonly shortcutsHeading: string;
  readonly keyboardShortcuts: string;
  readonly searchAndCommands: string;
}

export const HELP_PANEL_LABELS_EN: HelpPanelLabels = {
  title: 'Help',
  intro: 'New here? Four steps take you from an empty page to a published site.',
  stepsHeading: 'Get started',
  steps: [
    {
      title: 'Add blocks',
      body: 'Open Blocks in the rail, then click a block to insert it or drag it onto the page.',
    },
    {
      title: 'Select and edit',
      body: 'Click anything on the page. Its settings open in the Inspector.',
    },
    {
      title: 'Arrange',
      body: 'Open Layers to reach nested items and drag them into a new order.',
    },
    {
      title: 'Preview and publish',
      body: 'Check each device in Preview, then choose Publish site.',
    },
  ],
  shortcutsHeading: 'Work faster',
  keyboardShortcuts: 'Keyboard shortcuts',
  searchAndCommands: 'Search and commands',
};

export const HELP_PANEL_LABELS_AR: HelpPanelLabels = {
  title: 'المساعدة',
  intro: 'جديد هنا؟ أربع خطوات تنقلك من صفحة فارغة إلى موقع منشور.',
  stepsHeading: 'ابدأ من هنا',
  steps: [
    {
      title: 'أضف الكتل',
      body: 'افتح «الكتل» من الشريط الجانبي، ثم انقر كتلة لإدراجها أو اسحبها إلى الصفحة.',
    },
    {
      title: 'حدّد وعدّل',
      body: 'انقر أي عنصر في الصفحة، فتُفتح إعداداته في لوحة الخصائص.',
    },
    {
      title: 'رتّب',
      body: 'افتح «الطبقات» للوصول إلى العناصر المتداخلة وسحبها إلى ترتيب جديد.',
    },
    {
      title: 'عاين وانشر',
      body: 'تحقّق من كل جهاز في «معاينة»، ثم اختر «نشر الموقع».',
    },
  ],
  shortcutsHeading: 'اعمل أسرع',
  keyboardShortcuts: 'اختصارات لوحة المفاتيح',
  searchAndCommands: 'البحث والأوامر',
};

export function helpPanelLabels(locale: 'en' | 'ar'): HelpPanelLabels {
  return locale === 'ar' ? HELP_PANEL_LABELS_AR : HELP_PANEL_LABELS_EN;
}
