import type { StyleBoxSide } from '@craftkit/builder-schema';

export interface BoxModelControlLabels {
  readonly group: string;
  readonly sides: Readonly<Record<StyleBoxSide, string>>;
  /** "Padding inline-start, 16px". */
  readonly side: (ring: string, side: string, value: string) => string;
  readonly unset: string;
  readonly content: string;
}

export const BOX_MODEL_CONTROL_LABELS_EN: BoxModelControlLabels = {
  group: 'Spacing',
  sides: {
    'block-start': 'block-start',
    'block-end': 'block-end',
    'inline-start': 'inline-start',
    'inline-end': 'inline-end',
  },
  side: (ring, side, value) => `${ring} ${side}, ${value}`,
  unset: 'not set',
  content: 'Content',
};

export const BOX_MODEL_CONTROL_LABELS_AR: BoxModelControlLabels = {
  group: 'المسافات',
  sides: {
    'block-start': 'أعلى',
    'block-end': 'أسفل',
    'inline-start': 'البداية',
    'inline-end': 'النهاية',
  },
  side: (ring, side, value) => `${ring} ${side}، ${value}`,
  unset: 'غير مضبوطة',
  content: 'المحتوى',
};
