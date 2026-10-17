import type { BuilderKernel } from '@craftkit/builder-core';
import { safeCustomCodeUrl, type MediaImage, type MediaLocale } from '@craftkit/builder-schema';

import { isArtSpec, resolveArtImage } from '../art-catalog/runtime';
import { selectCatalogPhotos, type CatalogPhoto } from '../context/providers/photo-catalog';
import {
  PHOTO_CATALOG_ENTRIES,
  PHOTO_TOPIC_KEYWORDS,
  type PhotoCatalogEntry,
  type PhotoTopic,
} from '../context/providers/photo-catalog.data';
import { srcsetFor } from '../section-kit/srcset';
import { isArabicLocale, isElement, isRecord, readTree, rootChildren, treeNodes } from '../tools/agent/shared';
import type { AgentToolContext } from '../tools/agent/types';

/**
 * Images for the media tools (media-motion DESIGN §F.1, 2026-10-06).
 *
 * The model never writes an image address or its alt text: `'catalog:<topic>'`
 * (or no `images` at all, the page's own topic) resolves to VERIFIED catalog
 * photos with their alt in the page language, intrinsic width/height and a
 * responsive srcset, skipping the photos the page already shows. An address
 * the person gave (an upload, a link in the chat) passes as `[{src,alt}]`,
 * checked the way the door checks an `img src`.
 */

/** What an `images` field asks for, parsed. */
export type ImagesRequest =
  | { readonly kind: 'catalog'; readonly topic?: string | undefined }
  | { readonly kind: 'list'; readonly images: readonly GivenImage[] };

/**
 * An image the call names: an address with its alt, or (art catalog,
 * 2026-10-14) an art spec — 'logo:stripe', 'character:<style>:<seed>',
 * 'illustration:doctor' — resolved when the tool runs, alt optional.
 */
export type GivenImage =
  | MediaImage
  | {
      readonly art: string;
      readonly alt?: string | undefined;
      readonly caption?: string | undefined;
    };

export type Resolved<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

const TOPICS = Object.keys(PHOTO_TOPIC_KEYWORDS) as PhotoTopic[];

/** Topic words people use that are not a catalog topic's name (DESIGN §F.1: food is restaurant). */
const TOPIC_ALIASES: Readonly<Record<string, PhotoTopic>> = {
  food: 'restaurant',
  dishes: 'restaurant',
  dining: 'restaurant',
  coffee: 'cafe',
  dessert: 'sweets',
  desserts: 'sweets',
  property: 'realestate',
  'real-estate': 'realestate',
  'real estate': 'realestate',
  dentist: 'dental',
  clinic: 'medical',
  fitness: 'gym',
  // media-motion fix pass (2026-10-06): «معرض صور للأطباق» named no topic and filled from the cafe.
  اطباق: 'restaurant',
  اكل: 'restaurant',
  اكلات: 'restaurant',
  طعام: 'restaurant',
  مطعم: 'restaurant',
  وجبات: 'restaurant',
  مشاوي: 'restaurant',
  قهوه: 'cafe',
  كافيه: 'cafe',
  حلويات: 'sweets',
};

/**
 * Topics close enough to fill a gallery when its own topic runs out (the
 * catalog holds 1–5 photos a topic): a restaurant gallery of six takes the
 * cafe's and the sweets' plates next, never a law office.
 */
const RELATED_TOPICS: Readonly<Partial<Record<PhotoTopic, readonly PhotoTopic[]>>> = {
  // Not the cafe (fix pass 2026-10-06): a grill's dishes gallery showed baristas and lattes. Fewer on-topic photos beat six mixed ones.
  restaurant: ['sweets'],
  cafe: ['sweets', 'restaurant'],
  sweets: ['cafe', 'restaurant'],
  ramadan: ['sweets', 'restaurant'],
  realestate: ['construction', 'city'],
  construction: ['realestate', 'city'],
  hotel: ['travel', 'city'],
  travel: ['hotel', 'city'],
  medical: ['dental'],
  dental: ['medical'],
  wedding: ['fashion', 'perfume'],
  fashion: ['perfume', 'wedding'],
  perfume: ['fashion'],
  business: ['tech', 'law'],
  tech: ['business'],
  law: ['business'],
  barber: ['fashion'],
  gym: ['medical'],
  car: ['city'],
  farm: ['restaurant'],
  charity: ['city'],
  city: ['travel'],
};

const MAX_ALT = 250;
const MAX_CAPTION = 120;
const MAX_TOPIC = 80;
const PAGE_BRIEF_MAX = 2_000;

