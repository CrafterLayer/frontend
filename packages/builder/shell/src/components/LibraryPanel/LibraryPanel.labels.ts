import { PALETTE_LABELS_AR, PALETTE_LABELS_EN, type PaletteLabels } from '../Palette/Palette.labels';

/** Every user-facing string of the Library panel; the host picks one set by locale. */
export interface LibraryPanelLabels {
  readonly language: 'en' | 'ar';
  readonly title: string;
  readonly tabs: {
    readonly elements: string;
    readonly sections: string;
    readonly blocks: string;
    readonly saved: string;
    // library-playground additions (2026-10-08): the top-level Templates tab (absent ⇒ by language).
    readonly templates?: string | undefined;
    // end library-playground additions
  };
  readonly search: string;
  readonly noResults: string;
  readonly noSections: string;
  readonly noSaved: string;
  readonly insertHint: string;
  readonly inserted: (name: string) => string;
  readonly cannotInsert: (name: string) => string;
  readonly noRegionType: string;
  /** The accessible name of a tile: "Insert Heading". */
  readonly insert: (name: string) => string;
  readonly savedKinds: { readonly element: string; readonly section: string };
  readonly removeTemplate: (name: string) => string;
  /** The Blocks tab's composed palette (its tabs, search, groups and names). */
  readonly palette: PaletteLabels;
  // library-playground additions (2026-10-08)
  /** The heading over template cards in another language than the page's. */
  readonly otherLanguage?: string | undefined;
  /** The Templates tab when nothing is registered. */
  readonly noTemplates?: string | undefined;
  // end library-playground additions
}

export const LIBRARY_PANEL_LABELS_EN: LibraryPanelLabels = {
  language: 'en',
  title: 'Library',
  tabs: {
    elements: 'Elements',
    sections: 'Sections',
    blocks: 'Blocks',
    saved: 'Saved',
    templates: 'Templates', // library-playground additions (2026-10-08)
  },
  search: 'Search the library',
  noResults: 'Nothing matches. Try another word.',
  noSections: 'No sections are available for this site yet.',
  noSaved: 'Nothing saved yet. Right-click an element in Layers and choose “Save as template”.',
  insertHint: 'Click to insert at the selection, or drag onto the page.',
  inserted: (name) => `Inserted ${name}`,
  cannotInsert: (name) => `${name} cannot be inserted here`,
  noRegionType: 'This editor has no custom section block to insert into',
  insert: (name) => `Insert ${name}`,
  savedKinds: { element: 'Element', section: 'Section' },
  removeTemplate: (name) => `Remove ${name} from Saved`,
  palette: PALETTE_LABELS_EN,
  // library-playground additions (2026-10-08)
  otherLanguage: 'Other language',
  noTemplates: 'No page templates are registered for this site yet.',
  // end library-playground additions
};

export const LIBRARY_PANEL_LABELS_AR: LibraryPanelLabels = {
  language: 'ar',
  title: 'المكتبة',
  tabs: {
    elements: 'العناصر',
    sections: 'الأقسام',
    blocks: 'الكتل',
    saved: 'المحفوظة',
    templates: 'القوالب', // library-playground additions (2026-10-08)
  },
  search: 'ابحث في المكتبة',
  noResults: 'لا نتائج. جرّب كلمة أخرى.',
  noSections: 'لا أقسام متاحة لهذا الموقع بعد.',
  noSaved: 'لا شيء محفوظ بعد. انقر بالزر الأيمن على عنصر في الطبقات واختر «حفظ كقالب».',
  insertHint: 'انقر للإدراج عند التحديد، أو اسحب إلى الصفحة.',
  inserted: (name) => `أُدرج ${name}`,
  cannotInsert: (name) => `لا يمكن إدراج ${name} هنا`,
  noRegionType: 'لا يحوي هذا المحرّر كتلة قسم مخصّص للإدراج فيها',
  insert: (name) => `إدراج ${name}`,
  savedKinds: { element: 'عنصر', section: 'قسم' },
  removeTemplate: (name) => `إزالة ${name} من المحفوظة`,
  palette: PALETTE_LABELS_AR,
  // library-playground additions (2026-10-08)
  otherLanguage: 'لغة أخرى',
  noTemplates: 'لا قوالب صفحات مسجّلة لهذا الموقع بعد.',
  // end library-playground additions
};
