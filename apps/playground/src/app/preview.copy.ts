import type { PreviewModeProps } from '@craftkit/builder';

/**
 * Preview's own words in Arabic (UX pass, 2026-10-13): "Exit preview" stayed English in the
 * Arabic editor. English is PreviewMode's default, so only the Arabic set is the host's.
 */
export const PREVIEW_MODE_LABELS_AR: NonNullable<PreviewModeProps['labels']> = {
  region: 'معاينة',
  frameTitle: 'معاينة',
  exit: 'إنهاء المعاينة',
  exitKey: 'Esc',
  entered: 'معاينة — اضغط Escape للعودة إلى التحرير.',
  messages: 'رسائل المعاينة',
};
