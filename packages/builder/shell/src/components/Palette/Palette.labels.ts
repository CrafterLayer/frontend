import { BLOCK_NAMES_AR } from '../../i18n/block-names';

export type PaletteCategory = 'Layout' | 'Content' | 'Marketing' | 'Primary';

/** Every string the block palette shows or announces; the host picks EN or AR by locale. */
export interface PaletteLabels {
  readonly language: 'en' | 'ar';
  readonly palette: string;
  readonly tabs: string;
  readonly blocksTab: string;
  /** The Templates tab, with the registered count when there is one. */
  readonly templatesTab: (count: number) => string;
  readonly searchBlocks: string;
  readonly searchTemplates: string;
  readonly categories: Readonly<Record<PaletteCategory, string>>;
  readonly noTemplates: string;
  readonly noTemplateMatch: string;
  readonly noBlockMatch: string;
  readonly sections: (count: number) => string;
  /** The live region's name. */
  readonly status: string;
  readonly inserted: (name: string) => string;
  readonly noSlot: (name: string) => string;
  readonly insertedTemplate: (name: string) => string;
  readonly noTemplateSlot: (name: string) => string;
  /** Block names by `blockNameKey(type)`; absent ⇒ the English names. */
  readonly blockNames?: Readonly<Record<string, string>> | undefined;
}

export const PALETTE_LABELS_EN: PaletteLabels = {
  language: 'en',
  palette: 'Block palette',
  tabs: 'Palette content',
  blocksTab: 'Blocks',
  templatesTab: (count) => (count > 0 ? `Templates ${String(count)}` : 'Templates'),
  searchBlocks: 'Search blocks',
  searchTemplates: 'Search templates',
  categories: { Layout: 'Layout', Content: 'Content', Marketing: 'Marketing', Primary: 'Primary' },
  noTemplates: 'No templates are registered for this surface.',
  noTemplateMatch: 'No templates found. Try another name.',
  noBlockMatch: 'No blocks found. Try another block name.',
  sections: (count) => `${String(count)} responsive ${count === 1 ? 'section' : 'sections'}`,
  status: 'Palette',
  inserted: (name) => `Inserted ${name}`,
  noSlot: (name) => `No slot accepts ${name} here`,
  insertedTemplate: (name) => `Inserted template ${name}`,
  noTemplateSlot: (name) => `No slot accepts template ${name} here`,
};

/** Arabic plural for a count of sections, digits kept Latin. */
function sectionsAr(count: number): string {
  if (count === 1) return 'قسم متجاوب واحد';
  if (count === 2) return 'قسمان متجاوبان';
  if (count >= 3 && count <= 10) return `${String(count)} أقسام متجاوبة`;
  return `${String(count)} قسمًا متجاوبًا`;
}

export const PALETTE_LABELS_AR: PaletteLabels = {
  language: 'ar',
  palette: 'لوحة الكتل',
  tabs: 'محتوى لوحة الكتل',
  blocksTab: 'الكتل',
  templatesTab: (count) => (count > 0 ? `القوالب ${String(count)}` : 'القوالب'),
  searchBlocks: 'ابحث في الكتل',
  searchTemplates: 'ابحث في القوالب',
  categories: { Layout: 'التخطيط', Content: 'المحتوى', Marketing: 'التسويق', Primary: 'أساسية' },
  noTemplates: 'لا قوالب مسجّلة لهذا السطح.',
  noTemplateMatch: 'لا قوالب مطابقة. جرّب اسمًا آخر.',
  noBlockMatch: 'لا كتل مطابقة. جرّب اسمًا آخر.',
  sections: sectionsAr,
  status: 'لوحة الكتل',
  inserted: (name) => `أُدرج ${name}`,
  noSlot: (name) => `لا مكان يقبل ${name} هنا`,
  insertedTemplate: (name) => `أُدرج القالب ${name}`,
  noTemplateSlot: (name) => `لا مكان يقبل القالب ${name} هنا`,
  blockNames: BLOCK_NAMES_AR,
};
