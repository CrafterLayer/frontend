/** Every string Preview shows or speaks (EN default; a host passes its editor's language). */
export interface PreviewModeLabels {
  /** The preview region's name. */
  readonly region: string;
  /** The preview frame's title. */
  readonly frameTitle: string;
  readonly exit: string;
  /** The key that also exits, drawn beside Exit preview. */
  readonly exitKey: string;
  /** Said once on entry. */
  readonly entered: string;
  /** The polite region's name. */
  readonly messages: string;
}

export const PREVIEW_MODE_LABELS_EN: PreviewModeLabels = {
  region: 'Preview',
  frameTitle: 'Preview',
  exit: 'Exit preview',
  exitKey: 'Esc',
  entered: 'Preview — press Escape to return to editing.',
  messages: 'Preview messages',
};

export const PREVIEW_MODE_LABELS_AR: PreviewModeLabels = {
  region: 'معاينة',
  frameTitle: 'معاينة',
  exit: 'إنهاء المعاينة',
  exitKey: 'Esc',
  entered: 'معاينة — اضغط Escape للعودة إلى التحرير.',
  messages: 'رسائل المعاينة',
};
