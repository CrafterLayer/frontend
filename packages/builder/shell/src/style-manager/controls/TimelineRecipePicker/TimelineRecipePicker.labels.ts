export interface TimelineRecipePickerLabels {
  /** Which half of the schema's bilingual recipe names and descriptions to show. */
  readonly locale: 'en' | 'ar';
  readonly recipe: string;
  readonly none: string;
  readonly noneDescription: string;
  readonly scrub: string;
  readonly scrubs: Readonly<Record<'default' | 'true' | 'false', string>>;
  /** The commit label (Undo / history). */
  readonly changed: string;
}

export const TIMELINE_RECIPE_PICKER_LABELS_EN: TimelineRecipePickerLabels = {
  locale: 'en',
  recipe: 'Cinematic motion',
  none: 'None',
  noneDescription: 'No scroll animation on this element.',
  scrub: 'Plays',
  scrubs: { default: 'As the recipe plays', true: 'With the scrollbar', false: 'Once on enter' },
  changed: 'Cinematic motion',
};

export const TIMELINE_RECIPE_PICKER_LABELS_AR: TimelineRecipePickerLabels = {
  locale: 'ar',
  recipe: 'حركة سينمائية',
  none: 'بدون',
  noneDescription: 'لا حركة تمرير على هذا العنصر.',
  scrub: 'التشغيل',
  scrubs: { default: 'كما تعمل الوصفة', true: 'مع شريط التمرير', false: 'مرة عند الظهور' },
  changed: 'حركة سينمائية',
};
