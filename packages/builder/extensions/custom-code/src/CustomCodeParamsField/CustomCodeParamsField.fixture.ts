import { z } from 'zod';

import {
  customCodeJsMeta,
  type AssetEntry,
  type AssetLibraryPort,
  type FieldSibling,
  type ScriptParamSpec,
} from '@craftkit/builder-schema';

/** Local deterministic examples shared by the field's stories and tests only. */

/** One param of every type, deliberately NOT in group order: the field keeps spec order. */
export const SCENE_SPEC = [
  {
    key: 'speed',
    type: 'range',
    label: { en: 'Speed', ar: 'السرعة' },
    default: 1,
    min: 0,
    max: 3,
    step: 0.5,
    group: 'motion',
  },
  {
    key: 'count',
    type: 'number',
    label: { en: 'Count', ar: 'العدد' },
    default: 40,
    min: 1,
    max: 200,
    step: 1,
  },
  { key: 'tint', type: 'color', label: { en: 'Tint', ar: 'اللون' }, default: '#e8a33d' },
  { key: 'colours', type: 'palette', label: { en: 'Colours', ar: 'الألوان' }, default: 'theme' },
  {
    key: 'shape',
    type: 'select',
    label: { en: 'Shape', ar: 'الشكل' },
    default: 'circle',
    options: [
      { value: 'circle', label: { en: 'Circle', ar: 'دائرة' } },
      { value: 'square', label: { en: 'Square', ar: 'مربع' } },
    ],
  },
  {
    key: 'interactive',
    type: 'toggle',
    label: { en: 'Follow the pointer', ar: 'تتبع المؤشر' },
    default: false,
    group: 'interaction',
  },
  { key: 'title', type: 'text', label: { en: 'Title', ar: 'العنوان' }, default: 'Hello' },
  { key: 'backdrop', type: 'image', label: { en: 'Backdrop', ar: 'الخلفية' }, default: '' },
  {
    key: 'chime',
    type: 'sound',
    label: { en: 'Chime', ar: 'النغمة' },
    default: '',
    group: 'sound',
  },
] satisfies readonly ScriptParamSpec[];

/** The block's other props as the Inspector hands them over: `jsMeta` found by its marker. */
export function sceneSiblings(params: readonly ScriptParamSpec[] = SCENE_SPEC): FieldSibling[] {
  return [
    { key: 'label', schema: z.string().max(80), value: 'Starfield' },
    { key: 'jsMeta', schema: customCodeJsMeta(), value: { params: [...params] } },
  ];
}

const PICTURE = (fill: string): string =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="${fill}"/></svg>`,
  )}`;

const PICTURES: readonly AssetEntry[] = [
  {
    id: 'ember-wash',
    url: PICTURE('#c2410c'),
    description: 'A warm amber ground',
    mood: ['warm'],
    palette: ['#c2410c'],
    alt: 'Ember wash',
    width: 4,
    height: 3,
  },
  {
    id: 'ink-wash',
    url: PICTURE('#1e293b'),
    description: 'A deep slate ground',
    mood: ['quiet'],
    palette: ['#1e293b'],
    alt: 'Ink wash',
    width: 4,
    height: 3,
  },
];

/** A picture library answering from memory, like the playground's. */
export const SCENE_PICTURES: AssetLibraryPort = {
  list: () => Promise.resolve(PICTURES),
};
