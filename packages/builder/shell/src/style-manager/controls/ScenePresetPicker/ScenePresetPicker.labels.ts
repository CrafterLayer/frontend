import type { SceneDensity, ScenePalette } from '@craftkit/builder-schema';

export interface ScenePresetPickerLabels {
  /** Which half of the schema's bilingual scene names and descriptions to show. */
  readonly locale: 'en' | 'ar';
  readonly group: string;
  readonly scene: string;
  readonly density: string;
  readonly densities: Readonly<Record<SceneDensity, string>>;
  readonly palette: string;
  readonly palettes: Readonly<Record<ScenePalette, string>>;
  /** Shown on a scene that draws from images when the layer holds none. */
  readonly needsImages: string;
  /** The commit labels (Undo / history). */
  readonly changed: string;
}

export const SCENE_PRESET_PICKER_LABELS_EN: ScenePresetPickerLabels = {
  locale: 'en',
  group: 'Animated background',
  scene: 'Scene',
  density: 'Density',
  densities: { low: 'Low', medium: 'Medium', high: 'High' },
  palette: 'Colours',
  palettes: { theme: 'Theme', accent: 'Accent', mono: 'Mono' },
  needsImages: 'Needs at least one image inside the layer',
  changed: 'Animated background',
};

export const SCENE_PRESET_PICKER_LABELS_AR: ScenePresetPickerLabels = {
  locale: 'ar',
  group: 'خلفية متحركة',
  scene: 'المشهد',
  density: 'الكثافة',
  densities: { low: 'منخفضة', medium: 'متوسطة', high: 'عالية' },
  palette: 'الألوان',
  palettes: { theme: 'ألوان الموقع', accent: 'اللون المميز', mono: 'أحادي' },
  needsImages: 'يحتاج صورة واحدة على الأقل داخل الطبقة',
  changed: 'خلفية متحركة',
};
