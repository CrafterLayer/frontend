import type { CustomCodeEffect } from '@craftkit/builder-schema';

export interface EffectPresetPickerLabels {
  readonly group: string;
  readonly effects: Readonly<Record<CustomCodeEffect, string>>;
}

export const EFFECT_PRESET_PICKER_LABELS_EN: EffectPresetPickerLabels = {
  group: 'Effect presets',
  effects: {
    glass: 'Glass',
    mesh: 'Mesh gradient',
    noise: 'Noise',
    grid: 'Grid pattern',
    dots: 'Dot pattern',
    'retro-grid': 'Retro grid',
    spotlight: 'Spotlight',
    'gradient-border': 'Gradient border',
    'aurora-bg': 'Aurora',
    'text-gradient': 'Gradient text',
    'ring-glow': 'Ring glow',
  },
};

export const EFFECT_PRESET_PICKER_LABELS_AR: EffectPresetPickerLabels = {
  group: 'مؤثرات جاهزة',
  effects: {
    glass: 'زجاجي',
    mesh: 'تدرج شبكي',
    noise: 'حبيبات',
    grid: 'نقش شبكي',
    dots: 'نقش منقط',
    'retro-grid': 'شبكة كلاسيكية',
    spotlight: 'بقعة ضوء',
    'gradient-border': 'حد متدرج',
    'aurora-bg': 'شفق',
    'text-gradient': 'نص متدرج',
    'ring-glow': 'توهج الحلقة',
  },
};
