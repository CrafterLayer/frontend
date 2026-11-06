/**
 * Copy around a first build (docs/architecture/empty-canvas-first-build-research.md): the
 * clarify panel's ways past its questions, and the next-step chips under the first build.
 * Its own module, like `followup-copy.ts`: the catalog files are at their size limit.
 *
 * Each chip's `.request` is the request it SENDS, the person's next turn, worded so the
 * router reads it as intended (`FollowUpChips/follow-up-routing.test.ts` proves each one):
 * colours, style and order are edits of the page that exists, a section is `add-section`.
 * Arabic «قسمًا» is not read as a section (the router's lexicon knows «قسم» only), so the
 * section request says «قسمَ محتوى», which it does read.
 */
export const FIRST_BUILD_KEYS = [
  'clarify.buildNow',
  'clarify.buildNow.hint',
  'clarify.skip',
  'clarify.skipped',
  'nextSteps.label',
  'nextSteps.hint',
  'nextSteps.colors',
  'nextSteps.colors.request',
  'nextSteps.style',
  'nextSteps.style.request',
  'nextSteps.reorder',
  'nextSteps.reorder.request',
  'nextSteps.addSection',
  'nextSteps.addSection.request',
] as const;

export const FIRST_BUILD_EN = {
  'clarify.buildNow': 'Build now',
  'clarify.buildNow.hint': 'Skips the remaining questions and builds with sensible defaults',
  'clarify.skip': 'Skip',
  'clarify.skipped': 'Your call',
  'nextSteps.label': 'Next steps',
  'nextSteps.hint': 'Sends this as your next request',
  'nextSteps.colors': 'Restyle colours',
  'nextSteps.colors.request':
    'Change the page colours to a new, harmonious palette; keep the content and layout as they are.',
  'nextSteps.style': 'Another style',
  'nextSteps.style.request':
    'Restyle the page in a different design direction with new fonts, colours and spacing, keeping the content.',
  'nextSteps.reorder': 'Reorder sections',
  'nextSteps.reorder.request':
    'Reorder the page sections into a clearer order for visitors, without changing their content.',
  'nextSteps.addSection': 'Add a section',
  'nextSteps.addSection.request': 'Add a new section that fits this page at the end.',
} as const;

export const FIRST_BUILD_AR = {
  'clarify.buildNow': 'ابنِ مباشرة',
  'clarify.buildNow.hint': 'يتخطّى بقية الأسئلة ويبني بخيارات مناسبة',
  'clarify.skip': 'تخطَّ',
  'clarify.skipped': 'اختر أنت الأنسب',
  'nextSteps.label': 'خطوات تالية',
  'nextSteps.hint': 'يرسل هذا طلبًا تاليًا',
  'nextSteps.colors': 'بدّل الألوان',
  'nextSteps.colors.request':
    'غيّر ألوان الصفحة إلى لوحة ألوان جديدة متناسقة، مع الحفاظ على المحتوى والتخطيط.',
  'nextSteps.style': 'ستايل مختلف',
  'nextSteps.style.request':
    'غيّر ستايل الصفحة إلى اتجاه تصميم مختلف: خطوط وألوان ومسافات جديدة، مع الحفاظ على المحتوى.',
  'nextSteps.reorder': 'رتّب الأقسام',
  'nextSteps.reorder.request': 'رتّب أقسام الصفحة بترتيب أوضح للزائر، دون تغيير محتواها.',
  'nextSteps.addSection': 'أضف قسمًا',
  'nextSteps.addSection.request': 'أضف قسمَ محتوى جديدًا يناسب الصفحة في آخرها.',
} as const;
