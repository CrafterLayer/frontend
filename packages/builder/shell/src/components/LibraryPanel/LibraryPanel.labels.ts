/** Every user-facing string of the Library panel; the host picks one set by locale. */
export interface LibraryPanelLabels {
  readonly language: 'en' | 'ar';
  readonly title: string;
  readonly tabs: {
    readonly elements: string;
    readonly sections: string;
    readonly blocks: string;
    readonly saved: string;
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
}

export const LIBRARY_PANEL_LABELS_EN: LibraryPanelLabels = {
  language: 'en',
  title: 'Library',
  tabs: { elements: 'Elements', sections: 'Sections', blocks: 'Blocks', saved: 'Saved' },
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
};

export const LIBRARY_PANEL_LABELS_AR: LibraryPanelLabels = {
  language: 'ar',
  title: 'المكتبة',
  tabs: { elements: 'العناصر', sections: 'الأقسام', blocks: 'الكتل', saved: 'المحفوظة' },
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
};
