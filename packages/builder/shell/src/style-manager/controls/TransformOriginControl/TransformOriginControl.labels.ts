import type { OriginPoint } from './origin-points';

export interface TransformOriginControlLabels {
  readonly group: string;
  readonly point: (point: OriginPoint) => string;
}

const EN_AXIS = { start: 'start', center: 'centre', end: 'end' } as const;
const AR_BLOCK = { start: 'الأعلى', center: 'الوسط', end: 'الأسفل' } as const;
const AR_INLINE = { start: 'البداية', center: 'الوسط', end: 'النهاية' } as const;

export const TRANSFORM_ORIGIN_CONTROL_LABELS_EN: TransformOriginControlLabels = {
  group: 'Transform origin',
  point: ({ block, inline }) =>
    block === 'center' && inline === 'center'
      ? 'Centre'
      : `Block ${EN_AXIS[block]}, inline ${EN_AXIS[inline]}`,
};

export const TRANSFORM_ORIGIN_CONTROL_LABELS_AR: TransformOriginControlLabels = {
  group: 'نقطة الارتكاز',
  point: ({ block, inline }) =>
    block === 'center' && inline === 'center' ? 'الوسط' : `${AR_BLOCK[block]}، ${AR_INLINE[inline]}`,
};
