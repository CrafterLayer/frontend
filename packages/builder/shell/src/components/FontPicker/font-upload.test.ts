import { describe, expect, it } from 'vitest';

import { isUploadedFontUrl, siteFontSchema } from '@craftkit/builder-schema';

import {
  checkFontBytes,
  familyFromFileName,
  FONT_UPLOAD_MAX_BYTES,
  readFontUpload,
  withSiteFont,
} from './font-upload';
import { filterFonts, CURATED_FONTS, firstFamily, fontStack, weightsToLoad } from './font-catalogue';

const woff2 = (size: number): Uint8Array => {
  const bytes = new Uint8Array(size);
  bytes.set([0x77, 0x4f, 0x46, 0x32]);
  return bytes;
};

const blob = (bytes: Uint8Array) => ({
  size: bytes.byteLength,
  arrayBuffer: () => Promise.resolve(bytes.slice().buffer),
});

describe('font upload validation', () => {
  it('accepts a WOFF2 file by its signature', () => {
    expect(checkFontBytes(woff2(64))).toEqual({ ok: true });
  });

  it('refuses a TTF, an empty file and anything over 600 kB', () => {
    expect(checkFontBytes(new Uint8Array([0, 1, 0, 0, 9, 9]))).toEqual({ ok: false, reason: 'not-woff2' });
    expect(checkFontBytes(new Uint8Array())).toEqual({ ok: false, reason: 'empty' });
    expect(checkFontBytes(woff2(FONT_UPLOAD_MAX_BYTES + 1))).toEqual({ ok: false, reason: 'too-large' });
  });

  it('encodes an accepted file as a site font the library schema admits', async () => {
    const result = await readFontUpload(blob(woff2(2048)), { family: 'My Face', weights: [400] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(isUploadedFontUrl(result.font.url ?? '')).toBe(true);
    expect(siteFontSchema.safeParse(result.font).success).toBe(true);
  });

  it('refuses before reading when the file or the family name is wrong', async () => {
    expect(await readFontUpload(blob(woff2(FONT_UPLOAD_MAX_BYTES + 10)), { family: 'Big', weights: [400] })).toEqual(
      { ok: false, reason: 'too-large' },
    );
    expect(await readFontUpload(blob(woff2(10)), { family: 'خط', weights: [400] })).toEqual({
      ok: false,
      reason: 'bad-family',
    });
  });

  it('derives a family from a file name', () => {
    expect(familyFromFileName('Acme_Sans-Bold.woff2')).toBe('Acme_Sans-Bold');
    expect(familyFromFileName('خط.woff2')).toBe('Uploaded font');
  });

  it('replaces a same-family entry rather than listing it twice', () => {
    const fonts = withSiteFont(
      [{ family: 'Cairo', source: 'google', weights: [400] }],
      { family: 'cairo', source: 'google', weights: [700] },
    );
    expect(fonts).toEqual([{ family: 'cairo', source: 'google', weights: [700] }]);
  });
});

describe('font catalogue', () => {
  it('filters to Arabic faces and by search', () => {
    const arabic = filterFonts(CURATED_FONTS, { arabicOnly: true });
    expect(arabic.length).toBeGreaterThanOrEqual(15);
    expect(arabic.every((font) => font.arabic)).toBe(true);
    expect(filterFonts(CURATED_FONTS, { query: 'plex' }).map((font) => font.family)).toContain('IBM Plex Sans Arabic');
  });

  it('builds a token stack and reads its first family back', () => {
    expect(fontStack('Cairo', 'sans')).toBe('"Cairo", system-ui, sans-serif');
    expect(firstFamily(fontStack('Amiri', 'serif'))).toBe('Amiri');
  });

  it('loads only weights the family ships', () => {
    expect(weightsToLoad({ weights: [400] })).toEqual([400]);
    expect(weightsToLoad({ weights: [300, 400, 700, 800] })).toEqual([400, 700]);
    expect(weightsToLoad({ weights: [200] })).toEqual([200]);
  });
});
