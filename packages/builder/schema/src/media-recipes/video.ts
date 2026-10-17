import { safeCustomCodeUrl, type CustomCodeNode } from '../custom-code/custom-code-tree';
import {
  el,
  imageNode,
  inLocale,
  isPlainAddress,
  localeAttributes,
  mediaRecipeNode,
  mediaSection,
  root,
  type MediaHeading,
  type MediaImage,
  type MediaLocale,
  type MediaRecipeResult,
} from './types';
import { classifyVideoUrl, vimeoPageUrl, youtubeThumb, youtubeWatchUrl } from './urls';

/**
 * Video recipes (media-motion DESIGN §A.1).
 *
 * - `video-player`: our chrome over a native `<video controls>` — with no script
 *   the native controls are the player.
 * - `embed-facade`: a YouTube / Vimeo page as a plain link with a poster; the
 *   runtime swaps in the privacy-enhanced iframe on click, so the page makes no
 *   third-party request until the reader asks.
 * - `bg-video`: a muted loop behind a section's content. The tree carries NO
 *   `autoplay`: the runtime plays it only in view and never under reduced
 *   motion, and the no-script view shows the poster.
 */

/** A poster: an address, or a resolved catalog image. */
export type VideoPoster = string | MediaImage;

/** Captions: a WebVTT address (in the page language), or one with its language. */
export type VideoCaptions = string | { readonly src: string; readonly srclang?: string | undefined };

/** A video file the player or a background plays. */
export interface VideoFile {
  readonly src: string;
  readonly type: 'video/mp4' | 'video/webm';
}

function posterSrc(poster: VideoPoster | undefined): string | undefined | { error: string } {
  if (poster === undefined) return undefined;
  const src = typeof poster === 'string' ? poster : poster.src;
  return safeCustomCodeUrl(src) !== undefined && isPlainAddress(src.trim())
    ? src.trim()
    : { error: 'the poster must be an https or uploaded (/…) image address' };
}

function fileProblem(file: VideoFile): string | undefined {
  const src = file.src.trim();
  return safeCustomCodeUrl(src) !== undefined && isPlainAddress(src)
    ? undefined
    : 'the video file must be an https or uploaded (/…) address';
}

/** Options of the player. */
export interface VideoPlayerOptions extends VideoFile {
  readonly poster?: VideoPoster | undefined;
  readonly captions?: VideoCaptions | undefined;
  readonly title?: string | undefined;
}

/** `figure[data-ck-behavior=video-player]` around a native video (element-level). */
export function buildVideoPlayer(locale: MediaLocale, options: VideoPlayerOptions): MediaRecipeResult {
  const problem = fileProblem(options);
  if (problem !== undefined) return { error: problem };
  const poster = posterSrc(options.poster);
  if (typeof poster === 'object') return poster;
  const captions =
    options.captions === undefined
      ? undefined
      : typeof options.captions === 'string'
        ? { src: options.captions, srclang: locale }
        : { src: options.captions.src, srclang: options.captions.srclang ?? locale };
  if (
    captions !== undefined &&
    (safeCustomCodeUrl(captions.src) === undefined || !isPlainAddress(captions.src.trim()))
  ) {
    return { error: 'captions must be an https or uploaded (/…) .vtt address' };
  }
  const tracks: CustomCodeNode[] = [
    el('source', undefined, { src: options.src.trim(), type: options.type }),
  ];
  if (captions !== undefined) {
    tracks.push(
      el('track', undefined, {
        kind: 'captions',
        src: captions.src.trim(),
        srclang: /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u.test(captions.srclang)
          ? captions.srclang
          : locale,
      }),
    );
  }
  const title = options.title?.trim() ?? '';
  const children: CustomCodeNode[] = [
    el(
      'video',
      'block size-full object-cover',
      { controls: '', playsinline: '', preload: 'metadata', poster },
      tracks,
    ),
  ];
  if (title !== '') {
    children.push(
      el(
        'figcaption',
        'pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent p-4 text-sm font-semibold text-white',
        undefined,
        undefined,
        title,
      ),
    );
  }
  return {
    label: { ar: 'مشغل فيديو', en: 'Video player' },
    tree: root(
      el(
        'figure',
        'relative aspect-video overflow-hidden rounded-xl bg-black',
        { 'data-ck-behavior': 'video-player' },
        children,
      ),
    ),
    css: '',
  };
}

/** Options of the facade. */
export interface VideoFacadeOptions {
  readonly video: { readonly kind: 'youtube' | 'vimeo'; readonly id: string };
  /** A catalog poster; a YouTube video falls back to its own still, a Vimeo one to a dark frame. */
  readonly poster?: VideoPoster | undefined;
  readonly title?: string | undefined;
}

