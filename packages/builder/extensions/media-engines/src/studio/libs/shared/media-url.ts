/*
  The media URLs a Studio scene may load (pixi-studio §B.2; shared since 2026-10-12).

  `s.texture(url)` admitted `https:`, `data:image/…` and `blob:` from the start; `s.lib.audio`
  admits exactly the same schemes for sound (`data:audio/…` instead of `data:image/…`). One
  table, so the kit and the audio library cannot drift apart: no `http:`, no relative paths, no
  `javascript:`, no other data type.
*/

export type MediaKind = 'image' | 'audio';

const ADMITTED: Readonly<Record<MediaKind, RegExp>> = {
  image: /^(?:https:\/\/|data:image\/|blob:)/iu,
  audio: /^(?:https:\/\/|data:audio\/|blob:)/iu,
};

/** The trimmed URL when its scheme is admitted for `kind`, otherwise undefined. */
export function admittedMediaUrl(value: unknown, kind: MediaKind): string | undefined {
  if (typeof value !== 'string') return undefined;
  const url = value.trim();
  return ADMITTED[kind].test(url) ? url : undefined;
}
