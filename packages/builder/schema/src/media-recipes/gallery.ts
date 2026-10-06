import type { CustomCodeElement, CustomCodeNode } from '../custom-code/custom-code-tree';
import {
  el,
  icon,
  imageNode,
  inLocale,
  mediaSection,
  root,
  type MediaHeading,
  type MediaImage,
  type MediaLocale,
  type MediaRecipeResult,
} from './types';

/**
 * Gallery recipes (media-motion DESIGN §B.1).
 *
 * Layout is CLASSES, behaviour is the attribute: grid, masonry and bento are
 * CSS only (masonry is CSS `columns`, RTL-safe), and every layout but the
 * filmstrip carries `data-ck-behavior="gallery"` so a click opens the shared
 * dialog with keys, swipe, counter and captions. The carousel layout nests the
 * existing `carousel` markup inside the gallery; the filmstrip is the existing
 * `marquee` (no dialog — its images keep moving).
 *
 * Classes come from the utility vocabulary; what it cannot say (masonry child
 * spacing, bento row height) is a region `ck-` hook in the returned CSS.
 */

export const GALLERY_LAYOUTS = ['grid', 'masonry', 'bento', 'carousel', 'filmstrip'] as const;

export type GalleryLayout = (typeof GALLERY_LAYOUTS)[number];

/** The most images one gallery holds. */
export const GALLERY_MAX_IMAGES = 24;

export interface GalleryOptions {
  readonly layout?: GalleryLayout | undefined;
  /** Already resolved (catalog or uploads); at most 24 are used. */
  readonly images: readonly MediaImage[];
  /** Show a caption under each image (its `caption`, else its alt). */
  readonly captions?: boolean | undefined;
  /** The gallery paints first: its first image loads eagerly at high priority. */
  readonly aboveFold?: boolean | undefined;
  readonly title?: string | undefined;
  readonly locale: MediaLocale;
  readonly heading?: MediaHeading | undefined;
  /** `false` returns the gallery container alone (for `insertTreeNode`); default a section. */
  readonly standalone?: boolean | undefined;
}

const LABELS: Readonly<Record<GalleryLayout, { readonly ar: string; readonly en: string }>> = {
  grid: { ar: 'معرض صور', en: 'Photo gallery' },
  masonry: { ar: 'معرض صور متداخل', en: 'Masonry gallery' },
  bento: { ar: 'معرض صور بنتو', en: 'Bento gallery' },
  carousel: { ar: 'معرض صور منزلق', en: 'Gallery carousel' },
  filmstrip: { ar: 'شريط صور', en: 'Photo strip' },
};

const CSS: Readonly<Record<GalleryLayout, string>> = {
  grid: '',
  masonry:
    '.ck-masonry{column-gap:1rem}.ck-masonry>*{margin-block-end:1rem;break-inside:avoid}@media (min-width:48rem){.ck-masonry{columns:3}}',
  bento: '.ck-bento{grid-auto-rows:12rem}',
  carousel: '.ck-gallery-flip:dir(rtl){transform:scaleX(-1)}',
  filmstrip: '',
};

/** The image classes of each layout. */
const IMAGE_CLASS: Readonly<Record<GalleryLayout, string>> = {
  grid: 'aspect-4/3 w-full rounded-xl object-cover',
  masonry: 'block h-auto w-full rounded-xl',
  bento: 'size-full rounded-xl object-cover',
  carousel: 'aspect-4/3 w-full rounded-xl object-cover',
  filmstrip: 'aspect-4/3 w-full rounded-xl object-cover',
};

const FIGURE_CLASS: Readonly<Record<GalleryLayout, string>> = {
  grid: 'relative',
  masonry: 'relative',
  bento: 'relative h-full',
  carousel: 'w-4/5 shrink-0 snap-start md:w-1/3',
  filmstrip: 'w-64 shrink-0',
};

