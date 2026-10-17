/**
 * Video and map addresses (media-motion DESIGN §A.3, §E, §F.1 — 2026-10-06).
 *
 * Pure string work: this package sees no `URL` global (no DOM, no Node types),
 * so addresses are read with anchored patterns. Every refusal is repair text
 * the agent can act on in one round.
 */

/** A video address, classified. */
export type VideoUrlClass =
  | { readonly kind: 'youtube'; readonly id: string }
  | { readonly kind: 'vimeo'; readonly id: string }
  | { readonly kind: 'file'; readonly src: string; readonly type: 'video/mp4' | 'video/webm' }
  | { readonly error: string };

/** The repair text for an HLS stream. */
export const VIDEO_HLS_REFUSAL = 'HLS needs the pro player; give an mp4/webm';

/** The repair text for any other address. */
export const VIDEO_URL_REFUSAL =
  'a video is a YouTube link (youtube.com/watch?v=ID, youtu.be/ID, youtube.com/shorts/ID), a Vimeo link (vimeo.com/123456) or an https or uploaded (/…) .mp4 or .webm file';

const ABSOLUTE = /^(https?):\/\/([^/?#\s]+)([^?#\s]*)(\?[^#\s]*)?(#\S*)?$/iu;
const YOUTUBE_ID = /^[\w-]{11}$/u;
const UNSAFE = /[\s"'<>\\`]/u;

/** A watch / youtu.be / shorts / embed address → its 11-character id. */
function youtubeId(host: string, path: string, query: string): string | undefined {
  if (host === 'youtu.be') return /^\/([\w-]{11})\/?$/u.exec(path)?.[1];
  if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com') {
    if (path === '/watch' || path === '/watch/') {
      return /(?:^\?|&)v=([\w-]{11})(?:&|$)/u.exec(query)?.[1];
    }
    return /^\/(?:shorts|embed|live)\/([\w-]{11})\/?$/u.exec(path)?.[1];
  }
  if (host === 'www.youtube-nocookie.com' || host === 'youtube-nocookie.com') {
    return /^\/embed\/([\w-]{11})\/?$/u.exec(path)?.[1];
  }
  return undefined;
}

/** A vimeo.com/N or player.vimeo.com/video/N address → its numeric id. */
function vimeoId(host: string, path: string): string | undefined {
  if (host === 'vimeo.com' || host === 'www.vimeo.com') {
    return /^\/(?:channels\/[\w-]+\/)?(\d{1,12})\/?$/u.exec(path)?.[1];
  }
  if (host === 'player.vimeo.com') return /^\/video\/(\d{1,12})\/?$/u.exec(path)?.[1];
  return undefined;
}

function fileType(path: string): 'video/mp4' | 'video/webm' | undefined {
  if (/\.mp4$/iu.test(path)) return 'video/mp4';
  if (/\.webm$/iu.test(path)) return 'video/webm';
  return undefined;
}

/**
 * What kind of video an address is: a YouTube or Vimeo page (shown through the
 * privacy facade), or an https / root-relative `.mp4` / `.webm` file (the
 * player or a background). HLS (`.m3u8`) and everything else are refused.
 */
export function classifyVideoUrl(url: string): VideoUrlClass {
  const value = url.trim();
  if (value === '' || value.length > 2_000 || UNSAFE.test(value)) return { error: VIDEO_URL_REFUSAL };
  if (/\.m3u8(?:[?#]|$)/iu.test(value)) return { error: VIDEO_HLS_REFUSAL };
  if (value.startsWith('/') && !value.startsWith('//')) {
    const path = value.replace(/[?#].*$/u, '');
    const type = fileType(path);
    return type === undefined ? { error: VIDEO_URL_REFUSAL } : { kind: 'file', src: value, type };
  }
  const parts = ABSOLUTE.exec(value);
  if (parts === null) return { error: VIDEO_URL_REFUSAL };
  const scheme = (parts[1] ?? '').toLowerCase();
  const host = (parts[2] ?? '').toLowerCase();
  const path = parts[3] ?? '';
  const query = parts[4] ?? '';
  const youtube = youtubeId(host, path, query);
  if (youtube !== undefined) return { kind: 'youtube', id: youtube };
  const vimeo = vimeoId(host, path);
  if (vimeo !== undefined) return { kind: 'vimeo', id: vimeo };
  const type = fileType(path);
  if (type === undefined) return { error: VIDEO_URL_REFUSAL };
  if (scheme !== 'https') return { error: `the video file must be https: ${VIDEO_URL_REFUSAL}` };
  return { kind: 'file', src: value, type };
}

/** The canonical YouTube page for an id (the facade's no-script link). */
export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/** The canonical Vimeo page for an id (the facade's no-script link). */
export function vimeoPageUrl(id: string): string {
  return `https://vimeo.com/${id}`;
}

/** YouTube's own still for an id (480×360), used when no catalog poster fits (DESIGN Q3). */
export function youtubeThumb(id: string): string {
  return `https://i.ytimg.com/vi/${YOUTUBE_ID.test(id) ? id : 'invalid'}/hqdefault.jpg`;
}

/**
 * The embed the facade swaps in on click, autoplaying (the click was the
 * consent). Both match `CUSTOM_CODE_IFRAME_SOURCES`.
 */
export function videoEmbedUrl(video: { readonly kind: 'youtube' | 'vimeo'; readonly id: string }): string {
  return video.kind === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1`
    : `https://player.vimeo.com/video/${video.id}?autoplay=1`;
}

/** An address, encoded for a Maps query: everything the embed pattern refuses is escaped. */
function mapsQuery(address: string): string | undefined {
  const trimmed = address.trim().replace(/\s+/gu, ' ');
  if (trimmed === '' || trimmed.length > 300) return undefined;
  return encodeURIComponent(trimmed).replace(/'/gu, '%27');
}

/**
 * The keyless Google Maps embed for an address
 * (`https://www.google.com/maps?q=<encoded>&output=embed`), or undefined for an
 * empty or over-long (> 300 characters) address.
 */
export function mapsEmbedUrl(address: string): string | undefined {
  const query = mapsQuery(address);
  return query === undefined ? undefined : `https://www.google.com/maps?q=${query}&output=embed`;
}

/** The Google Maps page for an address: the map facade's no-script link. */
export function mapsLinkUrl(address: string): string | undefined {
  const query = mapsQuery(address);
  return query === undefined ? undefined : `https://www.google.com/maps?q=${query}`;
}
