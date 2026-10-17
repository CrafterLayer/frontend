import type { StyleIntent } from '@craftkit/builder-schema';

/*
  ── Crop as data (style-manager DESIGN.md §G "ImageCropper") ───────────────

  A crop is an aspect ratio plus a focal point. On an element it is written
  non-destructively as classes — `aspect-*`, `object-cover` and
  `object-[x%_y%]` — so it can be changed later; on upload it can instead be
  applied to the pixels (`cropRect` + a canvas). The focal point is in IMAGE
  coordinates (0–100 from the image's left and top edges): a photograph does
  not mirror in a right-to-left page, so neither does its focal point.
*/

export interface AspectPreset {
  readonly id: string;
  /** Width / height, or undefined for the image's own ratio. */
  readonly ratio?: number | undefined;
  /** The `aspect-*` token the engine writes (`16/9`, `square`). */
  readonly token?: string | undefined;
}

export const ASPECT_PRESETS: readonly AspectPreset[] = [
  { id: 'original' },
  { id: 'square', ratio: 1, token: 'square' },
  { id: '4/3', ratio: 4 / 3, token: '4/3' },
  { id: '3/2', ratio: 3 / 2, token: '3/2' },
  { id: '16/9', ratio: 16 / 9, token: '16/9' },
  { id: '3/4', ratio: 3 / 4, token: '3/4' },
  { id: '9/16', ratio: 9 / 16, token: '9/16' },
];

export interface CropValue {
  /** An `ASPECT_PRESETS` id. */
  readonly aspect: string;
  /** Focal point, percent from the left edge (0–100). */
  readonly x: number;
  /** Focal point, percent from the top edge (0–100). */
  readonly y: number;
}

export const DEFAULT_CROP: CropValue = { aspect: 'original', x: 50, y: 50 };

export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** The focal point moved by a key, or undefined for a key the cropper ignores. */
export function focalAfterKey(crop: CropValue, key: string, large: boolean): CropValue | undefined {
  const step = large ? 10 : 1;
  switch (key) {
    case 'ArrowLeft':
      return { ...crop, x: clampPercent(crop.x - step) };
    case 'ArrowRight':
      return { ...crop, x: clampPercent(crop.x + step) };
    case 'ArrowUp':
      return { ...crop, y: clampPercent(crop.y - step) };
    case 'ArrowDown':
      return { ...crop, y: clampPercent(crop.y + step) };
    case 'Home':
      return { ...crop, x: 50, y: 50 };
    default:
      return undefined;
  }
}

/** The style intents a crop writes on an image element (base bucket, default state). */
export function cropIntents(crop: CropValue): StyleIntent[] {
  const preset = ASPECT_PRESETS.find((each) => each.id === crop.aspect);
  const centred = crop.x === 50 && crop.y === 50;
  const at = { bucket: 'base', state: 'default' } as const;
  return [
    {
      property: 'aspectRatio',
      value: preset?.token === undefined ? null : { kind: 'token', token: preset.token },
      ...at,
    },
    {
      property: 'objectFit',
      value: preset?.token === undefined ? null : { kind: 'keyword', keyword: 'cover' },
      ...at,
    },
    {
      property: 'objectPosition',
      value: centred ? null : { kind: 'raw', css: `${String(crop.x)}% ${String(crop.y)}%` },
      ...at,
    },
  ];
}

export interface CropRect {
  readonly sx: number;
  readonly sy: number;
  readonly sw: number;
  readonly sh: number;
}

/**
 * The largest rectangle of the preset's ratio inside a `width × height`
 * image, centred on the focal point and kept inside the image.
 */
export function cropRect(width: number, height: number, crop: CropValue): CropRect {
  const ratio = ASPECT_PRESETS.find((each) => each.id === crop.aspect)?.ratio ?? width / height;
  let sw = width;
  let sh = width / ratio;
  if (sh > height) {
    sh = height;
    sw = height * ratio;
  }
  const cx = (crop.x / 100) * width;
  const cy = (crop.y / 100) * height;
  const sx = Math.min(Math.max(0, cx - sw / 2), width - sw);
  const sy = Math.min(Math.max(0, cy - sh / 2), height - sh);
  return { sx: Math.round(sx), sy: Math.round(sy), sw: Math.round(sw), sh: Math.round(sh) };
}