/** The page locale a recipe writes in. */
export function mediaLocale(context: AgentToolContext): MediaLocale {
  return isArabicLocale(context) ? 'ar' : 'en';
}

function catalogTopicList(): string {
  return TOPICS.join(', ');
}

/** An image address a person gave: https, a root-relative upload, or an inline image. */
export function imageAddressProblem(value: unknown, key: string): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') return `"${key}" must be an image address.`;
  const src = value.trim();
  const allowed =
    safeCustomCodeUrl(src) !== undefined &&
    !src.startsWith('./') &&
    !src.startsWith('//') &&
    !/[\s"'<>\\`]/u.test(src);
  return allowed
    ? undefined
    : `"${key}" must be an https address, an uploaded /… path or a data:image; or use 'catalog:<topic>' (topics: ${catalogTopicList()}).`;
}

function wholeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value < 100_000 ? value : undefined;
}

/** An art spec in place of an address: its alt and caption are optional, the tool writes the alt. */
function parseArtImage(
  value: Readonly<Record<string, unknown>>,
  where: string,
): Resolved<GivenImage> {
  const { src, alt, caption } = value;
  if (alt !== undefined && (typeof alt !== 'string' || alt.length > MAX_ALT)) {
    return {
      ok: false,
      error: `${where}.alt must be text of at most ${String(MAX_ALT)} characters.`,
    };
  }
  if (caption !== undefined && (typeof caption !== 'string' || caption.length > MAX_CAPTION)) {
    return {
      ok: false,
      error: `${where}.caption must be text of at most ${String(MAX_CAPTION)} characters.`,
    };
  }
  const words = (text: unknown) =>
    typeof text === 'string' && text.trim() !== '' ? text.trim() : undefined;
  const given = { alt: words(alt), caption: words(caption) };
  return {
    ok: true,
    value: {
      art: (src as string).trim(),
      ...(given.alt === undefined ? {} : { alt: given.alt }),
      ...(given.caption === undefined ? {} : { caption: given.caption }),
    },
  };
}

/** One `{src,alt,width?,height?,caption?}` the person supplied, checked; `src` may be an art spec. */
function parseGivenImage(value: unknown, where: string): Resolved<GivenImage> {
  if (!isRecord(value)) return { ok: false, error: `${where} must be {"src","alt"}.` };
  const extra = Object.keys(value).filter((key) => !['src', 'alt', 'width', 'height', 'caption'].includes(key));
  if (extra.length > 0) return { ok: false, error: `${where}: unknown keys ${extra.join(', ')}; use src, alt, width, height, caption.` };
  if (isArtSpec(value['src'])) return parseArtImage(value, where);
  const problem = imageAddressProblem(value['src'], `${where}.src`);
  if (problem !== undefined) return { ok: false, error: problem };
  const alt = value['alt'];
  if (typeof alt !== 'string' || alt.trim() === '' || alt.length > MAX_ALT) {
    return { ok: false, error: `${where}.alt is required: 1-${String(MAX_ALT)} characters describing the photo in the page language.` };
  }
  const caption = value['caption'];
  if (caption !== undefined && (typeof caption !== 'string' || caption.length > MAX_CAPTION)) {
    return { ok: false, error: `${where}.caption must be text of at most ${String(MAX_CAPTION)} characters.` };
  }
  for (const key of ['width', 'height'] as const) {
    if (value[key] !== undefined && wholeNumber(value[key]) === undefined) {
      return { ok: false, error: `${where}.${key} must be a whole number of pixels.` };
    }
  }
  const src = (value['src'] as string).trim();
  const srcset = srcsetFor(src);
  return {
    ok: true,
    value: {
      src,
      alt: alt.trim(),
      width: wholeNumber(value['width']),
      height: wholeNumber(value['height']),
      ...(srcset === undefined ? {} : { srcset }),
      ...(typeof caption === 'string' && caption.trim() !== '' ? { caption: caption.trim() } : {}),
    },
  };
}

/** `'catalog:<topic>'` → its topic words; `'catalog'` → the page's own; undefined when not a catalog spec. */
function catalogSpec(value: string): { readonly topic?: string } | undefined {
  const match = /^catalog(?::\s*(.*))?$/iu.exec(value.trim());
  if (match === null) return undefined;
  const topic = (match[1] ?? '').trim();
  return topic === '' ? {} : { topic: topic.slice(0, MAX_TOPIC) };
}

