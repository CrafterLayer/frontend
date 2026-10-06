/** Every user-facing string of the Inspector's part panel (block-parts DESIGN §2.13). */
export interface InspectorPartLabels {
  /** The panel title: "Heading · Hero". */
  readonly title: (partLabel: string, blockName: string) => string;
  readonly tablist: string;
  readonly tabs: { readonly content: string; readonly design: string };
  /** The way back out of the part, to the whole block. */
  readonly backToBlock: string;
  /** Item n of a repeated part, 1-based: "Item 3". */
  readonly item: (position: number) => string;
  /** A sub-row of a link part. */
  readonly linkAddress: string;
  /** A sub-row of an image part. */
  readonly altText: string;
  /** A box part carries no content of its own. */
  readonly noContent: string;
  /** The part is gone (the item was removed, an undo pruned it). */
  readonly gone: string;
  readonly scope: {
    readonly label: string;
    readonly all: string;
    readonly this: string;
  };
  readonly direction: {
    readonly label: string;
    readonly auto: string;
    readonly ltr: string;
    readonly rtl: string;
    readonly hint: string;
  };
  readonly announce: {
    readonly backToBlock: (blockName: string) => string;
    readonly direction: (value: string) => string;
  };
}

export const INSPECTOR_PART_LABELS_EN: InspectorPartLabels = {
  title: (partLabel, blockName) => `${partLabel} · ${blockName}`,
  tablist: 'Part panel',
  tabs: { content: 'Content', design: 'Design' },
  backToBlock: 'Back to block',
  item: (position) => `Item ${String(position)}`,
  linkAddress: 'Link address',
  altText: 'Alt text',
  noContent: 'This part has no content of its own. Style it on the Design tab.',
  gone: 'This part is no longer on the page.',
  scope: { label: 'Apply to', all: 'All items', this: 'This item' },
  direction: {
    label: 'Text direction',
    auto: 'Auto',
    ltr: 'Left to right',
    rtl: 'Right to left',
    hint: 'Auto follows the text itself, so an English line on an Arabic page keeps its full stop at the end.',
  },
  announce: {
    backToBlock: (blockName) => `${blockName} selected.`,
    direction: (value) => `Text direction: ${value}.`,
  },
};

export const INSPECTOR_PART_LABELS_AR: InspectorPartLabels = {
  title: (partLabel, blockName) => `${partLabel} · ${blockName}`,
  tablist: 'لوحة الجزء',
  tabs: { content: 'المحتوى', design: 'التصميم' },
  backToBlock: 'العودة إلى الكتلة',
  item: (position) => `العنصر ${String(position)}`,
  linkAddress: 'عنوان الرابط',
  altText: 'النص البديل',
  noContent: 'لا محتوى لهذا الجزء. نسّقه من تبويب التصميم.',
  gone: 'لم يعد هذا الجزء في الصفحة.',
  scope: { label: 'التطبيق على', all: 'كل العناصر', this: 'هذا العنصر' },
  direction: {
    label: 'اتجاه النص',
    auto: 'تلقائي',
    ltr: 'من اليسار إلى اليمين',
    rtl: 'من اليمين إلى اليسار',
    hint: 'التلقائي يتبع النص نفسه، فيبقى سطر إنجليزي في صفحة عربية بنقطته في آخره.',
  },
  announce: {
    backToBlock: (blockName) => `حُدّد ${blockName}.`,
    direction: (value) => `اتجاه النص: ${value}.`,
  },
};

export function inspectorPartLabelsFor(locale: 'en' | 'ar'): InspectorPartLabels {
  return locale === 'ar' ? INSPECTOR_PART_LABELS_AR : INSPECTOR_PART_LABELS_EN;
}
