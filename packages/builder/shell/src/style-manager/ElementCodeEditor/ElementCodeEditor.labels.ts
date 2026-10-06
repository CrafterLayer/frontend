export interface ElementCodeEditorLabels {
  readonly editor: string;
  readonly apply: string;
  readonly revert: string;
  readonly hint: string;
  /** "At class: …". */
  readonly atAttribute: (attribute: string) => string;
  readonly regionCss: string;
  readonly pageCss: string;
  readonly applied: string;
}

export const ELEMENT_CODE_EDITOR_LABELS_EN: ElementCodeEditorLabels = {
  editor: 'Element code',
  apply: 'Apply',
  revert: 'Revert',
  hint: 'One element. Children show as …; edit them in Layers. Ctrl/⌘+Enter applies.',
  atAttribute: (attribute) => `At ${attribute}:`,
  regionCss: 'Section CSS',
  pageCss: 'Page CSS',
  applied: 'Code applied',
};

export const ELEMENT_CODE_EDITOR_LABELS_AR: ElementCodeEditorLabels = {
  editor: 'شيفرة العنصر',
  apply: 'تطبيق',
  revert: 'تراجع',
  hint: 'عنصر واحد. تظهر العناصر الأبناء كـ …؛ حرّرها من الطبقات. Ctrl/⌘+Enter للتطبيق.',
  atAttribute: (attribute) => `عند ${attribute}:`,
  regionCss: 'CSS القسم',
  pageCss: 'CSS الصفحة',
  applied: 'طُبّقت الشيفرة',
};