/** Parse an `images` field: absent (the page topic), `'catalog:<topic>'`, or `[{src,alt}]`. */
export function parseImagesField(value: unknown, key: string, max: number): Resolved<ImagesRequest | undefined> {
  if (value === undefined) return { ok: true, value: undefined };
  if (typeof value === 'string') {
    const spec = catalogSpec(value);
    if (spec === undefined) {
      return { ok: false, error: `"${key}" is 'catalog:<topic>' (topics: ${catalogTopicList()}) or [{"src","alt"}].` };
    }
    return { ok: true, value: { kind: 'catalog', ...spec } };
  }
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, error: `"${key}" is 'catalog:<topic>' or a non-empty array of {"src","alt"}.` };
  }
  if (value.length > max) return { ok: false, error: `"${key}" holds at most ${String(max)} images.` };
  const images: GivenImage[] = [];
  for (const [index, entry] of (value as unknown[]).entries()) {
    const parsed = parseGivenImage(entry, `${key}[${String(index)}]`);
    if (!parsed.ok) return parsed;
    images.push(parsed.value);
  }
  return { ok: true, value: { kind: 'list', images } };
}

/** One image field (a poster, a before or after picture): an address, `'catalog:<topic>'`, or `{src,alt}`. */
export type ImageRequest =
  | { readonly kind: 'catalog'; readonly topic?: string | undefined }
  | { readonly kind: 'given'; readonly image: GivenImage };

export function parseImageField(value: unknown, key: string): Resolved<ImageRequest | undefined> {
  if (value === undefined) return { ok: true, value: undefined };
  if (typeof value === 'string') {
    const spec = catalogSpec(value);
    if (spec !== undefined) return { ok: true, value: { kind: 'catalog', ...spec } };
    if (isArtSpec(value))
      return { ok: true, value: { kind: 'given', image: { art: value.trim() } } };
    const problem = imageAddressProblem(value, key);
    if (problem !== undefined) return { ok: false, error: problem };
    const src = value.trim();
    const srcset = srcsetFor(src);
    return { ok: true, value: { kind: 'given', image: { src, alt: '', ...(srcset === undefined ? {} : { srcset }) } } };
  }
  const parsed = parseGivenImage(value, key);
  return parsed.ok ? { ok: true, value: { kind: 'given', image: parsed.value } } : parsed;
}

// ── The catalog ───────────────────────────────────────────────────────────────

/** The words that select a topic: its name and English keywords, or the words as given. */
export function topicBrief(topic: string): string {
  const key = topic.trim().toLowerCase();
  const named: PhotoTopic | undefined =
    TOPIC_ALIASES[key] ?? ((TOPICS as readonly string[]).includes(key) ? (key as PhotoTopic) : undefined);
  return named === undefined ? topic : `${named} ${PHOTO_TOPIC_KEYWORDS[named].en.join(' ')}`;
}

/** The page's own words — its title, region labels and visible texts — to infer a topic from. */
export function pageBrief(context: AgentToolContext): string {
  const document = context.kernel.getDocument();
  const parts: string[] = [];
  const title = context.readProp(document.rootId, 'title');
  if (typeof title === 'string') parts.push(title);
  for (const id of rootChildren(context.kernel)) {
    const label = context.readProp(id, 'label');
    if (typeof label === 'string') parts.push(label);
    const tree = readTree(context, id);
    if (tree === undefined) continue;
    for (const node of treeNodes(tree)) {
      if (isElement(node) && typeof node.text === 'string') parts.push(node.text);
    }
  }
  return parts.join(' ').slice(0, PAGE_BRIEF_MAX);
}