function figure(
  image: MediaImage,
  layout: GalleryLayout,
  captions: boolean,
  priority: boolean,
): CustomCodeElement {
  const caption = (image.caption ?? image.alt).trim();
  const children: CustomCodeNode[] = [
    imageNode(
      {
        ...image,
        sizes:
          image.sizes ??
          (layout === 'bento' || layout === 'grid' || layout === 'masonry'
            ? '(min-width: 768px) 33vw, 50vw'
            : '(min-width: 768px) 33vw, 80vw'),
      },
      IMAGE_CLASS[layout],
      { priority },
    ),
  ];
  if (captions && caption !== '') {
    children.push(el('figcaption', 'mt-2 text-sm text-text-muted', undefined, undefined, caption));
  }
  return el('figure', FIGURE_CLASS[layout], undefined, children);
}

function container(layout: GalleryLayout, figures: CustomCodeElement[], locale: MediaLocale): CustomCodeElement {
  if (layout === 'grid') {
    return el('div', 'grid grid-cols-2 gap-4 md:grid-cols-3', { 'data-ck-behavior': 'gallery' }, figures);
  }
  if (layout === 'masonry') {
    return el('div', 'ck-masonry columns-2 gap-4', { 'data-ck-behavior': 'gallery' }, figures);
  }
  if (layout === 'bento') {
    const [first, ...rest] = figures;
    const lead =
      first === undefined
        ? []
        : [{ ...first, className: `${first.className ?? ''} col-span-2 row-span-2`.trim() }];
    return el(
      'div',
      'ck-bento grid grid-cols-2 gap-4 md:grid-cols-4',
      { 'data-ck-behavior': 'gallery' },
      [...lead, ...rest],
    );
  }
  if (layout === 'filmstrip') {
    return el('div', 'gap-4', { 'data-ck-behavior': 'marquee', 'data-ck-speed': 'slow' }, figures);
  }
  const button = (direction: 'previous' | 'next'): CustomCodeElement =>
    el(
      'button',
      'inline-flex size-10 items-center justify-center rounded-full border border-text/20 bg-surface text-text transition hover:bg-text/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
      {
        type: 'button',
        'aria-label': inLocale(
          locale,
          direction === 'previous'
            ? { ar: 'الصورة السابقة', en: 'Previous image' }
            : { ar: 'الصورة التالية', en: 'Next image' },
        ),
      },
      [icon(direction === 'previous' ? 'chevron-left' : 'chevron-right', 20, 'ck-gallery-flip')],
    );
  return el('div', undefined, { 'data-ck-behavior': 'gallery' }, [
    el(
      'div',
      'relative',
      { 'data-ck-behavior': 'carousel', 'data-ck-indicator': 'dots', 'data-ck-autoplay': 'false' },
      [
        el('div', 'flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2', undefined, figures),
        el('div', 'mt-4 flex justify-end gap-2', undefined, [button('previous'), button('next')]),
      ],
    ),
  ]);
}

/** A photo gallery: grid, masonry, bento, carousel or filmstrip, with the shared dialog. */
export function buildGallery(options: GalleryOptions): MediaRecipeResult {
  const layout = options.layout ?? 'grid';
  if (!(GALLERY_LAYOUTS as readonly string[]).includes(layout)) {
    return { error: `layout is one of ${GALLERY_LAYOUTS.join(', ')}` };
  }
  const images = options.images.filter((image) => image.src.trim() !== '').slice(0, GALLERY_MAX_IMAGES);
  if (images.length === 0) return { error: 'a gallery needs at least one image' };
  const figures = images.map((image, at) =>
    figure(image, layout, options.captions === true, options.aboveFold === true && at === 0),
  );
  const gallery = container(layout, figures, options.locale);
  return {
    label: LABELS[layout],
    tree: root(
      options.standalone === false
        ? gallery
        : mediaSection(
            { locale: options.locale, title: options.title, heading: options.heading ?? 'h2' },
            [gallery],
          ),
    ),
    css: CSS[layout],
  };
}
