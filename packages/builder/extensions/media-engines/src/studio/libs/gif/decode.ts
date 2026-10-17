/*
  GIF frames for `s.lib.gif` (animated GIFs, 2026-10-13). gifuct-js 2.1.2 (MIT, the decoder
  pixi.js itself depends on for `pixi.js/gif`) parses the file and decompresses one frame at a
  time; this file composites each frame onto the previous ones in plain RGBA arrays, honouring
  the GIF disposal methods (leave, restore to background, restore to previous) and transparency.
  No canvas is read back, so it runs the same in a worker-free page, in tests and in the editor.

  Bounded by inspect.ts first. A GIF whose frames would exceed GIF_LIMITS.pixels (or .frames)
  keeps every 2nd, 3rd… frame, each holding its skipped neighbours' delay, so it plays for the
  same total time with fewer pictures instead of failing.
*/

import { decompressFrame, parseGIF, type ParsedGif } from 'gifuct-js';

import { GIF_LIMITS, inspectGif } from './inspect';

export interface GifFrame {
  /** width × height × 4 RGBA bytes: the whole picture at this frame. */
  readonly data: Uint8ClampedArray;
  /** Milliseconds from the start of the animation. */
  readonly start: number;
  end: number;
}

export interface DecodedGif {
  readonly width: number;
  readonly height: number;
  readonly frames: readonly GifFrame[];
  /** Milliseconds for one pass. */
  readonly duration: number;
  /** 1 when every frame was kept; n when every n-th was. */
  readonly stride: number;
  /** Frames in the file. */
  readonly sourceFrames: number;
}

type ParsedFrame = ParsedGif['frames'][number];
type ImageFrame = Extract<ParsedFrame, { image: unknown }>;

/** Browsers show a 0–1 centisecond delay as 100 ms; so do we. */
function delayOf(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 20) return fallback;
  return value;
}

/** A frame without a graphic control extension borrows the previous one's (as browsers do). */
function inheritControl(gif: ParsedGif): ImageFrame[] {
  const frames: ImageFrame[] = [];
  let control: ImageFrame['gce'] | undefined;
  for (const frame of gif.frames) {
    // gifuct-js types every frame as complete; real files omit the control block freely.
    const loose = frame as { gce?: ImageFrame['gce']; image?: unknown };
    if (loose.gce !== undefined) control = loose.gce;
    if (loose.image === undefined) continue;
    if (loose.gce === undefined && control !== undefined) loose.gce = control;
    frames.push(frame as ImageFrame);
  }
  return frames;
}

export function decodeGif(bytes: Uint8Array, defaultDelay = 100): DecodedGif {
  const info = inspectGif(bytes);
  const { width, height } = info;
  const pixels = width * height;
  const stride = Math.max(
    1,
    Math.ceil((info.frames * pixels) / GIF_LIMITS.pixels),
    Math.ceil(info.frames / GIF_LIMITS.frames),
  );
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gif = parseGIF(buffer as ArrayBuffer);
  const images = inheritControl(gif);
  const fallback = delayOf(defaultDelay, 100);

  const canvas = new Uint8ClampedArray(pixels * 4);
  const frames: GifFrame[] = [];
  let time = 0;
  images.forEach((image, index) => {
    const frame = decompressFrame(image, gif.gct, true);
    const { left, top, width: patchWidth, height: patchHeight } = frame.dims;
    const disposal = typeof frame.disposalType === 'number' ? frame.disposalType : 1;
    const delay = delayOf(frame.delay, fallback);
    const previous = disposal === 3 ? canvas.slice() : undefined;
    const patch = frame.patch;
    for (let y = 0; y < patchHeight; y += 1) {
      const row = top + y;
      if (row < 0 || row >= height) continue;
      for (let x = 0; x < patchWidth; x += 1) {
        const column = left + x;
        if (column < 0 || column >= width) continue;
        const from = (y * patchWidth + x) * 4;
        if ((patch[from + 3] ?? 0) === 0) continue;
        const to = (row * width + column) * 4;
        canvas[to] = patch[from] ?? 0;
        canvas[to + 1] = patch[from + 1] ?? 0;
        canvas[to + 2] = patch[from + 2] ?? 0;
        canvas[to + 3] = 255;
      }
    }
    if (index % stride === 0) {
      frames.push({ data: canvas.slice(), start: time, end: time + delay });
    } else {
      const kept = frames[frames.length - 1];
      if (kept !== undefined) kept.end += delay;
    }
    time += delay;
    if (disposal === 2) {
      // Restore to background: the frame's own rectangle becomes transparent.
      for (let y = Math.max(0, top); y < Math.min(height, top + patchHeight); y += 1) {
        const from = (y * width + Math.max(0, left)) * 4;
        const to = (y * width + Math.min(width, left + patchWidth)) * 4;
        if (to > from) canvas.fill(0, from, to);
      }
    } else if (previous !== undefined) {
      canvas.set(previous);
    }
  });
  if (frames.length === 0) throw new TypeError('gif: the GIF has no frames');
  return { width, height, frames, duration: time, stride, sourceFrames: images.length };
}
