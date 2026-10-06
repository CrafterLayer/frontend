import { editorCatalogue } from '@craftkit/builder';

/** The editor UI's language. The page's own language is the document's business. */
export type EditorLocale = 'en' | 'ar';

/** VITE_EDITOR_LOCALE=ar opens the editor chrome in Arabic; English otherwise (it is today's chrome). */
export function editorLocaleFromEnv(env: Readonly<Record<string, unknown>>): EditorLocale {
  const value = env['VITE_EDITOR_LOCALE'];
  return typeof value === 'string' && value.trim().toLowerCase() === 'ar' ? 'ar' : 'en';
}

/** Where this browser remembers the editor language a person chose in Settings. */
export const EDITOR_LOCALE_KEY = 'pg-editor-locale-v1';

/** The storage slice the language memory needs (window.localStorage in the app). */
export interface EditorLocaleStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * The language the editor opens in: the one this viewer chose last, else the
 * environment's. A private window or blocked storage throws; the env decides then.
 */
export function initialEditorLocale(
  env: Readonly<Record<string, unknown>>,
  store: () => EditorLocaleStore,
): EditorLocale {
  try {
    const stored = store().getItem(EDITOR_LOCALE_KEY);
    if (stored === 'ar' || stored === 'en') return stored;
  } catch {
    // No memory in this window; the environment's language applies.
  }
  return editorLocaleFromEnv(env);
}

/** Remembers the chosen language for the next visit; a window without storage forgets it. */
export function rememberEditorLocale(locale: EditorLocale, store: () => EditorLocaleStore): void {
  try {
    store().setItem(EDITOR_LOCALE_KEY, locale);
  } catch {
    // A private window forgets the choice; the switch still works for this session.
  }
}

/** The rail's destinations and utilities, by id. */
export type RailLabelId =
  | 'blocks'
  | 'pages'
  | 'layers'
  | 'assets'
  | 'design'
  | 'code'
  | 'assistant'
  | 'site'
  | 'history'
  | 'settings'
  | 'help';

/** The app's own chrome strings (top bar extras, zoom, device line, rail); EN is today's wording. */
export interface ChromeLabels {
  readonly editor: string;
  readonly workspaceView: string;
  readonly canvas: string;
  readonly sitemap: string;
  readonly publishSite: string;
  readonly panel: string;
  readonly togglePanel: string;
  readonly inspector: string;
  readonly toggleInspector: string;
  readonly zoom: string;
  readonly canvasZoom: string;
  readonly fit: string;
  readonly device: Readonly<Record<'base' | 'tablet' | 'mobile', string>>;
  /** "Desktop · 1280 px" — the device and its width, in Latin digits. */
  readonly deviceLine: (device: string, width: number) => string;
  readonly rail: Readonly<Record<RailLabelId, string>>;
  readonly railLabel: string;
  readonly editorLanguage: string;
  readonly restored: string;
  readonly startOver: string;
  readonly dismissRestored: string;
  readonly flipPreview: string;
  readonly previewClosed: string;
  readonly askAssistant: (name: string | undefined) => string;
  readonly saveTemplateLabel: (name: string) => string;
  readonly savedTemplate: (name: string) => string;
  readonly onlyTemplates: string;
  readonly symbolFallback: string;
  readonly makeSymbolLabel: (name: string) => string;
  readonly madeSymbol: (name: string) => string;
  readonly removeTemplateLabel: string;
  readonly converted: (label: string) => string;
  /** What each command reads as in the status bar's recent changes. */
  readonly changes: Readonly<Record<string, string>>;
}

const CHROME_LABELS_EN: ChromeLabels = {
  editor: 'Playground editor',
  workspaceView: 'Workspace view',
  canvas: 'Canvas',
  sitemap: 'Sitemap',
  publishSite: 'Publish site',
  panel: 'Panel',
  togglePanel: 'Toggle workspace panel',
  inspector: 'Inspector',
  toggleInspector: 'Toggle inspector',
  zoom: 'Zoom',
  canvasZoom: 'Canvas zoom',
  fit: 'Fit',
  device: { base: 'Desktop', tablet: 'Tablet', mobile: 'Mobile' },
  deviceLine: (device, width) => `${device} · ${String(width)} px`,
  rail: {
    blocks: 'Blocks',
    pages: 'Pages',
    layers: 'Layers',
    assets: 'Assets',
    design: 'Design',
    code: 'Code',
    assistant: 'Assistant',
    site: 'Site',
    history: 'History',
    settings: 'Settings',
    help: 'Help',
  },
  railLabel: 'Builder sections',
  editorLanguage: 'Editor language',
  restored: 'Picked up where you left off — this page came back from your last session.',
  startOver: 'Start over',
  dismissRestored: 'Dismiss restored notice',
  flipPreview: 'Flip direction (preview)',
  previewClosed: 'Preview closed — back to editing.',
  askAssistant: (name) => `Ask the assistant to change ${name ?? 'this element'}.`,
  saveTemplateLabel: (name) => `Save template · ${name}`,
  savedTemplate: (name) => `Saved “${name}” to the library.`,
  onlyTemplates: 'Only an element or a composed region can be saved as a template.',
  symbolFallback: 'Symbol',
  makeSymbolLabel: (name) => `Make symbol · ${name}`,
  madeSymbol: (name) => `“${name}” is now a symbol.`,
  removeTemplateLabel: 'Remove template',
  converted: (label) => `${label}: every part is now editable.`,
  changes: {
    insertNode: 'add block',
    removeNode: 'remove block',
    moveNode: 'move block',
    duplicateNode: 'duplicate block',
    setProp: 'edit property',
    setBinding: 'bind data',
    setResponsive: 'device override',
    setDocMeta: 'page settings',
    applyPatches: 'code edit',
    setSiteDirection: 'page direction',
    setDesignToken: 'design token',
    setDesignSystem: 'design system',
    setSharedRegion: 'header or footer',
    setPageRegions: 'page regions',
    registerAsset: 'add picture',
    updateAsset: 'edit picture',
    removeAsset: 'remove picture',
    setPaletteColor: 'palette colour',
    removePaletteColor: 'remove palette colour',
    setNamedStyle: 'named style',
    removeNamedStyle: 'remove named style',
    patchTreeNode: 'edit element',
    setTreeNode: 'edit element',
    insertTreeNode: 'add element',
    removeTreeNode: 'remove element',
    moveTreeNode: 'move element',
    duplicateTreeNode: 'duplicate element',
    wrapTreeNode: 'wrap element',
    unwrapTreeNode: 'unwrap element',
    formatTreeText: 'format text',
  },
};

