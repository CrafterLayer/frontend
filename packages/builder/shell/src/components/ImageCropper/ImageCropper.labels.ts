export interface ImageCropperLabels {
  readonly title: string;
  readonly aspect: string;
  readonly aspects: Readonly<Record<string, string>>;
  readonly focal: string;
  /** "30% across, 60% down". */
  readonly focalValue: (x: number, y: number) => string;
  readonly hint: string;
  readonly preview: string;
  readonly apply: string;
  readonly cancel: string;
}

export const IMAGE_CROPPER_LABELS_EN: ImageCropperLabels = {
  title: 'Crop',
  aspect: 'Aspect ratio',
  aspects: {
    original: 'Original',
    square: 'Square',
    '4/3': '4:3',
    '3/2': '3:2',
    '16/9': '16:9',
    '3/4': '3:4',
    '9/16': '9:16',
  },
  focal: 'Focal point',
  focalValue: (x, y) => `${String(x)}% across, ${String(y)}% down`,
  hint: 'Click or drag on the picture, or use the arrow keys (Shift for bigger steps, Home to centre).',
  preview: 'Preview',
  apply: 'Apply crop',
  cancel: 'Cancel',
};

export const IMAGE_CROPPER_LABELS_AR: ImageCropperLabels = {
  title: 'القص',
  aspect: 'نسبة الأبعاد',
  aspects: {
    original: 'الأصلية',
    square: 'مربع',
    '4/3': '4:3',
    '3/2': '3:2',
    '16/9': '16:9',
    '3/4': '3:4',
    '9/16': '9:16',
  },
  focal: 'نقطة التركيز',
  focalValue: (x, y) => `${String(x)}% أفقيًا من اليسار، ${String(y)}% عموديًا`,
  hint: 'انقر أو اسحب على الصورة، أو استخدم مفاتيح الأسهم (Shift لخطوات أكبر، Home للتوسيط).',
  preview: 'معاينة',
  apply: 'طبّق القص',
  cancel: 'إلغاء',
};
