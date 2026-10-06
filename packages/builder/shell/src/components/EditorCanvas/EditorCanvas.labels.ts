/** The canvas's own announcements and names; the host picks EN or AR by locale (arabic-editor). */
export interface EditorCanvasLabels {
  /** "Image in CV header": a focused element inside the region it belongs to. */
  readonly within: (element: string, region: string) => string;
  readonly selected: (name: string) => string;
  readonly selectionCleared: string;
  readonly editing: (name: string) => string;
  /** Stands in for a missing name in `editing`. */
  readonly text: string;
  readonly editingUnavailable: string;
  readonly actionsFor: (name: string) => string;
  readonly selectionRegion: string;
  readonly gestureRegion: string;
  // ── block-parts (2026-10-06) ──
  /** The language of part names on chips and in announcements (a part's `{ en, ar }` label). */
  readonly locale?: 'en' | 'ar' | undefined;
  /** A part that cannot be edited in place (an image opens the asset picker instead). */
  readonly partNotEditable?: ((name: string) => string) | undefined;
  // ── /block-parts ──
}

export const EDITOR_CANVAS_LABELS_EN: EditorCanvasLabels = {
  within: (element, region) => `${element} in ${region}`,
  selected: (name) => `${name} selected`,
  selectionCleared: 'Selection cleared',
  editing: (name) => `Editing ${name}`,
  text: 'text',
  editingUnavailable: 'Text editing is no longer available',
  actionsFor: (name) => `Actions for ${name}`,
  selectionRegion: 'Selection',
  gestureRegion: 'Gesture',
  // ── block-parts (2026-10-06) ──
  locale: 'en',
  partNotEditable: (name) => `${name} has no text to edit here`,
  // ── /block-parts ──
};

export const EDITOR_CANVAS_LABELS_AR: EditorCanvasLabels = {
  within: (element, region) => `${element} في ${region}`,
  selected: (name) => `حُدِّد ${name}`,
  selectionCleared: 'أُلغي التحديد',
  editing: (name) => `تحرير ${name}`,
  text: 'النص',
  editingUnavailable: 'لم يعد تحرير النص متاحًا',
  actionsFor: (name) => `إجراءات ${name}`,
  selectionRegion: 'التحديد',
  gestureRegion: 'الإيماءة',
  // ── block-parts (2026-10-06) ──
  locale: 'ar',
  partNotEditable: (name) => `لا يحوي ${name} نصًا يُحرَّر هنا`,
  // ── /block-parts ──
};
