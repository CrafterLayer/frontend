/*
  Bounded byte loading for `s.lib.audio` music (game libraries, 2026-10-12).

  Only the URLs `s.texture` admits, with `data:audio/…` instead of `data:image/…`. A data: URL is
  decoded in-process (no request, so it also works where the page forbids fetches); https: and
  blob: go through fetch with an AbortSignal so dispose() cancels them. Every track is capped at
  AUDIO_LIMITS.bytes before and after the download.
*/

import { admittedMediaUrl } from '../shared/media-url';

export const AUDIO_LIMITS = Object.freeze({
  /** Distinct music URLs one scene may load. */
  tracks: 6,
  /** Encoded bytes per track. */
  bytes: 12 * 1024 * 1024,
  /** Sound effects playing at once; more are skipped, not queued. */
  voices: 12,
  /** Synthesised effects kept ready (one per distinct parameter list). */
  cache: 24,
  /** Longest fade, ms. */
  fadeMs: 10_000,
});

function decodeDataUrl(url: string): ArrayBuffer {
  const comma = url.indexOf(',');
  if (comma < 0) throw new TypeError('audio: malformed data: URL');
  const header = url.slice(0, comma);
  const body = url.slice(comma + 1);
  // base64 grows bytes by 4/3: refuse before allocating anything.
  if (body.length > (AUDIO_LIMITS.bytes * 4) / 3 + 4)
    throw new RangeError('audio: track too large');
  if (/;base64$/iu.test(header)) {
    const binary = atob(body.replace(/\s+/gu, ''));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes.buffer;
  }
  return new TextEncoder().encode(decodeURIComponent(body)).buffer;
}

/** The encoded bytes of an admitted audio URL; rejects with a reason the scene can log. */
export async function loadAudioBytes(
  value: string,
  fetcher: typeof fetch | undefined,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  const url = admittedMediaUrl(value, 'audio');
  if (url === undefined) throw new TypeError('audio: only https:, data:audio/ and blob: URLs load');
  if (url.slice(0, 5).toLowerCase() === 'data:') return decodeDataUrl(url);
  if (fetcher === undefined) throw new Error('audio: this page cannot fetch');
  const response = await fetcher(url, { signal, credentials: 'omit' });
  if (!response.ok) throw new Error(`audio: HTTP ${String(response.status)}`);
  const declared = Number(response.headers.get('content-length') ?? '0');
  if (declared > AUDIO_LIMITS.bytes) throw new RangeError('audio: track too large');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > AUDIO_LIMITS.bytes) throw new RangeError('audio: track too large');
  return bytes;
}
