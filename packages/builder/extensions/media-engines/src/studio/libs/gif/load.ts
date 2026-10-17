/*
  Where a GIF's bytes come from (animated GIFs, 2026-10-13). The URL rule is s.texture's
  (`https:`, `data:image/…`, `blob:`; shared/media-url.ts), narrowed to GIFs: a `data:image/gif`
  URL is decoded right here, so a GIF a person pasted works even where the page may not fetch
  (the unreviewed preview's `connect-src 'none'`); `https:` and `blob:` are fetched without
  credentials, with a time limit and a size limit, and must start with a GIF signature. Never an
  invented URL: the playbooks only pass URLs the person supplied or approved.
*/

import { admittedMediaUrl } from '../shared/media-url';
import { GIF_LIMITS } from './inspect';

type Fetcher = (
  input: string,
  init: { credentials: 'omit'; signal?: AbortSignal },
) => Promise<{
  ok: boolean;
  status: number;
  headers?: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

const DATA_GIF = /^data:image\/gif(?:;[^,]*)?,/iu;

function decodeDataUrl(url: string): Uint8Array {
  const comma = url.indexOf(',');
  const meta = url.slice(0, comma);
  const body = url.slice(comma + 1);
  if (body.length > GIF_LIMITS.bytes * 1.4) throw new RangeError('gif: the data: URL is too large');
  if (/;base64$/iu.test(meta)) {
    const binary = atob(body.replace(/\s+/gu, ''));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0) & 0xff);
  }
  // RFC 2397: percent-encoded octets (not UTF-8 text, so no decodeURIComponent).
  const bytes: number[] = [];
  for (let index = 0; index < body.length; index += 1) {
    const hex = body.slice(index + 1, index + 3);
    if (body[index] === '%' && /^[\da-f]{2}$/iu.test(hex)) {
      bytes.push(Number.parseInt(hex, 16));
      index += 2;
    } else {
      bytes.push(body.charCodeAt(index) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

/** The GIF's bytes, or a rejection that says which rule refused it. */
export async function readGifBytes(value: unknown, fetcher?: Fetcher): Promise<Uint8Array> {
  const url = admittedMediaUrl(value, 'image');
  if (url === undefined) {
    throw new TypeError(
      `gif: only https:, data:image/gif and blob: URLs load (got "${String(value).slice(0, 60)}")`,
    );
  }
  if (url.toLowerCase().startsWith('data:')) {
    if (!DATA_GIF.test(url)) throw new TypeError('gif: a data: URL must be data:image/gif');
    return decodeDataUrl(url);
  }
  const fetchFn = fetcher ?? globalThis.fetch;
  if (typeof fetchFn !== 'function') throw new Error('gif: this page cannot fetch');
  const controller = typeof AbortController === 'function' ? new AbortController() : undefined;
  const timer = setTimeout(() => controller?.abort(), GIF_LIMITS.timeoutMs);
  try {
    const response = await fetchFn(url, {
      credentials: 'omit',
      ...(controller === undefined ? {} : { signal: controller.signal }),
    });
    if (!response.ok)
      throw new Error(`gif: the GIF did not load (HTTP ${String(response.status)})`);
    const declared = Number(response.headers?.get('content-length') ?? '0');
    if (declared > GIF_LIMITS.bytes) throw new RangeError('gif: the file is too large');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > GIF_LIMITS.bytes) throw new RangeError('gif: the file is too large');
    return bytes;
  } finally {
    clearTimeout(timer);
  }
}
