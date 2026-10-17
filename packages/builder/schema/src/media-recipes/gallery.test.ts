import { describe, expect, it } from 'vitest';

import type { CustomCodeElement, CustomCodeNode } from '../custom-code/custom-code-tree';
import { mediaRecipeProblems } from './checks';
import { buildGallery, GALLERY_LAYOUTS, GALLERY_MAX_IMAGES } from './gallery';
import { isMediaRecipeError, mediaRecipeNode, type MediaImage, type MediaLocale, type MediaRecipeResult } from './types';

const LOCALES: readonly MediaLocale[] = ['ar', 'en'];

const images = (count: number): MediaImage[] =>
  Array.from({ length: count }, (_, at) => ({
    src: `https://images.example.com/food-${String(at)}.jpg`,
    alt: `طبق رقم ${String(at + 1)}`,
    width: 1200,
    height: 900,
    srcset: `https://images.example.com/food-${String(at)}-640.jpg 640w, https://images.example.com/food-${String(at)}.jpg 1200w`,
    caption: at % 2 === 0 ? `تعليق ${String(at + 1)}` : undefined,
  }));

function recipe(result: MediaRecipeResult) {
  if (isMediaRecipeError(result)) throw new Error(result.error);
  return result;
}

function all(node: CustomCodeNode, tag: string): CustomCodeElement[] {
  const found: CustomCodeElement[] = node.kind === 'element' && node.tag === tag ? [node] : [];
  for (const child of node.kind === 'icon' ? [] : (node.children ?? [])) found.push(...all(child, tag));
  return found;
}

describe('buildGallery', () => {
  it('every layout × locale × standalone passes the door', () => {
    for (const layout of GALLERY_LAYOUTS) {
      for (const locale of LOCALES) {
        for (const standalone of [true, false]) {
          for (const captions of [true, false]) {
            const built = recipe(
              buildGallery({
                layout,
                images: images(7),
                captions,
                aboveFold: captions,
                title: locale === 'ar' ? 'من مطبخنا' : 'From our kitchen',
                locale,
                heading: 'h2',
                standalone,
              }),
            );
            expect(mediaRecipeProblems(built), `${layout} ${locale}`).toEqual([]);
          }
        }
      }
    }
  });

  it('a standalone gallery is one section carrying the locale, its heading and the gallery behaviour', () => {
    const section = mediaRecipeNode(
      recipe(buildGallery({ images: images(6), locale: 'ar', title: 'معرض المطعم' })),
    );
    expect(section.tag).toBe('section');
    expect(section.attributes).toEqual({ lang: 'ar', dir: 'rtl' });
    expect(all(section, 'h2')[0]?.text).toBe('معرض المطعم');
    const gallery = all(section, 'div').find((div) => div.attributes?.['data-ck-behavior'] === 'gallery');
    expect(gallery?.className).toBe('grid grid-cols-2 gap-4 md:grid-cols-3');
    expect(all(section, 'img')).toHaveLength(6);
  });

  it('lazy-loads every image, except the first above the fold (eager, high priority)', () => {
    const lazy = all(mediaRecipeNode(recipe(buildGallery({ images: images(3), locale: 'en' }))), 'img');
    expect(lazy.map((img) => img.attributes?.loading)).toEqual(['lazy', 'lazy', 'lazy']);
    expect(lazy.every((img) => img.attributes?.fetchpriority === undefined)).toBe(true);
    const first = all(
      mediaRecipeNode(recipe(buildGallery({ images: images(3), locale: 'en', aboveFold: true }))),
      'img',
    );
    expect(first.map((img) => [img.attributes?.loading, img.attributes?.fetchpriority])).toEqual([
      ['eager', 'high'],
      ['lazy', undefined],
      ['lazy', undefined],
    ]);
    expect(first[0]?.attributes).toMatchObject({
      width: '1200',
      height: '900',
      decoding: 'async',
      sizes: '(min-width: 768px) 33vw, 50vw',
    });
  });

  it('captions come from the caption, else the alt text', () => {
    const captions = all(
      mediaRecipeNode(recipe(buildGallery({ images: images(2), locale: 'ar', captions: true }))),
      'figcaption',
    ).map((caption) => caption.text);
    expect(captions).toEqual(['تعليق 1', 'طبق رقم 2']);
  });

  it('shapes each layout with classes and hooks, not script', () => {
    const container = (layout: (typeof GALLERY_LAYOUTS)[number]) => {
      const built = recipe(buildGallery({ layout, images: images(5), locale: 'en', standalone: false }));
      return { node: mediaRecipeNode(built), css: built.css };
    };
    const masonry = container('masonry');
    expect(masonry.node.className).toContain('columns-2');
    expect(masonry.css).toMatch(/break-inside:avoid/u);
    expect(masonry.css).not.toMatch(/\b(?:left|right)\b/u);
    const bento = container('bento');
    expect(bento.node.children?.[0]).toMatchObject({ className: expect.stringContaining('col-span-2 row-span-2') as unknown });
    const carousel = container('carousel');
    expect(carousel.node.attributes?.['data-ck-behavior']).toBe('gallery');
    const inner = carousel.node.children?.[0] as CustomCodeElement;
    expect(inner.attributes).toMatchObject({ 'data-ck-behavior': 'carousel', 'data-ck-indicator': 'dots' });
    expect(all(inner, 'button').map((button) => button.attributes?.['aria-label'])).toEqual([
      'Previous image',
      'Next image',
    ]);
    const strip = container('filmstrip');
    expect(strip.node.attributes?.['data-ck-behavior']).toBe('marquee');
  });

  it('labels its buttons in Arabic on an Arabic page', () => {
    const node = mediaRecipeNode(recipe(buildGallery({ layout: 'carousel', images: images(3), locale: 'ar' })));
    expect(all(node, 'button').map((button) => button.attributes?.['aria-label'])).toEqual([
      'الصورة السابقة',
      'الصورة التالية',
    ]);
  });

  it('caps the images at 24 and refuses an empty gallery', () => {
    const many = mediaRecipeNode(recipe(buildGallery({ images: images(30), locale: 'en' })));
    expect(all(many, 'img')).toHaveLength(GALLERY_MAX_IMAGES);
    expect(buildGallery({ images: [], locale: 'en' })).toEqual({ error: 'a gallery needs at least one image' });
  });
});
