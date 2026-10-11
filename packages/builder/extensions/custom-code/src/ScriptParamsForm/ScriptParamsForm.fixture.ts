import type { ScriptParamSpec } from '@craftkit/builder-schema';

/** Local deterministic examples shared by the component's stories and tests only. */
export const SCRIPT_PARAMS_FORM_SPEC = [
  { key: 'title', type: 'text', label: { en: 'Title', ar: 'العنوان' }, default: 'Hello' },
  {
    key: 'seed',
    type: 'number',
    label: { en: 'Seed', ar: 'البذرة' },
    default: 1,
    min: 0,
    max: 99,
    step: 1,
  },
  { key: 'color', type: 'color', label: { en: 'Accent', ar: 'اللون' }, default: '#e8a33d' },
  { key: 'palette', type: 'palette', label: { en: 'Palette', ar: 'الألوان' }, default: 'theme' },
  {
    key: 'style',
    type: 'select',
    label: { en: 'Style', ar: 'النمط' },
    default: 'soft',
    options: [
      { value: 'soft', label: { en: 'Soft', ar: 'ناعم' } },
      { value: 'bold', label: { en: 'Bold', ar: 'قوي' } },
    ],
  },
  {
    key: 'shape',
    type: 'select',
    label: { en: 'Shape', ar: 'الشكل' },
    default: 'circle',
    options: ['circle', 'square', 'star', 'triangle', 'hexagon'].map((value) => ({
      value,
      label: { en: value, ar: value },
    })),
  },
  { key: 'image', type: 'image', label: { en: 'Photo', ar: 'الصورة' }, default: '' },
  {
    key: 'speed',
    type: 'range',
    label: { en: 'Speed', ar: 'السرعة' },
    default: 1,
    min: 0,
    max: 3,
    step: 0.25,
    group: 'motion',
    help: { en: 'How quickly the scene moves.', ar: 'سرعة حركة المشهد.' },
  },
  {
    key: 'pointer',
    type: 'toggle',
    label: { en: 'Pointer', ar: 'المؤشر' },
    default: false,
    group: 'interaction',
  },
  { key: 'sound', type: 'sound', label: { en: 'Sound', ar: 'الصوت' }, default: '', group: 'sound' },
] satisfies readonly ScriptParamSpec[];
