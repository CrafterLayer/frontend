import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  browserImageCodec,
  fitWithin,
  IMAGE_UPLOAD_MAX_BYTES,
  prepareImageUpload,
  type EncodeRequest,
  type ImageCodec,
} from './image-upload';

const photo = (type = 'image/jpeg') => new Blob([new Uint8Array([1, 2, 3])], { type });

function fakeCodec(width: number, height: number, sizes: readonly number[] = [1000]): ImageCodec & {
  requests: EncodeRequest[];
  closed: number;
} {
  const requests: EncodeRequest[] = [];
  let calls = 0;
  const codec = {
    requests,
    closed: 0,
    decode: () =>
      Promise.resolve({
        width,
        height,
        source: {} as CanvasImageSource,
        close: () => {
          codec.closed += 1;
        },
      }),
    encode: (request: EncodeRequest) => {
      requests.push(request);
      const size = sizes[Math.min(calls, sizes.length - 1)] ?? 1000;
      calls += 1;
      return Promise.resolve(new Blob([new Uint8Array(size)], { type: 'image/webp' }));
    },
  };
  return codec;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('image upload', () => {
  it('fits the longer edge within 2400px and never upscales', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 2400, height: 1800 });
    expect(fitWithin(1200, 5000)).toEqual({ width: 576, height: 2400 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('downscales a large photo and encodes WebP at q 0.85 into a data URL', async () => {
    const codec = fakeCodec(6000, 4000);
    const result = await prepareImageUpload(photo(), { codec });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(codec.requests[0]).toMatchObject({ sx: 0, sy: 0, sw: 6000, sh: 4000, width: 2400, height: 1600, quality: 0.85 });
    expect(result.image).toMatchObject({ width: 2400, height: 1600, bytes: 1000 });
    expect(result.image.dataUrl.startsWith('data:image/webp;base64,')).toBe(true);
    expect(codec.closed).toBe(1);
  });

  it('crops destructively before the downscale', async () => {
    const codec = fakeCodec(4000, 2000);
    await prepareImageUpload(photo(), { codec, crop: { aspect: 'square', x: 100, y: 50 } });
    expect(codec.requests[0]).toMatchObject({ sx: 2000, sy: 0, sw: 2000, sh: 2000, width: 2000, height: 2000 });
  });

  it('steps the quality down, then refuses past 2 MB', async () => {
    const big = IMAGE_UPLOAD_MAX_BYTES + 1;
    const second = await prepareImageUpload(photo(), { codec: fakeCodec(3000, 3000, [big, 900]) });
    expect(second.ok).toBe(true);
    const codec = fakeCodec(3000, 3000, [big]);
    expect(await prepareImageUpload(photo(), { codec })).toEqual({ ok: false, reason: 'too-large' });
    expect(codec.requests.map((request) => request.quality)).toEqual([0.85, 0.72, 0.6]);
  });

  it('refuses what is not a picture, and a picture that will not decode', async () => {
    expect(await prepareImageUpload(photo('text/plain'), { codec: fakeCodec(1, 1) })).toEqual({
      ok: false,
      reason: 'not-image',
    });
    const broken: ImageCodec = { decode: () => Promise.reject(new Error('x')), encode: vi.fn() };
    expect(await prepareImageUpload(photo(), { codec: broken })).toEqual({ ok: false, reason: 'decode-failed' });
  });

  it('draws through OffscreenCanvas in the browser codec (canvas mocked)', async () => {
    const drawImage = vi.fn();
    const convertToBlob = vi.fn(() => Promise.resolve(new Blob(['x'], { type: 'image/webp' })));
    class FakeOffscreen {
      constructor(
        readonly width: number,
        readonly height: number,
      ) {}
      getContext = () => ({ drawImage });
      convertToBlob = convertToBlob;
    }
    const close = vi.fn();
    vi.stubGlobal('OffscreenCanvas', FakeOffscreen);
    vi.stubGlobal('createImageBitmap', () => Promise.resolve({ width: 5000, height: 2500, close }));

    const result = await prepareImageUpload(photo());
    expect(result.ok && result.image.width).toBe(2400);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 5000, 2500, 0, 0, 2400, 1200);
    expect(convertToBlob).toHaveBeenCalledWith({ type: 'image/webp', quality: 0.85 });
    expect(close).toHaveBeenCalled();
    expect(browserImageCodec).toBeDefined();
  });
});
