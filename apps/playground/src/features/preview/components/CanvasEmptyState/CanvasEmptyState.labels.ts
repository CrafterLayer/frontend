/** Every string the empty page's invitation shows, in the editor's language. */
export interface CanvasEmptyStateLabels {
  /** The region's spoken name. */
  readonly region: string;
  readonly title: string;
  readonly body: string;
  readonly addBlock: string;
  readonly useTemplate: string;
  readonly tip: string;
}

export const CANVAS_EMPTY_STATE_LABELS_EN: CanvasEmptyStateLabels = {
  region: 'Empty page',
  title: 'This page is empty',
  body: 'Add your first block from the library, or start from a ready-made template.',
  addBlock: 'Add a block',
  useTemplate: 'Start from a template',
  tip: 'Tip: drag any block from the library straight onto the page.',
};

export const CANVAS_EMPTY_STATE_LABELS_AR: CanvasEmptyStateLabels = {
  region: 'صفحة فارغة',
  title: 'هذه الصفحة فارغة',
  body: 'أضف أول كتلة من المكتبة، أو ابدأ من قالب جاهز.',
  addBlock: 'أضف كتلة',
  useTemplate: 'ابدأ من قالب',
  tip: 'تلميح: اسحب أي كتلة من المكتبة وأفلتها على الصفحة مباشرة.',
};

export function canvasEmptyStateLabels(locale: 'en' | 'ar'): CanvasEmptyStateLabels {
  return locale === 'ar' ? CANVAS_EMPTY_STATE_LABELS_AR : CANVAS_EMPTY_STATE_LABELS_EN;
}