/** Path part of an address (the query only sizes a catalog photo). */
function photoPath(url: string): string {
  return url.replaceAll('&amp;', '&').trim().replace(/[?#].*$/u, '').replace(/^https:\/\/[^/]+/u, '');
}

/** Catalog entries the page already shows (by path: a tree may have escaped the query). */
export function catalogPhotosOnPage(kernel: BuilderKernel): ReadonlySet<string> {
  const text = JSON.stringify(kernel.getDocument().nodes);
  const shown = new Set<string>();
  for (const entry of PHOTO_CATALOG_ENTRIES) {
    if (text.includes(photoPath(entry.url))) shown.add(entry.id);
  }
  return shown;
}

const ENTRY_BY_URL: ReadonlyMap<string, PhotoCatalogEntry> = new Map(
  PHOTO_CATALOG_ENTRIES.map((entry) => [entry.url, entry]),
);

/** A catalog photo as a recipe image: alt in the page language, intrinsic size, srcset. */
export function catalogImage(photo: CatalogPhoto, locale: MediaLocale): MediaImage {
  const entry = ENTRY_BY_URL.get(photo.url);
  const srcset = srcsetFor(photo.url);
  const alt = locale === 'ar' ? photo.alt.ar : photo.alt.en;
  return {
    src: photo.url,
    alt,
    width: entry?.width,
    height: entry?.height,
    ...(srcset === undefined ? {} : { srcset }),
    caption: alt,
  };
}

export interface CatalogImagesOptions {
  /** Topic words; undefined → the page's own topic. */
  readonly topic?: string | undefined;
  readonly count: number;
  /** Addresses already taken by this call (a compare's before photo). */
  readonly skip?: ReadonlySet<string> | undefined;
}

/**
 * `count` verified photos for a topic (or the page's), best first; photos the
 * page shows are left out unless nothing else fits, and a short topic is
 * filled from its related ones. An empty answer is a refusal with the topics.
 */
export function catalogImages(context: AgentToolContext, options: CatalogImagesOptions): Resolved<readonly MediaImage[]> {
  const locale = mediaLocale(context);
  const skip = options.skip ?? new Set<string>();
  const onPage = catalogPhotosOnPage(context.kernel);
  const brief = options.topic === undefined ? pageBrief(context) : topicBrief(options.topic);
  const pick = (words: string, avoidPage: boolean): readonly CatalogPhoto[] =>
    selectCatalogPhotos(words, {
      maxPhotos: 12,
      exclude: (entry) => skip.has(entry.url) || (avoidPage && onPage.has(entry.id)),
    });
  let photos = pick(brief, true);
  if (photos.length === 0) photos = pick(brief, false);
  const first = photos[0];
  if (first === undefined) {
    return {
      ok: false,
      error:
        options.topic === undefined
          ? `the page names no photo topic; give images:'catalog:<topic>' (topics: ${catalogTopicList()}) or [{"src","alt"}].`
          : `no catalog photo matches "${options.topic}"; use 'catalog:<topic>' with one of: ${catalogTopicList()}.`,
    };
  }
  // A named topic keeps to its own subject; only the fill below may widen it.
  const chosen = options.topic === undefined ? [...photos] : photos.filter(({ subject }) => subject === first.subject);
  for (const related of RELATED_TOPICS[first.subject] ?? []) {
    if (chosen.length >= options.count) break;
    const taken = new Set(chosen.map(({ url }) => url));
    for (const photo of pick(topicBrief(related), true)) {
      if (!taken.has(photo.url) && photo.subject === related) chosen.push(photo);
    }
  }
  return { ok: true, value: chosen.slice(0, options.count).map((photo) => catalogImage(photo, locale)) };
}

/** A given image as a recipe image: an address as it came, an art spec resolved in the page language. */
export function givenImage(context: AgentToolContext, image: GivenImage): Resolved<MediaImage> {
  if (!('art' in image)) return { ok: true, value: image };
  const art = resolveArtImage(image.art, { locale: mediaLocale(context), alt: image.alt });
  if (!art.ok) return art;
  const { src, alt, width, height } = art.value;
  return {
    ok: true,
    value: {
      src,
      alt,
      width,
      height,
      ...(image.caption === undefined ? {} : { caption: image.caption }),
    },
  };
}

/** Resolve an `images` request (absent → the page topic) to `count` images. */
export function resolveImages(
  context: AgentToolContext,
  request: ImagesRequest | undefined,
  count: number,
): Resolved<readonly MediaImage[]> {
  if (request?.kind === 'list') {
    const images: MediaImage[] = [];
    for (const image of request.images.slice(0, count)) {
      const resolved = givenImage(context, image);
      if (!resolved.ok) return resolved;
      images.push(resolved.value);
    }
    return { ok: true, value: images };
  }
  return catalogImages(context, { topic: request?.topic, count });
}

/** Resolve one image field; `fallbackTopic` true lets an absent field take the page topic. */
export function resolveImage(
  context: AgentToolContext,
  request: ImageRequest | undefined,
  skip?: ReadonlySet<string>,
): Resolved<MediaImage | undefined> {
  if (request === undefined) return { ok: true, value: undefined };
  if (request.kind === 'given') return givenImage(context, request.image);
  const images = catalogImages(context, { topic: request.topic, count: 1, skip });
  return images.ok ? { ok: true, value: images.value[0] } : images;
}

/** A best-effort catalog picture for the page (a poster): undefined when the page names no topic. */
export function pagePoster(context: AgentToolContext): MediaImage | undefined {
  const images = catalogImages(context, { count: 1 });
  return images.ok ? images.value[0] : undefined;
}
