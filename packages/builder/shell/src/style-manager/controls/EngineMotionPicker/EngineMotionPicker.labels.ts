import type { SceneDensity, ScenePalette } from '@craftkit/builder-schema';

export interface EngineMotionPickerLabels {
  /** Which half of the schema's bilingual recipe and scene names to show. */
  readonly locale: 'en' | 'ar';
  /** The recipe group's name, and the commit label of a recipe change. */
  readonly recipe: string;
  readonly none: string;
  readonly noRecipe: string;
  readonly plays: string;
  readonly playsAs: Readonly<Record<'default' | 'true' | 'false', string>>;
  /** The scene group's name, and the commit label of a scene change. */
  readonly scene: string;
  readonly noScene: string;
  readonly density: string;
  readonly densities: Readonly<Record<SceneDensity, string>>;
  readonly palette: string;
  readonly palettes: Readonly<Record<ScenePalette, string>>;
}

export const ENGINE_MOTION_PICKER_LABELS_EN: EngineMotionPickerLabels = {
  locale: 'en',
  recipe: 'Cinematic motion',
  none: 'None',
  noRecipe: 'No cinematic motion',
  plays: 'Plays',
  playsAs: { default: 'As the recipe', true: 'With scroll', false: 'Once' },
  scene: 'Animated background',
  noScene: 'No animated background',
  density: 'Density',
  densities: { low: 'Low', medium: 'Medium', high: 'High' },
  palette: 'Colours',
  palettes: { theme: 'Theme', accent: 'Accent', mono: 'Mono' },
};

export const ENGINE_MOTION_PICKER_LABELS_AR: EngineMotionPickerLabels = {
  locale: 'ar',
  recipe: 'حركة سينمائية',
  none: 'بدون',
  noRecipe: 'لا حركة سينمائية',
  plays: 'التشغيل',
  playsAs: { default: 'كما في الوصفة', true: 'مع التمرير', false: 'مرة واحدة' },
  scene: 'خلفية متحركة',
  noScene: 'لا خلفية متحركة',
  density: 'الكثافة',
  densities: { low: 'منخفضة', medium: 'متوسطة', high: 'عالية' },
  palette: 'الألوان',
  palettes: { theme: 'ألوان الموقع', accent: 'اللون المميز', mono: 'أحادي' },
};