const CHROME_LABELS_AR: ChromeLabels = {
  editor: 'محرر الصفحات',
  workspaceView: 'عرض مساحة العمل',
  canvas: 'اللوحة',
  sitemap: 'خريطة الموقع',
  publishSite: 'نشر الموقع',
  panel: 'اللوحة الجانبية',
  togglePanel: 'إظهار لوحة العمل أو إخفاؤها',
  inspector: 'الخصائص',
  toggleInspector: 'إظهار لوحة الخصائص أو إخفاؤها',
  zoom: 'التكبير',
  canvasZoom: 'تكبير اللوحة',
  fit: 'ملاءمة',
  device: { base: 'سطح المكتب', tablet: 'جهاز لوحي', mobile: 'جوال' },
  // The measure is isolated left-to-right, or RTL reorders it to "px 390".
  deviceLine: (device, width) => `${device} · \u2066${String(width)} px\u2069`,
  rail: {
    blocks: 'الكتل',
    pages: 'الصفحات',
    layers: 'الطبقات',
    assets: 'الوسائط',
    design: 'التصميم',
    code: 'الشيفرة',
    assistant: 'المساعد',
    site: 'الموقع',
    history: 'السجل',
    settings: 'الإعدادات',
    help: 'المساعدة',
  },
  railLabel: 'أقسام المحرر',
  editorLanguage: 'لغة المحرر',
  restored: 'تابعنا من حيث توقفت؛ استُعيدت هذه الصفحة من جلستك السابقة.',
  startOver: 'البدء من جديد',
  dismissRestored: 'إغلاق تنبيه الاستعادة',
  flipPreview: 'قلب الاتجاه (معاينة)',
  previewClosed: 'أُغلقت المعاينة، وعدت إلى التحرير.',
  askAssistant: (name) => `اطلب من المساعد تعديل ${name ?? 'هذا العنصر'}.`,
  saveTemplateLabel: (name) => `حفظ قالب · ${name}`,
  savedTemplate: (name) => `حُفظ «${name}» في المكتبة.`,
  onlyTemplates: 'يُحفظ كقالب العنصرُ أو القسمُ المركّب فقط.',
  symbolFallback: 'رمز',
  makeSymbolLabel: (name) => `تحويل إلى رمز · ${name}`,
  madeSymbol: (name) => `أصبح «${name}» رمزًا.`,
  removeTemplateLabel: 'إزالة قالب',
  converted: (label) => `${label}: أصبح كل جزء قابلًا للتحرير.`,
  changes: {
    insertNode: 'إضافة كتلة',
    removeNode: 'حذف كتلة',
    moveNode: 'نقل كتلة',
    duplicateNode: 'تكرار كتلة',
    setProp: 'تعديل خاصية',
    setBinding: 'ربط البيانات',
    setResponsive: 'تخصيص حسب الجهاز',
    setDocMeta: 'إعدادات الصفحة',
    applyPatches: 'تعديل من الشيفرة',
    setSiteDirection: 'اتجاه الصفحة',
    setDesignToken: 'متغيّر تصميم',
    setDesignSystem: 'نظام التصميم',
    setSharedRegion: 'الترويسة أو التذييل',
    setPageRegions: 'مناطق الصفحة',
    registerAsset: 'إضافة صورة',
    updateAsset: 'تعديل صورة',
    removeAsset: 'حذف صورة',
    setPaletteColor: 'لون في لوحة الألوان',
    removePaletteColor: 'حذف لون من لوحة الألوان',
    setNamedStyle: 'نمط مسمّى',
    removeNamedStyle: 'حذف نمط مسمّى',
    patchTreeNode: 'تعديل عنصر',
    setTreeNode: 'تعديل عنصر',
    insertTreeNode: 'إضافة عنصر',
    removeTreeNode: 'حذف عنصر',
    moveTreeNode: 'نقل عنصر',
    duplicateTreeNode: 'تكرار عنصر',
    wrapTreeNode: 'تغليف عنصر',
    unwrapTreeNode: 'فك تغليف عنصر',
    formatTreeText: 'تنسيق النص',
  },
};

export const CHROME_LABELS: Readonly<Record<EditorLocale, ChromeLabels>> = {
  en: CHROME_LABELS_EN,
  ar: CHROME_LABELS_AR,
};

/**
 * Every editor surface's labels for one locale: the shell's typed catalogue
 * (`editorCatalogue`, one door for every surface's EN/AR set) plus this app's
 * own chrome. DESIGN §0.3: defaults live beside each component; the host picks.
 */
export function editorLabels(locale: EditorLocale) {
  return { ...editorCatalogue(locale), chrome: CHROME_LABELS[locale] };
}

export type EditorLabels = ReturnType<typeof editorLabels>;
