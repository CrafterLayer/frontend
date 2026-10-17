import {
  LIBRARY_LIMITS,
  SITE_FONT_FAMILY,
  UPLOADED_FONT_PREFIX,
  type SiteFont,
} from '@craftkit/builder-schema';

/*
  ── An uploaded woff2 → a site font (style-manager DESIGN.md §2, §G) ────────

  The library carries an uploaded face inline as `data:font/woff2;base64,…`
  of at most 600 kB decoded, so the published page needs no font host. The
  checks here are the door's, run BEFORE the bytes are encoded: a file that is
  not WOFF2 (the signature is the four bytes "wOF2") or is too large is
  refused with a sentence, never sent.
*/

export const FONT_UPLOAD_MAX_BYTES = LIBRARY_LIMITS.uploadedFontBytes;

/** "wOF2", the WOFF2 file signature. */
const WOFF2_SIGNATURE = [0x77, 0x4f, 0x46, 0x32] as const;

export type FontUploadRefusal = 'not-woff2' | 'too-large' | 'empty' | 'bad-family';

export type FontUploadCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: FontUploadRefusal };

/** Whether `bytes` are a WOFF2 file the library may carry. */
export function checkFontBytes(bytes: Uint8Array): FontUploadCheck {
  if (bytes.byteLength === 0) return { ok: false, reason: 'empty' };
  if (bytes.byteLength > FONT_UPLOAD_MAX_BYTES) return { ok: false, reason: 'too-large' };
  const signed = WOFF2_SIGNATURE.every((byte, at) => bytes[at] === byte);
  return signed ? { ok: true } : { ok: false, reason: 'not-woff2' };
}

/** A family name the library admits, from a file name ("my-font_Bold.woff2" → "my-font Bold"). */
export function familyFromFileName(fileName: string): string {
  const stem = fileName.replace(/\.[^.]*$/u, '').replace(/[^A-Za-z0-9 _-]+/gu, ' ');
  const cleaned = stem.replace(/\s+/gu, ' ').trim().slice(0, 64).trim();
  return SITE_FONT_FAMILY.test(cleaned) ? cleaned : 'Uploaded font';
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let at = 0; at < bytes.length; at += chunk) {
    binary += String.fromCharCode(...bytes.subarray(at, at + chunk));
  }
  return btoa(binary);
}

export interface FontUploadOptions {
  readonly family: string;
  /** One weight, or a [low, high] range for a variable font. */
  readonly weights: readonly number[];
  readonly italic?: boolean | undefined;
  readonly scripts?: readonly ('arabic' | 'latin')[] | undefined;
}

export type FontUploadResult =
  | { readonly ok: true; readonly font: SiteFont }
  | { readonly ok: false; readonly reason: FontUploadRefusal };

/** Read, check and encode an uploaded font file as a `SiteFont`. */
export async function readFontUpload(
  file: Pick<Blob, 'arrayBuffer' | 'size'>,
  options: FontUploadOptions,
): Promise<FontUploadResult> {
  if (!SITE_FONT_FAMILY.test(options.family)) return { ok: false, reason: 'bad-family' };
  if (file.size > FONT_UPLOAD_MAX_BYTES) return { ok: false, reason: 'too-large' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkFontBytes(bytes);
  if (!check.ok) return check;
  const font: SiteFont = {
    family: options.family,
    source: 'upload',
    weights: [...new Set(options.weights)],
    url: `${UPLOADED_FONT_PREFIX}${toBase64(bytes)}`,
    ...(options.italic === true ? { italic: true } : {}),
    ...(options.scripts === undefined || options.scripts.length === 0
      ? {}
      : { scripts: [...options.scripts] }),
  };
  return { ok: true, font };
}

/** The font list with `font` added, replacing any entry of the same family (case-insensitive). */
export function withSiteFont(fonts: readonly SiteFont[] | undefined, font: SiteFont): SiteFont[] {
  const key = font.family.toLowerCase();
  return [...(fonts ?? []).filter((entry) => entry.family.toLowerCase() !== key), font];
}
