import { classifyVideoUrl, VIDEO_URL_REFUSAL, type VideoUrlClass } from '@craftkit/builder-schema';

/**
 * Video addresses for `media.add` (media-motion DESIGN §A.3, §F.1).
 *
 * A video comes from the request, never from memory: there is no video
 * catalog, so no address means no video (the direct reading falls back to the
 * model, which asks). YouTube and Vimeo pages play through the privacy facade;
 * an https or uploaded `.mp4`/`.webm` plays in our player or as a background;
 * HLS and everything else are refused with the forms that work.
 */

export type ResolvedVideo = Exclude<VideoUrlClass, { readonly error: string }>;

export type VideoResolution =
  | { readonly ok: true; readonly video: ResolvedVideo }
  | { readonly ok: false; readonly error: string };

/** A video address: an http(s) link or a root-relative upload path. */
export const VIDEO_ADDRESS = /^(?:https?:\/\/\S+|\/(?!\/)\S+)$/iu;

export function resolveVideo(url: unknown): VideoResolution {
  if (typeof url !== 'string' || url.trim() === '') {
    return { ok: false, error: `"url" is required: ${VIDEO_URL_REFUSAL}. A video is never invented; ask the person for its address.` };
  }
  const video = classifyVideoUrl(url);
  if ('error' in video) return { ok: false, error: `"url": ${video.error}` };
  return { ok: true, video };
}
