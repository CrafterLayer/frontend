/*
  A GIF's shape read from its block structure before anything is decoded (animated GIFs,
  2026-10-13): the signature, the logical screen and every image descriptor, walking extension
  and image sub-blocks without decompressing them. `s.lib.gif` checks the result against
  GIF_LIMITS first, so a hostile or simply enormous file is refused in one linear pass instead of
  after gigabytes of frames have been allocated.
*/

export const GIF_LIMITS = Object.freeze({
  /** Encoded file size. */
  bytes: 12_000_000,
  /** Width and height of the logical screen and of every frame. */
  maxSide: 1024,
  /** Decoded pixels kept across all frames (× 4 bytes): longer GIFs keep every 2nd, 3rd… frame. */
  pixels: 8_000_000,
  /** Frames kept after thinning. */
  frames: 240,
  /** Frames a file may declare at all. */
  scanFrames: 4000,
  /** A fetch that has not answered by then is abandoned. */
  timeoutMs: 15_000,
});

export interface GifInfo {
  readonly width: number;
  readonly height: number;
  /** Image descriptors, i.e. frames. */
  readonly frames: number;
}

function word(bytes: Uint8Array, at: number): number {
  return (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
}

function colourTableBytes(packed: number): number {
  return packed & 0x80 ? 3 * (1 << ((packed & 0x07) + 1)) : 0;
}

/** Skip a run of sub-blocks (each led by its length, ended by 0); returns the next position. */
function skipSubBlocks(bytes: Uint8Array, from: number): number {
  let at = from;
  while (at < bytes.length) {
    const size = bytes[at] ?? 0;
    at += 1;
    if (size === 0) return at;
    at += size;
  }
  return at;
}

export function isGifSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 6) return false;
  const text = String.fromCharCode(...bytes.subarray(0, 6));
  return text === 'GIF87a' || text === 'GIF89a';
}

/** The GIF's screen size and frame count; throws for anything that is not a bounded GIF. */
export function inspectGif(bytes: Uint8Array): GifInfo {
  if (!isGifSignature(bytes) || bytes.length < 13) {
    throw new TypeError('gif: the data is not a GIF (no GIF87a/GIF89a signature)');
  }
  if (bytes.length > GIF_LIMITS.bytes) {
    throw new RangeError(`gif: the file is over ${String(GIF_LIMITS.bytes / 1_000_000)} MB`);
  }
  const width = word(bytes, 6);
  const height = word(bytes, 8);
  if (width === 0 || height === 0) throw new TypeError('gif: the GIF has no size');
  if (width > GIF_LIMITS.maxSide || height > GIF_LIMITS.maxSide) {
    throw new RangeError(
      `gif: ${String(width)}×${String(height)} is larger than ${String(GIF_LIMITS.maxSide)} px a side`,
    );
  }
  let at = 13 + colourTableBytes(bytes[10] ?? 0);
  let frames = 0;
  while (at < bytes.length) {
    const code = bytes[at];
    if (code === 0x21) {
      at = skipSubBlocks(bytes, at + 2);
    } else if (code === 0x2c) {
      if (at + 10 > bytes.length) break;
      const frameWidth = word(bytes, at + 5);
      const frameHeight = word(bytes, at + 7);
      if (frameWidth > GIF_LIMITS.maxSide || frameHeight > GIF_LIMITS.maxSide) {
        throw new RangeError('gif: a frame is larger than the limit');
      }
      frames += 1;
      if (frames > GIF_LIMITS.scanFrames) {
        throw new RangeError(`gif: more than ${String(GIF_LIMITS.scanFrames)} frames`);
      }
      at += 10 + colourTableBytes(bytes[at + 9] ?? 0) + 1;
      at = skipSubBlocks(bytes, at);
    } else {
      // The trailer (0x3B) or trailing bytes: the decoder stops here too.
      break;
    }
  }
  if (frames === 0) throw new TypeError('gif: the GIF has no frames');
  return { width, height, frames };
}
