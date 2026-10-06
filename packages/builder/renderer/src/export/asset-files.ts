/**
 * Uploaded pictures leave the published HTML as files (page-defects,
 * 2026-10-06).
 *
 * An upload is stored as a `data:` URL, and the static render wrote it
 * straight into every `src`, `srcset` and `url()` that showed it: a 2 MB
 * photo became 2.7 MB of base64 inside `index.html`, repeated on every page
 * that showed it, uncacheable, and parsed before the first paint. The export
 * now writes each distinct picture (and uploaded web font) ONCE, as
 * `assets/images/<content hash>.<ext>`, and every reference points at it —
 * relative to the page (`../assets/images/…`) or to the stylesheet
 * (`images/…`, beside it in `assets/`).
 *
 * The name is a hash of the bytes, so the same picture on two pages is one
 * file and a changed picture is a new name (safe to cache forever). A data
 * URL that does not decode is left as it was: a broken reference is worse
 * than an inline one.
 */

const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'font/woff2': 'woff2',
  'font/woff': 'woff',
  'font/ttf': 'ttf',
  'font/otf': 'otf',
};

/** Text formats are written as text; everything else as bytes. */
const TEXT_TYPES: ReadonlySet<string> = new Set(['image/svg+xml']);

/*
  `data:<type>[;params];base64,<body>` — the form an upload takes
  (`FileReader.readAsDataURL`). The base64 alphabet ends the body cleanly
  wherever it sits: at the quote of a `src`, the space of a `srcset`
  candidate, the `)` of a `url()`, the `&quot;` of an escaped style. A text
  data URL (a hand-written, percent-encoded SVG) has no such edge inside
  HTML, where quotes are escaped, so it stays inline: it is small, and a
  half-matched one would be a broken picture.
*/
const DATA_URL = /data:((?:image|font)\/[a-z0-9.+-]+)((?:;[a-z0-9-]+=[^;,"'\s)&]+)*);base64,([A-Za-z0-9+/]+={0,2})/giu;

export interface ExportedAssetFile {
  readonly path: string;
  /** The file's text (an SVG), or '' when `bytes` holds it. */
  readonly content: string;
  /** A binary file's bytes (PNG, JPEG, WebP, a font). */
  readonly bytes?: Uint8Array;
}

function decodeBase64(body: string): Uint8Array | undefined {
  if (body.length % 4 === 1) return undefined;
  try {
    const binary = atob(body);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return undefined;
  }
}

/** A 64-bit FNV-1a of the bytes, as 16 hex digits: a stable, collision-checked file name. */
function contentHash(bytes: Uint8Array): string {
  let high = 0xcbf29ce4;
  let low = 0x84222325;
  for (const byte of bytes) {
    low = (low ^ byte) >>> 0;
    // Multiply the 64-bit (high, low) by the FNV prime 0x100000001b3.
    const lowProduct = low * 0x1b3;
    const carry = Math.floor(lowProduct / 0x1_0000_0000);
    const nextLow = lowProduct >>> 0;
    high = (Math.imul(high, 0x1b3) + Math.imul(low, 0x100) + carry) >>> 0;
    low = nextLow;
  }
  return `${high.toString(16).padStart(8, '0')}${low.toString(16).padStart(8, '0')}`;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) if (a[index] !== b[index]) return false;
  return true;
}

export interface AssetFileWriter {
  /**
   * `text` with every decodable picture/font data URL replaced by
   * `${prefix}images/<name>` — `prefix` is where `assets/` is from the file
   * the text lands in (`'../assets/'` for a page one level down, `''` for a
   * stylesheet inside `assets/`).
   */
  rewrite(text: string, prefix: string): string;
  /** Every distinct file written so far, in first-seen order. */
  files(): readonly ExportedAssetFile[];
}

export function createAssetFileWriter(): AssetFileWriter {
  const byUrl = new Map<string, string>();
  const byName = new Map<string, Uint8Array>();
  const written: ExportedAssetFile[] = [];

  const nameFor = (match: string, type: string, body: string): string | undefined => {
    const known = byUrl.get(match);
    if (known !== undefined) return known;
    const extension = EXTENSIONS[type.toLowerCase()];
    if (extension === undefined) return undefined;
    const isText = TEXT_TYPES.has(type.toLowerCase());
    const bytes = decodeBase64(body);
    if (bytes === undefined || bytes.length === 0) return undefined;
    const content = isText ? new TextDecoder().decode(bytes) : '';
    const hash = contentHash(bytes);
    let name = `${hash}.${extension}`;
    for (let n = 2; byName.has(name) && !sameBytes(byName.get(name) ?? new Uint8Array(), bytes); n += 1) {
      name = `${hash}-${String(n)}.${extension}`;
    }
    if (!byName.has(name)) {
      byName.set(name, bytes);
      written.push(isText ? { path: `assets/images/${name}`, content } : { path: `assets/images/${name}`, content: '', bytes });
    }
    byUrl.set(match, name);
    return name;
  };

  return {
    rewrite(text, prefix) {
      if (!text.includes('data:')) return text;
      return text.replace(DATA_URL, (match, type: string, _params: string, body: string) => {
        const name = nameFor(match, type, body);
        return name === undefined ? match : `${prefix}images/${name}`;
      });
    },
    files() {
      return [...written];
    },
  };
}
