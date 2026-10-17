import { cropRect, type CropValue } from '../ImageCropper/crop-math';

/*
  ── An uploaded picture → a site asset (style-manager DESIGN.md §G) ────────

  The site carries uploads inline as `data:image/webp;base64,…`, so a picture
  must be small enough to live in the document: at most 2400px on its longer
  edge and 2 MB encoded. Downscaling and the optional destructive crop happen
  on a canvas (OffscreenCanvas where the browser has one), encoded as WebP at
  q≈0.85, stepping the quality down before giving up.

  The codec is a port so the pipeline is testable without pixels: jsdom has
  no canvas, and the arithmetic — the fit, the crop, the size ceiling — is
  what can go wrong.
*/

export const IMAGE_UPLOAD_MAX_EDGE = 2400;
export const IMAGE_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;
export const IMAGE_UPLOAD_QUALITY = 0.85;
const FALLBACK_QUALITIES = [IMAGE_UPLOAD_QUALITY, 0.72, 0.6] as const;

export interface DecodedImage {
  readonly width: number;
  readonly height: number;
  readonly source: CanvasImageSource;
  readonly close?: (() => void) | undefined;
}

export interface EncodeRequest {
  readonly source: CanvasImageSource;
  /** The source rectangle (the crop). */
  readonly sx: number;
  readonly sy: number;
  readonly sw: number;
  readonly sh: number;
  /** The output size. */
  readonly width: number;
  readonly height: number;
  readonly quality: number;
}

export interface ImageCodec {
  decode(file: Blob): Promise<DecodedImage>;
  encode(request: EncodeRequest): Promise<Blob>;
}

/** `width × height` scaled down (never up) so the longer edge is at most `max`. */
export function fitWithin(width: number, height: number, max = IMAGE_UPLOAD_MAX_EDGE): { width: number; height: number } {
  const longer = Math.max(width, height);
  if (longer <= max) return { width: Math.round(width), height: Math.round(height) };
  const scale = max / longer;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** The browser codec: `createImageBitmap` + OffscreenCanvas (or a canvas element). */
export const browserImageCodec: ImageCodec = {
  async decode(file) {
    const bitmap = await createImageBitmap(file);
    return { width: bitmap.width, height: bitmap.height, source: bitmap, close: () => {
        bitmap.close();
      },
    };
  },
  async encode({ source, sx, sy, sw, sh, width, height, quality }) {
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext('2d');
      if (context === null) throw new Error('No 2D canvas context.');
      context.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);
      return canvas.convertToBlob({ type: 'image/webp', quality });
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('No 2D canvas context.');
    context.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob === null) reject(new Error('The picture could not be encoded.'));
          else resolve(blob);
        },
        'image/webp',
        quality,
      );
    });
  },
};

export type ImageUploadRefusal = 'not-image' | 'too-large' | 'decode-failed' | 'encode-failed';

export interface PreparedImage {
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
}

export type ImageUploadResult =
  | { readonly ok: true; readonly image: PreparedImage }
  | { readonly ok: false; readonly reason: ImageUploadRefusal };

async function toDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let at = 0; at < bytes.length; at += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  }
  const type = blob.type === '' ? 'image/webp' : blob.type;
  return `data:${type};base64,${btoa(binary)}`;
}

export interface PrepareImageOptions {
  readonly codec?: ImageCodec | undefined;
  /** A destructive crop applied before the downscale. */
  readonly crop?: CropValue | undefined;
  readonly maxEdge?: number | undefined;
  readonly maxBytes?: number | undefined;
}

/** Decode, crop, downscale and encode an uploaded picture for the asset table. */
export async function prepareImageUpload(
  file: Blob,
  options: PrepareImageOptions = {},
): Promise<ImageUploadResult> {
  if (!file.type.startsWith('image/')) return { ok: false, reason: 'not-image' };
  const codec = options.codec ?? browserImageCodec;
  let decoded: DecodedImage;
  try {
    decoded = await codec.decode(file);
  } catch {
    return { ok: false, reason: 'decode-failed' };
  }
  try {
    const rect =
      options.crop === undefined
        ? { sx: 0, sy: 0, sw: decoded.width, sh: decoded.height }
        : cropRect(decoded.width, decoded.height, options.crop);
    const size = fitWithin(rect.sw, rect.sh, options.maxEdge ?? IMAGE_UPLOAD_MAX_EDGE);
    const ceiling = options.maxBytes ?? IMAGE_UPLOAD_MAX_BYTES;
    for (const quality of FALLBACK_QUALITIES) {
      let blob: Blob;
      try {
        blob = await codec.encode({ source: decoded.source, ...rect, ...size, quality });
      } catch {
        return { ok: false, reason: 'encode-failed' };
      }
      if (blob.size <= ceiling) {
        return { ok: true, image: { dataUrl: await toDataUrl(blob), ...size, bytes: blob.size } };
      }
    }
    return { ok: false, reason: 'too-large' };
  } finally {
    decoded.close?.();
  }
}
