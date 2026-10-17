export interface IconBrowserLabels {
  readonly title: string;
  readonly search: string;
  readonly set: string;
  readonly sets: Readonly<Record<'all' | 'lucide' | 'tabler' | 'tabler-filled', string>>;
  readonly results: string;
  readonly none: (query: string) => string;
  readonly more: (shown: number) => string;
  /** The accessible name of one icon button. */
  readonly icon: (name: string) => string;
}

export const ICON_BROWSER_LABELS_EN: IconBrowserLabels = {
  title: 'Icons',
  search: 'Search icons',
  set: 'Icon set',
  sets: { all: 'All', lucide: 'Lucide', tabler: 'Tabler', 'tabler-filled': 'Tabler filled' },
  results: 'Icons',
  none: (query) => `No icon matches “${query}”.`,
  more: (shown) => `Showing the first ${String(shown)}. Type to narrow the list.`,
  icon: (name) => name,
};

export const ICON_BROWSER_LABELS_AR: IconBrowserLabels = {
  title: 'الأيقونات',
  search: 'ابحث عن أيقونة (بالإنجليزية)',
  set: 'مجموعة الأيقونات',
  sets: { all: 'الكل', lucide: 'Lucide', tabler: 'Tabler', 'tabler-filled': 'Tabler معبأة' },
  results: 'الأيقونات',
  none: (query) => `لا توجد أيقونة تطابق «${query}».`,
  more: (shown) => `تُعرض أول ${String(shown)}. اكتب لتضييق القائمة.`,
  icon: (name) => name,
};
