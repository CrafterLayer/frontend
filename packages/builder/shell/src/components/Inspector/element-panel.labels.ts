import type { ElementTabId } from './element-tab-memory';

export interface InspectorElementLabels {
  readonly tabs: Readonly<Record<ElementTabId, string>>;
  readonly tablist: string;
  readonly advanced: string;
  readonly classes: string;
  readonly namedStyles: string;
  readonly addNamedStyle: string;
  readonly removeNamedStyle: (name: string) => string;
  readonly direction: string;
  readonly directions: Readonly<Record<'inherit' | 'auto' | 'rtl' | 'ltr', string>>;
  readonly behavior: string;
  readonly noBehavior: string;
  readonly behaviorParams: string;
  readonly speeds: Readonly<Record<'slow' | 'normal' | 'fast', string>>;
  readonly noContent: string;
  readonly componentProps: string;
  readonly iconNoInteractions: string;
  readonly codeOnlyElements: string;
  readonly designBlock: string;
  readonly convert: string;
  readonly convertHint: string;
  /** Why "Convert to editable" is off: the block's container only holds certain blocks. */
  readonly convertBlocked: (container: string) => string;
  readonly elements: (count: number) => string;
}

export const INSPECTOR_ELEMENT_LABELS_EN: InspectorElementLabels = {
  tabs: { content: 'Content', design: 'Design', interactions: 'Interactions', code: 'Code' },
  tablist: 'Element panel',
  advanced: 'Advanced',
  classes: 'Classes',
  namedStyles: 'Named styles',
  addNamedStyle: '+ Style',
  removeNamedStyle: (name) => `Remove style ${name}`,
  direction: 'Text direction',
  directions: { inherit: 'Inherit', auto: 'Auto', rtl: 'Right to left', ltr: 'Left to right' },
  behavior: 'Behaviour',
  noBehavior: 'None',
  behaviorParams: 'Behaviour settings',
  speeds: { slow: 'Slow', normal: 'Normal', fast: 'Fast' },
  noContent: 'This element has no content of its own. Style it in Design, or select one of its children.',
  componentProps: 'Component',
  iconNoInteractions: 'Icons animate with their parent. Select the element around this icon to animate it.',
  codeOnlyElements: 'Icons and components are edited in Content. The Code tab shows HTML elements.',
  designBlock: 'Style classes',
  convert: 'Convert to editable',
  convertHint: 'Turns this block into an editable section, so every part of it becomes its own element.',
  convertBlocked: (container) =>
    `This block sits inside ${container}, which only holds certain blocks. Convert ${container} instead.`,
  elements: (count) => `${String(count)} elements`,
};

export const INSPECTOR_ELEMENT_LABELS_AR: InspectorElementLabels = {
  tabs: { content: 'المحتوى', design: 'التصميم', interactions: 'التفاعلات', code: 'الشيفرة' },
  tablist: 'لوحة العنصر',
  advanced: 'متقدم',
  classes: 'الأصناف',
  namedStyles: 'الأنماط المسمّاة',
  addNamedStyle: '+ نمط',
  removeNamedStyle: (name) => `إزالة النمط ${name}`,
  direction: 'اتجاه النص',
  directions: { inherit: 'موروث', auto: 'تلقائي', rtl: 'من اليمين إلى اليسار', ltr: 'من اليسار إلى اليمين' },
  behavior: 'السلوك',
  noBehavior: 'بدون',
  behaviorParams: 'إعدادات السلوك',
  speeds: { slow: 'بطيئة', normal: 'عادية', fast: 'سريعة' },
  noContent: 'لا محتوى خاص بهذا العنصر. صمّمه من التصميم، أو اختر أحد عناصره الأبناء.',
  componentProps: 'المكوّن',
  iconNoInteractions: 'تتحرك الأيقونات مع العنصر الحاوي. اختر العنصر المحيط بالأيقونة لتحريكه.',
  codeOnlyElements: 'تُحرَّر الأيقونات والمكوّنات من المحتوى. تعرض الشيفرة عناصر HTML.',
  designBlock: 'أصناف التنسيق',
  convert: 'تحويل إلى قابل للتحرير',
  convertHint: 'يحوّل هذه الكتلة إلى قسم قابل للتحرير، فيصبح كل جزء منها عنصرًا مستقلًا.',
  convertBlocked: (container) =>
    `هذه الكتلة داخل ${container}، ولا يقبل إلا كتلًا محددة. حوّل ${container} بدلًا منها.`,
  elements: (count) => `${String(count)} عناصر`,
};
