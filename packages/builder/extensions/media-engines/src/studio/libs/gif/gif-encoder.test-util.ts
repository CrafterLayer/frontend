/*
  A tiny GIF89a writer for the gif library's tests (animated GIFs, 2026-10-13): a four-colour
  global palette and "uncompressed" LZW (a clear code before every pixel, so the code width never
  grows). Big and slow, but every byte is predictable, which is what a decoder test needs.
*/

export interface TestFrame {
  /** Palette indices, row by row, `width × height` of this frame. */
  readonly pixels: readonly number[];
  readonly left?: number;
  readonly top?: number;
  readonly width?: number;
  readonly height?: number;
  /** Centiseconds (GIF units). */
  readonly delay?: number;
  /** 0/1 leave, 2 restore to background, 3 restore to previous. */
  readonly disposal?: number;
  /** Palette index drawn as transparent. */
  readonly transparent?: number;
  /** Write no graphic control extension for this frame. */
  readonly noControl?: boolean;
}

function word(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff];
}

function lzw(pixels: readonly number[]): number[] {
  const clear = 4;
  const end = 5;
  const codes: number[] = [];
  for (const pixel of pixels) codes.push(clear, pixel & 0x03);
  codes.push(end);
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const code of codes) {
    buffer |= code << bits;
    bits += 3;
    while (bits >= 8) {
      bytes.push(buffer & 0xff);
      buffer >>= 8;
      bits -= 8;
    }
  }
  if (bits > 0) bytes.push(buffer & 0xff);
  const blocks: number[] = [];
  for (let at = 0; at < bytes.length; at += 255) {
    const chunk = bytes.slice(at, at + 255);
    blocks.push(chunk.length, ...chunk);
  }
  blocks.push(0);
  return blocks;
}

export function encodeGif(
  width: number,
  height: number,
  palette: readonly (readonly [number, number, number])[],
  frames: readonly TestFrame[],
): Uint8Array {
  const out: number[] = [...Array.from('GIF89a', (char) => char.charCodeAt(0))];
  out.push(...word(width), ...word(height), 0x91, 0, 0);
  for (let index = 0; index < 4; index += 1) out.push(...(palette[index] ?? [0, 0, 0]));
  out.push(0x21, 0xff, 0x0b, ...Array.from('NETSCAPE2.0', (char) => char.charCodeAt(0)));
  out.push(0x03, 0x01, 0x00, 0x00, 0x00);
  for (const frame of frames) {
    if (frame.noControl !== true) {
      const transparent = frame.transparent !== undefined;
      const packed = ((frame.disposal ?? 0) << 2) | (transparent ? 1 : 0);
      out.push(0x21, 0xf9, 0x04, packed, ...word(frame.delay ?? 10), frame.transparent ?? 0, 0);
    }
    out.push(
      0x2c,
      ...word(frame.left ?? 0),
      ...word(frame.top ?? 0),
      ...word(frame.width ?? width),
      ...word(frame.height ?? height),
      0,
    );
    out.push(2, ...lzw(frame.pixels));
  }
  out.push(0x3b);
  return Uint8Array.from(out);
}

export function base64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