/** `a[data-ck-behavior=embed-facade]`: a link with a poster until the reader clicks (element-level). */
export function buildVideoFacade(locale: MediaLocale, options: VideoFacadeOptions): MediaRecipeResult {
  const { video } = options;
  const valid = video.kind === 'youtube' ? /^[\w-]{11}$/u.test(video.id) : /^\d{1,12}$/u.test(video.id);
  if (!valid) return { error: `not a ${video.kind === 'youtube' ? 'YouTube' : 'Vimeo'} video id: ${video.id}` };
  const given = posterSrc(options.poster);
  if (typeof given === 'object') return given;
  const poster = given ?? (video.kind === 'youtube' ? youtubeThumb(video.id) : undefined);
  const title = options.title?.trim() ?? '';
  const name =
    title === '' ? inLocale(locale, { ar: 'الفيديو', en: 'the video' }) : title;
  const children: CustomCodeNode[] = [];
  if (poster !== undefined) {
    const image: MediaImage =
      typeof options.poster === 'object'
        ? options.poster
        : given === undefined
          ? { src: poster, alt: '', width: 480, height: 360 }
          : { src: poster, alt: '' };
    children.push(
      imageNode(
        image,
        'size-full object-cover transition duration-300 group-hover:scale-105 motion-reduce:transform-none',
        { decorative: true },
      ),
    );
  }
  children.push(el('span', 'ck-play-badge', { 'aria-hidden': 'true' }));
  return {
    label: { ar: 'فيديو', en: 'Video' },
    tree: root(
      el(
        'a',
        'group relative block aspect-video overflow-hidden rounded-xl bg-black',
        {
          'data-ck-behavior': 'embed-facade',
          href: video.kind === 'youtube' ? youtubeWatchUrl(video.id) : vimeoPageUrl(video.id),
          'aria-label': `${inLocale(locale, { ar: 'شغّل', en: 'Play' })}: ${name}`,
        },
        children,
      ),
    ),
    css: '',
  };
}

/** Options of a background layer. */
export interface BgVideoLayerOptions extends VideoFile {
  readonly poster?: VideoPoster | undefined;
}

/**
 * The background `<video>` layer (element-level): the FIRST child of a
 * `section[data-ck-behavior=bg-video]` that is `relative isolate overflow-hidden`
 * (`BG_VIDEO_HOST`). Muted, looped, inline, decorative — and no `autoplay`.
 */
export function buildBgVideoLayer(options: BgVideoLayerOptions): MediaRecipeResult {
  const problem = fileProblem(options);
  if (problem !== undefined) return { error: problem };
  const poster = posterSrc(options.poster);
  if (typeof poster === 'object') return poster;
  return {
    label: { ar: 'فيديو خلفية', en: 'Background video' },
    tree: root(
      el(
        'video',
        'absolute inset-0 -z-10 size-full object-cover',
        {
          muted: '',
          loop: '',
          playsinline: '',
          preload: 'metadata',
          poster,
          'aria-hidden': 'true',
        },
        [el('source', undefined, { src: options.src.trim(), type: options.type })],
      ),
    ),
    css: '',
  };
}

/** What a section must carry to host a background video layer as its first child. */
export const BG_VIDEO_HOST = {
  attributes: { 'data-ck-behavior': 'bg-video' },
  className: 'relative isolate overflow-hidden',
} as const;

/** Options of a whole video section. */
export interface VideoSectionOptions {
  /** `player` (default) or `background`; YouTube / Vimeo always play through the facade. */
  readonly mode?: 'player' | 'background' | 'facade' | undefined;
  readonly url: string;
  readonly poster?: VideoPoster | undefined;
  readonly captions?: VideoCaptions | undefined;
  readonly title?: string | undefined;
  /** A line under the title of a background section. */
  readonly text?: string | undefined;
  readonly heading?: MediaHeading | undefined;
}

/** A standalone video section: a player, a facade, or a hero over a background video. */
export function buildVideoSection(locale: MediaLocale, options: VideoSectionOptions): MediaRecipeResult {
  const video = classifyVideoUrl(options.url);
  if ('error' in video) return video;
  const section = { locale, title: options.title, heading: options.heading };
  if (video.kind === 'youtube' || video.kind === 'vimeo') {
    if (options.mode === 'background') {
      return {
        error:
          'a background video needs an https or uploaded .mp4/.webm file; YouTube and Vimeo play through the facade (mode player)',
      };
    }
    const facade = buildVideoFacade(locale, { video, poster: options.poster, title: options.title });
    if ('error' in facade) return facade;
    return {
      label: facade.label,
      tree: root(mediaSection(section, [mediaRecipeNode(facade)], 'max-w-5xl')),
      css: '',
    };
  }
  if (options.mode === 'background') {
    const layer = buildBgVideoLayer({ src: video.src, type: video.type, poster: options.poster });
    if ('error' in layer) return layer;
    const title = options.title?.trim() ?? '';
    const text = options.text?.trim() ?? '';
    const content: CustomCodeNode[] = [];
    if (title !== '') {
      content.push(
        el(
          options.heading ?? 'h2',
          'text-4xl font-bold leading-tight text-balance md:text-6xl',
          undefined,
          undefined,
          title,
        ),
      );
    }
    if (text !== '') content.push(el('p', 'mt-4 text-lg text-white/80', undefined, undefined, text));
    return {
      label: layer.label,
      tree: root(
        el(
          'section',
          `${BG_VIDEO_HOST.className} bg-black py-32 text-white md:py-48`,
          { ...BG_VIDEO_HOST.attributes, ...localeAttributes(locale) },
          [
            mediaRecipeNode(layer),
            el('div', 'absolute inset-0 -z-10 bg-black/50', { 'aria-hidden': 'true' }),
            el('div', 'relative mx-auto max-w-4xl px-4 text-center md:px-8', undefined, content),
          ],
        ),
      ),
      css: '',
    };
  }
  const player = buildVideoPlayer(locale, {
    src: video.src,
    type: video.type,
    poster: options.poster,
    captions: options.captions,
  });
  if ('error' in player) return player;
  return {
    label: player.label,
    tree: root(mediaSection(section, [mediaRecipeNode(player)], 'max-w-5xl')),
    css: '',
  };
}
